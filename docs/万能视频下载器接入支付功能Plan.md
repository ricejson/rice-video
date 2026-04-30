# 万能视频下载器 接入支付功能 实现方案

> 实施方案 | Stripe 支付集成 | 2026-04-30

---

## 一、方案概述

### 1.1 目标

作为商业项目，接入 Stripe 国际支付能力，实现：
1. 用户可以通过 Stripe 购买 VIP 会员（¥9.9/月）
2. 系统自动开通会员身份并控制功能权限
3. 免费用户无需登录即可使用基础功能，VIP 用户享受高级权限

### 1.2 为什么选 Stripe

| 对比维度 | Stripe | 支付宝/微信支付 |
|----------|--------|-----------------|
| 全球覆盖 | 135+ 种货币，全球可用 | 主要中国市场 |
| 开发体验 | API 设计优秀，文档全面 | 需要企业资质 |
| 沙盒测试 | 开箱即用，无需真实银行卡 | 需要沙箱账号申请 |
| 订阅管理 | 内置 Subscription + Webhook | 需要自己实现 |
| 合规 | PCI DSS Level 1 | 需要额外处理 |

**结论**：对于面向全球用户的商业项目，Stripe 是最佳选择。

---

## 二、Stripe 基础概念（给第一次接触的你）

### 2.1 核心概念

在开始设计之前，你需要理解 Stripe 的几个核心概念：

```
你的服务器 (FastAPI)          Stripe 服务器              用户浏览器
      │                          │                         │
      │  1. 创建 Checkout Session │                         │
      │─────────────────────────►│                         │
      │                          │                         │
      │  2. 返回支付页面 URL       │                         │
      │◄─────────────────────────│                         │
      │                          │                         │
      │  3. 重定向用户到 Stripe    │                         │
      │─────────────────────────────────────────────────►│
      │                          │                         │
      │                          │  4. 用户填写信用卡信息     │
      │                          │◄────────────────────────│
      │                          │                         │
      │  5. Webhook: 支付成功      │                         │
      │◄─────────────────────────│                         │
      │                          │                         │
      │  6. 开通会员权限           │                         │
      │                          │                         │
```

**重要概念**：

| 概念 | 说明 | 类比 |
|------|------|------|
| **Product** | 你卖的产品（即「VIP 会员」） | 商品 |
| **Price** | 产品的定价（如 ¥9.9/月） | 价格标签 |
| **Customer** | 你的用户，在 Stripe 中对应一个 ID | 顾客档案 |
| **Checkout Session** | 一次支付会话，Stripe 托管的支付页面 | 收银台 |
| **Subscription** | 订阅关系，Stripe 自动管理续费 | 订阅合同 |
| **Webhook** | Stripe 通知你服务器的 HTTP 回调 | 消息通知 |
| **Payment Intent** | 一次支付意图，跟踪支付状态 | 支付记录 |

### 2.2 支付流程

用户支付的完整流程只有 4 步：

```
Step 1: 用户在前端点击「开通 VIP」
        → 前端调后端 API: POST /api/payment/create-checkout

Step 2: 后端调用 Stripe API 创建 Checkout Session
        → 获取到支付页面 URL (如 https://checkout.stripe.com/c/pay/xxx)

Step 3: 后端把 URL 返回前端，前端把用户重定向到 Stripe 支付页面
        → 用户在 Stripe 页面输入信用卡完成支付

Step 4: 支付成功后，Stripe 调用你服务器的 Webhook 通知你
        → 你在 Webhook 中给用户开通会员权限
        → 用户可以享受付费功能
```

### 2.3 你需要做的准备工作

在实际开发前，你需要完成以下准备工作：

1. **注册 Stripe 账号**：去 https://dashboard.stripe.com/register 注册
2. **获取 API 密钥**：在 Stripe Dashboard → Developers → API keys 中获取
   - `Publishable Key`（`pk_test_xxx`）：前端使用，可以公开
   - `Secret Key`（`sk_test_xxx`）：后端使用，绝对不能公开
3. **安装 Stripe CLI**（用于本地测试 Webhook）：
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

> ⚠️ **重要**：Stripe 有两种模式：
> - **Test Mode（测试模式）**：使用 `pk_test_xxx` / `sk_test_xxx`，不会扣真实钱
> - **Live Mode（生产模式）**：使用 `pk_live_xxx` / `sk_live_xxx`，会扣真实钱
>
> 开发阶段只用 Test Mode！

---

## 三、整体架构设计

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户浏览器                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Header（新增：登录/注册/用户头像）                              │  │
│  │  PricingCard（改造：订阅按钮触发支付流程）                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP
┌────────────────────────────────▼────────────────────────────────────┐
│                      Next.js 前端代理                                │
│                  /api/* → localhost:8000/api/*                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    FastAPI 后端 (新增模块)                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ auth.py       │  │ payment.py   │  │ webhook.py               │ │
│  │ 用户注册/登录  │  │ 创建支付会话  │  │ 接收支付状态通知           │ │
│  │ JWT 认证中间件 │  │ 查询订阅状态  │  │ 开通/更新会员权限         │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ security.py  │  │ database.py (SQLite)                         │ │
│  │ JWT 创建/验证 │  │ 用户表 + 订阅表 + 幂等记录表                    │ │
│  │ 密码哈希      │  └──────────────────────────────────────────────┘ │
│  └──────────────┘                                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 权限控制层 (修改现有 API)                                      │   │
│  │ - /api/download：检查用户下载次数限制                           │   │
│  │ - /api/summarize：检查用户是否有 AI 总结权限                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| **数据库** | SQLite (aiosqlite) | 轻量、无需安装、单文件、满足当前规模 |
| **ORM** | 原生 SQL (aiosqlite) | 简单直接，减少依赖 |
| **密码哈希** | passlib[bcrypt] | 已在 requirements.txt 中 |
| **JWT** | python-jose | 已在 requirements.txt 中 |
| **Stripe SDK** | stripe==9.0.0+ | Stripe 官方 Python SDK |
| **Stripe 支付页面** | Stripe Checkout | Stripe 托管的支付页面，无需自己写支付 UI |

---

## 四、数据库设计

### 4.1 为什么需要数据库

当前项目没有数据库，所有任务状态存在内存中（`self.tasks: Dict`），服务重启就会丢失。

支付系统**必须**持久化以下数据：
- 用户信息（邮箱、密码哈希）
- 订阅状态（什么时候到期、什么套餐）
- 支付记录（谁付了多少钱、什么时间）

选择 SQLite 是因为：
1. 无需安装（Python 内置支持）
2. 单文件存储，备份方便
3. 足够支撑几千用户
4. 后续可无缝升级到 PostgreSQL

### 4.2 数据库表设计

```sql
-- 1. 用户表
CREATE TABLE users (
    id            TEXT PRIMARY KEY,          -- UUID
    email         TEXT NOT NULL UNIQUE,       -- 邮箱（唯一）
    password_hash TEXT NOT NULL,              -- bcrypt 哈希
    plan_id       TEXT NOT NULL DEFAULT 'free',  -- 当前套餐: free/vip
    is_active     INTEGER NOT NULL DEFAULT 1,    -- 账号是否激活
    created_at    TEXT NOT NULL,              -- ISO 时间戳
    updated_at    TEXT NOT NULL
);

-- 2. 订阅表
CREATE TABLE subscriptions (
    id                    TEXT PRIMARY KEY,       -- UUID
    user_id               TEXT NOT NULL,          -- 关联用户
    stripe_subscription_id TEXT,                  -- Stripe 订阅 ID (用于管理)
    stripe_customer_id    TEXT,                   -- Stripe 客户 ID
    plan_id               TEXT NOT NULL,          -- free/vip
    status                TEXT NOT NULL,          -- active/canceled/expired
    current_period_start  TEXT,                   -- 当前周期开始
    current_period_end    TEXT,                   -- 当前周期结束（到期时间）
    canceled_at           TEXT,                   -- 取消时间
    daily_download_count  INTEGER NOT NULL DEFAULT 0,  -- 今日下载次数
    download_count_date   TEXT,                   -- 下载计数日期 (YYYY-MM-DD)
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 幂等记录表（防止重复处理 Webhook）
CREATE TABLE idempotency_records (
    idempotency_key TEXT PRIMARY KEY,   -- Stripe 事件 ID
    event_type      TEXT NOT NULL,      -- 事件类型
    processed_at    TEXT NOT NULL        -- 处理时间
);

-- 4. 支付记录表（审计用）
CREATE TABLE payment_logs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    stripe_event_id       TEXT NOT NULL,
    stripe_session_id     TEXT,               -- Checkout Session ID
    amount_total          INTEGER,            -- 金额（分为单位）
    currency              TEXT,               -- 货币
    status                TEXT NOT NULL,       -- completed/refunded
    created_at            TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 五、用户认证系统设计

### 5.1 认证流程

```
注册：用户输入邮箱+密码 → 后端存 bcrypt 哈希 → 返回 JWT
登录：用户输入邮箱+密码 → 后端验证 → 返回 JWT
请求：前端每次请求带 Authorization: Bearer <JWT> → 后端验证后注入当前用户
```

### 5.2 JWT Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "plan": "vip",
  "exp": 1234567890
}
```

### 5.3 认证中间件

```python
# 新增 app/core/security.py
# 提供：
# - get_current_user(): 从 JWT 解析当前用户
# - get_current_active_user(): 验证用户存在且激活
# - require_plan(plan): 检查用户是否有指定套餐权限
```

---

## 六、Stripe 支付流程详细设计

### 6.1 创建支付会话（后端）

```
POST /api/payment/create-checkout
Headers: Authorization: Bearer <JWT>

Request:
{
  "plan_id": "vip",
  "success_url": "https://yoursite.com/success",
  "cancel_url": "https://yoursite.com/pricing"
}

Response:
{
  "code": 0,
  "data": {
    "checkout_url": "https://checkout.stripe.com/c/pay/xxx"
  }
}
```

后端逻辑：
1. 验证 JWT，获取用户身份
2. 查找对应的 Stripe Price ID（在 Stripe Dashboard 中预先创建 VIP 产品）
3. 查找或创建 Stripe Customer
4. 创建 Checkout Session，mode='subscription'
5. 把 session_id 和用户 ID 暂存
6. 返回 checkout_url 给前端

### 6.2 前端支付触发

```tsx
// PricingCard 改造
const handleSubscribe = async (planId: string) => {
  // 1. 如果用户未登录，跳转登录页
  if (!isLoggedIn) {
    router.push('/login?redirect=/pricing');
    return;
  }

  // 2. 调用后端创建支付会话
  const res = await fetch('/api/payment/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      success_url: `${window.location.origin}/success`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  });

  const data = await res.json();

  // 3. 重定向到 Stripe 支付页面
  window.location.href = data.data.checkout_url;
};
```

### 6.3 Webhook 处理（后端）

这是整个支付系统最关键的环节。Stripe 在支付成功/订阅更新后会调用你的 Webhook URL。

```
POST /api/payment/webhook
Headers: Stripe-Signature: <签名>

处理的事件：
├── checkout.session.completed    → 支付完成，开通会员
├── invoice.paid                   → 续费成功
├── customer.subscription.deleted  → 订阅取消
└── customer.subscription.updated  → 订阅变更
```

---

## 七、安全与幂等性设计

### 7.1 Webhook 签名验证

Stripe 的 Webhook 请求带有一个 `Stripe-Signature` 头，你必须验证这个签名才能确认请求真的来自 Stripe。

```python
import stripe

payload = await request.body()
sig_header = request.headers.get('Stripe-Signature')

try:
    event = stripe.Webhook.construct_event(
        payload, sig_header, WEBHOOK_SECRET
    )
except stripe.error.SignatureVerificationError:
    raise HTTPException(status_code=400, detail="Invalid signature")
```

### 7.2 幂等性保护（防重复付款）

**什么是幂等性问题？**
Stripe 可能因为网络问题多次发送同一个 Webhook 事件。如果「开通会员」这个操作被重复执行，不会造成直接经济损失，但会污染数据。

**解决方案**：
1. 每个 Stripe Webhook 事件有唯一的 `event.id`
2. 在 `idempotency_records` 表中记录已处理的事件 ID
3. 处理前先检查：如果事件已处理过，直接返回 200 不再处理
4. 使用数据库事务确保检查和插入的原子性

```python
async def process_webhook_event(event):
    event_id = event['id']

    # 幂等性检查
    async with db.transaction():
        # 尝试插入，如果已存在则跳过
        existing = await db.fetchone(
            "SELECT id FROM idempotency_records WHERE idempotency_key = ?",
            (event_id,)
        )
        if existing:
            return  # 已处理过，跳过

        # 标记为已处理
        await db.execute(
            "INSERT INTO idempotency_records (idempotency_key, event_type, processed_at) VALUES (?, ?, ?)",
            (event_id, event['type'], datetime.utcnow().isoformat())
        )

        # 处理业务逻辑...
```

### 7.3 其他安全措施

| 措施 | 说明 |
|------|------|
| **HTTPS** | 生产环境必须使用 HTTPS |
| **Secret Key 保护** | `sk_live_xxx` 只存环境变量，绝不提交代码 |
| **Webhook Secret** | 在 Stripe Dashboard 中获取 Webhook 签名密钥 |
| **最小权限** | Stripe API Key 只给必要的权限 |
| **日志记录** | 所有支付操作记录到 `payment_logs` 表 |

---

## 八、权限控制设计

### 8.1 套餐权限对照表

| 权限 | 免费用户 | VIP |
|------|----------|-----|
| 每日下载次数 | 3 | 50 |
| 最高清晰度 | 720p | 4K |
| 并发下载数 | 1 | 3 |
| AI 视频总结 | ✅ | ✅ |
| 字幕下载 | ❌ | ✅ |
| 价格 | 免费 | ¥9.9/月 |

### 8.2 权限检查实现

在现有的 `/api/download` 和 `/api/summarize` 接口中添加权限检查中间件。

```python
# 修改 app/api/download.py
@router.post("")
async def create_download_task(
    req: DownloadRequest,
    current_user: User = Depends(get_current_active_user),
):
    # 1. 获取用户订阅信息
    sub = await get_user_subscription(current_user.id)

    # 2. 检查每日下载次数
    if sub.daily_download_count >= get_plan_limit(sub.plan_id):
        raise HTTPException(
            status_code=429,
            detail=f"今日下载次数已达上限，请升级套餐或明天再试"
        )

    # 3. 检查清晰度限制
    max_quality = get_plan_quality(sub.plan_id)
    if req.quality not in get_allowed_qualities(max_quality):
        raise HTTPException(
            status_code=403,
            detail=f"当前套餐最高支持 {max_quality} 清晰度"
        )

    # 4. 正常处理下载...
```

### 8.3 每日次数重置

使用 `download_count_date` 字段判断：
- 如果日期不是今天 → 重置计数为 0，更新日期为今天
- 如果日期是今天 → 累加计数

这个逻辑在每次下载请求时执行，无需定时任务。

---

## 九、前端设计

### 9.1 新增页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录页 | `/login` | 邮箱+密码登录 |
| 注册页 | `/register` | 邮箱+密码注册 |
| 支付成功页 | `/success` | 支付成功后展示 |
| 用户中心 | `/account` | 查看订阅状态、管理订阅 |

### 9.2 改造现有组件

| 组件 | 改动 |
|------|------|
| `Header.tsx` | 显示登录/注册按钮（未登录）或用户头像+套餐（已登录） |
| `PricingCard.tsx` | 给订阅按钮添加 onClick 处理，未登录跳登录页，已登录创建支付会话 |
| `DownloadCard.tsx` | 解析时根据用户套餐显示不同的清晰度选项 |

### 9.3 全局状态管理

新增一个 `AuthContext` 来管理用户的登录状态：

```tsx
// web/src/contexts/AuthContext.tsx
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
}
```

---

## 十、新增/修改文件清单

### 10.1 后端新增文件

| 文件 | 说明 |
|------|------|
| `app/core/database.py` | SQLite 数据库初始化和连接管理 |
| `app/core/security.py` | JWT 创建/验证、密码哈希、认证中间件 |
| `app/models/user.py` | 用户和订阅 Pydantic 模型 |
| `app/api/auth.py` | 用户注册/登录接口 |
| `app/api/payment.py` | Stripe 支付相关接口 |

### 10.2 后端修改文件

| 文件 | 说明 |
|------|------|
| `app/main.py` | 注册新路由 + 数据库初始化 |
| `app/core/config.py` | 新增 Stripe 配置项 |
| `app/api/download.py` | 添加权限检查 |
| `app/api/subscribe.py` | 改为从配置读取套餐（支持 Stripe Price ID），简化为 free/vip 两档 |
| `app/models/task.py` | 新增用户相关模型 |
| `.env.example` | 新增 Stripe 配置模板 |
| `requirements.txt` | 新增 `stripe`、`aiosqlite` |

### 10.3 前端新增文件

| 文件 | 说明 |
|------|------|
| `web/src/app/login/page.tsx` | 登录页 |
| `web/src/app/register/page.tsx` | 注册页 |
| `web/src/app/success/page.tsx` | 支付成功页 |
| `web/src/app/account/page.tsx` | 用户中心 |
| `web/src/contexts/AuthContext.tsx` | 全局认证状态 |
| `web/src/lib/api.ts` | API 请求封装（自动带 JWT） |

### 10.4 前端修改文件

| 文件 | 说明 |
|------|------|
| `web/src/app/layout.tsx` | 包裹 AuthProvider |
| `web/src/components/Header.tsx` | 添加登录状态展示 |
| `web/src/components/PricingCard.tsx` | 添加支付逻辑 |
| `web/src/components/DownloadCard.tsx` | 套餐权限限制 |

---

## 十一、沙盒环境测试指南（没有外网也能测）

### 11.1 你的本地测试环境

**好消息**：Stripe 的 Test Mode 不需要外网也能完成大部分测试！

```
你的电脑 (localhost)
├── FastAPI 后端 (:8000)
│   └── 可以正常访问 Stripe API (api.stripe.com)
├── Next.js 前端 (:3000)
└── Stripe CLI（用于本地 Webhook 转发）
```

### 11.2 测试步骤

#### Step 1：注册 Stripe 并获取密钥

1. 打开 https://dashboard.stripe.com/register 注册（用邮箱即可）
2. 进入 Dashboard，左侧菜单 → Developers → API keys
3. 你会看到两个密钥：
   - **Publishable key**: `pk_test_xxxxx`（前端用）
   - **Secret key**: `sk_test_xxxxx`（后端用）
4. 把这两个密钥写入 `.env` 文件

#### Step 2：在 Stripe Dashboard 创建产品

1. 进入 Dashboard → Products → Add product
2. 创建一个产品：
   - **VIP 会员**：名称 "VIP Membership"，价格 ¥9.90/month
3. 创建后，产品会有一个 Price ID（如 `price_xxxxx`），记下来

#### Step 3：安装 Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

#### Step 4：启动 Webhook 本地转发

```bash
# 登录 Stripe CLI
stripe login

# 启动 Webhook 转发（把 Stripe 的事件转发到本地）
stripe listen --forward-to localhost:8000/api/payment/webhook
```

终端会输出一个 `whsec_xxxxx`（Webhook Signing Secret），把它写入 `.env`。

这样 Stripe 的支付事件就能发到你本地了！

#### Step 5：配置 .env

```bash
# .env 新增
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_VIP_PRICE_ID=price_xxxxx
```

#### Step 6：启动项目

```bash
# 终端 1：启动后端
cd /Users/shilianjie/code/github/rice-video
python -m uvicorn app.main:app --reload --port 8000

# 终端 2：启动前端
cd web
npm run dev

# 终端 3：启动 Stripe Webhook 转发
stripe listen --forward-to localhost:8000/api/payment/webhook
```

#### Step 7：完整支付流程测试

1. 浏览器打开 http://localhost:3000
2. 注册一个账号
3. 点击「开通 VIP」
4. 被重定向到 Stripe 的支付页面
5. **使用测试卡号**：`4242 4242 4242 4242`
   - 过期日：任意未来日期（如 12/30）
   - CVC：任意 3 位数（如 123）
   - 邮编：任意（如 10001）
6. 点击支付，成功后会自动跳回你的网站
7. 检查后端日志，确认 Webhook 被正确接收
8. 检查数据库，确认用户套餐已升级
9. 尝试下载，验证次数限制生效

### 11.3 测试卡号大全

Stripe 提供了各种测试场景的卡号：

| 卡号 | 场景 |
|------|------|
| `4242 4242 4242 4242` | 支付成功 |
| `4000 0025 0000 3155` | 需要 3D Secure 验证 |
| `4000 0000 0000 9995` | 余额不足 |
| `4000 0000 0000 0341` | 疑似欺诈（拒绝） |

---

## 十二、实施步骤（按顺序）

### Phase 4-1：基础设施搭建

- [ ] 安装 `stripe` 和 `aiosqlite` Python 包
- [ ] 创建 `app/core/database.py`（SQLite 初始化 + 建表）
- [ ] 创建 `app/core/security.py`（JWT + 密码哈希）
- [ ] 创建 `app/models/user.py`（用户/订阅模型）
- [ ] 更新 `app/core/config.py`（新增 Stripe 配置）
- [ ] 更新 `.env.example`

### Phase 4-2：用户认证

- [ ] 创建 `app/api/auth.py`（注册 + 登录接口）
- [ ] 在 `app/main.py` 中注册路由 + 数据库启动初始化
- [ ] 前端创建 `AuthContext.tsx`
- [ ] 前端创建登录页 `/login`
- [ ] 前端创建注册页 `/register`
- [ ] 改造 `Header.tsx` 显示登录状态

### Phase 4-3：Stripe 支付核心

- [ ] 在 Stripe Dashboard 创建产品和价格
- [ ] 创建 `app/api/payment.py`（创建支付会话 + Webhook 处理）
- [ ] 前端改造 `PricingCard.tsx` 添加支付逻辑
- [ ] 前端创建支付成功页 `/success`
- [ ] 本地测试完整支付流程

### Phase 4-4：权限控制

- [ ] 在下载 API 中添加套餐权限检查
- [ ] 在解析 API 中添加清晰度限制
- [ ] 前端根据用户套餐限制 UI 选项

### Phase 4-5：用户中心

- [ ] 前端创建用户中心 `/account`
- [ ] 显示当前套餐详情和到期时间
- [ ] 升级/降级/取消订阅功能

---

## 十三、验收标准

### 13.1 功能验收

- [ ] 用户可以注册和登录
- [ ] 未登录用户点击订阅时跳转登录页
- [ ] 登录用户可以创建 Stripe 支付会话
- [ ] 使用测试卡号完成支付
- [ ] 支付成功后 Stripe Webhook 正确开通会员
- [ ] 免费用户每日下载限制为 3 次
- [ ] 付费用户每日下载限制为 50 次
- [ ] 免费用户最高 720p，VIP 最高 4K
- [ ] 防止重复处理 Webhook（幂等性）
- [ ] 订阅到期后自动降级为免费

### 13.2 安全验收

- [ ] Webhook 签名验证正常
- [ ] Stripe Secret Key 不暴露在前端
- [ ] JWT 过期后需要重新登录
- [ ] 密码使用 bcrypt 哈希存储

---

## 十四、成本分析

### 14.1 Stripe 手续费

Stripe 的标准费率：
- **每笔交易**：2.9% + $0.30
- **国际卡**：额外 +1.5%

如果定价 ¥9.9/月：
- 每笔手续费约 $0.07 + 2.9%
- 你实际收到约 ¥9.3

### 14.2 定价（已确认）

| 套餐 | 价格 | Stripe Price ID 变量名 |
|------|------|------------------------|
| 免费用户 | ¥0 | (无需 Stripe Price) |
| VIP 会员 | ¥9.90/月 | `STRIPE_VIP_PRICE_ID` |

> 仅有一种付费套餐，简单明了，用户无需纠结选择。
>
> ⚠️ Stripe 后台创建 Product 时，货币选择 **CNY (人民币)**，价格填 **9.90**。

---

## 十五、决策记录（已确认）

| # | 决策项 | 结论 |
|---|--------|------|
| 1 | **套餐设计** | 仅两种：免费用户 + VIP 会员（¥9.9/月），无年卡 |
| 2 | **数据库** | SQLite，后续可迁移到 PostgreSQL |
| 3 | **免费用户** | 无需登录即可使用基础功能，降低使用门槛 |
| 4 | **支付页面** | 使用 Stripe Checkout（Stripe 托管页面） |


---

## 附录 A：Stripe CLI 快速参考

```bash
# 安装
brew install stripe/stripe-cli/stripe

# 登录
stripe login

# 启动本地 Webhook 转发
stripe listen --forward-to localhost:8000/api/payment/webhook

# 手动触发测试事件
stripe trigger checkout.session.completed

# 查看所有支持的事件类型
stripe trigger --help
```

## 附录 B：测试卡号快速参考

| 卡号 | 过期 | CVC | 结果 |
|------|------|-----|------|
| `4242 4242 4242 4242` | 任意 | 任意 | ✅ 成功 |
| `4000 0025 0000 3155` | 任意 | 任意 | 🔐 需 3D Secure |
| `4000 0000 0000 9995` | 任意 | 任意 | ❌ 余额不足 |
| `5555 5555 5555 4444` | 任意 | 任意 | ✅ Mastercard |

---

> **文档状态**：方案设计完成，待人工确认后实施
>
> 更新日期：2026-04-30
