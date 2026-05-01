# 万能视频下载器 — Stripe 国际支付从 0 到 1 完整指南

> 适合人群：没有支付开发经验的小白，想从零学习如何在 FastAPI + Next.js 项目中接入 Stripe 支付。
> 读完本文你将学会：注册 Stripe → 搭建支付 API → 处理 Webhook 回调 → 前端购买流程 → 上线部署。

---

## 目录

1. [前置知识：Stripe 是什么](#1-前置知识stripe-是什么)
2. [系统架构总览](#2-系统架构总览)
3. [第零步：注册 Stripe 获取密钥](#3-第零步注册-stripe-获取密钥)
4. [第一步：数据库设计](#4-第一步数据库设计)
5. [第二步：用户认证系统](#5-第二步用户认证系统)
6. [第三步：创建支付会话](#6-第三步创建支付会话)
7. [第四步：Webhook 回调处理](#7-第四步webhook-回调处理)
8. [第五步：套餐权限控制](#8-第五步套餐权限控制)
9. [第六步：前端支付流程](#9-第六步前端支付流程)
10. [第七步：用户身份展示](#10-第七步用户身份展示)
11. [开发调试指南](#11-开发调试指南)
12. [实战踩坑记录](#12-实战踩坑记录)
13. [附录：完整文件清单](#13-附录完整文件清单)

---

## 1. 前置知识：Stripe 是什么

### 1.1 一句话理解

Stripe 是一个**支付网关**。你只需要调它的 API，它帮你完成信用卡收款、订阅管理、发票生成等所有跟「钱」相关的事情。

### 1.2 核心概念

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 你的网站      │    │ Stripe 服务器 │    │ 用户/银行     │
│              │    │              │    │              │
│ 创建支付页────→│    │ 跳转支付页────→│    │ 输入卡号      │
│              │    │              │    │              │
│ 收到通知←─────│    │←──支付成功──── │    │              │
│ (Webhook)   │    │              │    │              │
│              │    │              │    │              │
│ 开通VIP ─────│    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

| 概念 | 通俗解释 | 项目中对应的东西 |
|------|---------|----------------|
| **Product** | 你卖的商品 | VIP 会员 |
| **Price** | 商品价格（多少钱/多久） | ¥9.9/月 |
| **Customer** | 你的用户（在 Stripe 那边的记录） | 邮箱 ricejson666@gmail.com |
| **Checkout Session** | 一次支付会话（Stripe 托管支付页） | 用户点击「立即订阅」后创建的 |
| **Subscription** | 订阅（定期扣款） | 每月扣 ¥9.9 |
| **Webhook** | Stripe 主动通知你的服务器的回调 | 支付成功 → 开通 VIP |

### 1.3 为什么用 Stripe Checkout（而不是自己写支付页）

- **PCI 合规**：信用卡数据处理不需要经过你的服务器，Stripe 托管支付页
- **体验好**：自带手机/电脑适配，多语言，支持 40+ 支付方式
- **开发简单**：前端只需重定向到 Stripe 的 URL，后端只需处理 Webhook

---

## 2. 系统架构总览

### 2.1 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 + React + TypeScript |
| 后端 | Python FastAPI |
| 数据库 | SQLite (aiosqlite) |
| 认证 | JWT (python-jose + passlib[bcrypt]) |
| 支付 | Stripe Checkout + Webhook |

### 2.2 文件地图

```
rice-video/
├── .env                              # Stripe 密钥 (不提交到 Git)
├── app/                              # 后端 FastAPI
│   ├── api/
│   │   ├── auth.py                   # 注册/登录/获取用户信息
│   │   ├── payment.py                # ⭐ 创建支付会话 + Webhook 处理
│   │   └── download.py               # 下载接口 + 套餐权限检查
│   ├── core/
│   │   ├── config.py                 # 环境变量配置
│   │   ├── database.py               # SQLite 数据库初始化 + 迁移
│   │   └── security.py               # JWT 生成/验证 + 密码哈希
│   └── models/
│       └── user.py                   # 用户/订阅数据模型 + 套餐限制常量
└── web/                              # 前端 Next.js
    └── src/
        ├── lib/
        │   └── api.ts                # 前端统一请求封装
        ├── contexts/
        │   └── AuthContext.tsx        # ⭐ 全局登录状态管理
        ├── components/
        │   ├── PricingCard.tsx        # ⭐ 订阅套餐卡片
        │   ├── Header.tsx             # 顶部导航 + 用户身份徽章
        │   └── ParseBar.tsx           # 解析栏 + 配额提示
        └── app/
            ├── login/page.tsx         # 登录页
            ├── register/page.tsx      # 注册页
            ├── account/page.tsx       # 账号详情页
            └── success/page.tsx       # ⭐ 支付成功回调页
```

### 2.3 支付完整流程

```
前端                                  后端                            Stripe
 │                                     │                               │
 │  1. 用户点击「立即订阅」               │                               │
 ├──POST /api/payment/create-checkout──→│                               │
 │                                     │  2. 创建 Stripe Customer       │
 │                                     ├──stripe.Customer.create()────→│
 │                                     │←──customer_id───────────────│
 │                                     │                               │
 │                                     │  3. 创建 Checkout Session       │
 │                                     ├──stripe.checkout.Session──────→│
 │                                     │←── checkout_url ────────────│
 │                                     │                               │
 │←── { checkout_url } ───────────────┤                               │
 │                                     │                               │
 │  4. 浏览器跳转到 Stripe 支付页         │                               │
 ├─────────────────────────────────────│                               │
 │                                     │                               │
 │  5. 用户输入卡号、完成支付              │                               │
 ├─────────支付成功──────────────────────→│                               │
 │                                     │                               │
 │                                     │  6. Stripe 发送 Webhook 通知     │
 │                                     │←─ POST /api/payment/webhook ──│
 │                                     │  7. 验签 → 更新数据库为 VIP     │
 │                                     ├── UPDATE users SET plan_id='vip'
 │                                     │                               │
 │  8. 跳转到 /success 页面              │                               │
 │←─ 刷新头像 → 显示 VIP 徽章            │                               │
```

---

## 3. 第零步：注册 Stripe 获取密钥

### 3.1 注册账号

1. 打开 [stripe.com](https://stripe.com) 注册
2. **切换为测试模式**（左上角开关，确保显示 "Test Mode"）
3. 左侧菜单 → 「开发者」→ 「API 密钥」→ 复制 **可发布密钥** 和 **秘密密钥**

### 3.2 创建产品与价格

Stripe 订阅模式需要一个 Product（产品）和一个 Price（价格）：

```bash
# 方法一：Dashboard 操作
# Products → 添加产品 → 填写名称「VIP 会员」→ 定价模型选「标准定价」
# → 价格 ¥9.90 CNY → 计费周期「每月」→ 保存 → 复制 Price ID

# 方法二：命令行一键创建
stripe prices create \
  --unit-amount 990 \
  --currency cny \
  --recurring interval=month

# 返回的 id 就是 STRIPE_VIP_PRICE_ID（如 price_xxxxxxxxxxxxx）
```

### 3.3 获取 Webhook 签名密钥

```bash
# 安装 Stripe CLI
brew install stripe  # macOS
stripe login

# 启动本地 webhook 转发（开发环境必须！）
stripe listen --forward-to localhost:8000/api/payment/webhook

# 终端会输出一个 whsec_xxx 密钥，这就是 STRIPE_WEBHOOK_SECRET
```

### 3.4 配置环境变量

在项目根目录创建 `.env` 文件（不要提交到 Git！）：

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx      # 秘密密钥（后端用）
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx  # 可发布密钥（前端用）
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx     # Webhook 签名密钥
STRIPE_VIP_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxx       # VIP 价格 ID

# JWT
SECRET_KEY=your-random-secret-here
```

`.env.example` 作为模板提交（不含真实密钥）供其他开发者参考。

---

## 4. 第一步：数据库设计

### 4.1 为什么需要数据库

Stripe 负责收款，你的数据库负责：
- 记录谁是 VIP
- 记录下载次数有没有超限
- 防止 Webhook 重复处理（幂等性）
- 记录支付日志方便排查

### 4.2 建表 SQL

文件：`app/core/database.py`

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,          -- UUID
    email               TEXT NOT NULL UNIQUE,      -- 邮箱（登录账号）
    password_hash       TEXT NOT NULL,             -- bcrypt 哈希后的密码
    plan_id             TEXT NOT NULL DEFAULT 'free',  -- 套餐：free/vip
    stripe_customer_id  TEXT,                      -- Stripe 那边的 Customer ID
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- 订阅表（每个用户一条订阅记录）
CREATE TABLE IF NOT EXISTS subscriptions (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL,
    stripe_subscription_id  TEXT,    -- Stripe 那边的 Subscription ID
    stripe_customer_id      TEXT,    -- Stripe 那边的 Customer ID
    plan_id                 TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active',  -- active/expired
    current_period_start    TEXT,    -- 当前订阅周期开始时间
    current_period_end      TEXT,    -- 当前订阅周期结束时间
    daily_download_count    INTEGER NOT NULL DEFAULT 0,  -- 今日下载次数
    download_count_date     TEXT,    -- 下载计数对应的日期
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 幂等性表（防止 Webhook 重复处理）
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key TEXT PRIMARY KEY,   -- Stripe Event ID
    event_type      TEXT NOT NULL,      -- 事件类型
    processed_at    TEXT NOT NULL       -- 处理时间
);

-- 支付日志表
CREATE TABLE IF NOT EXISTS payment_logs (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    stripe_event_id     TEXT NOT NULL,
    stripe_session_id   TEXT,
    amount_total        INTEGER,        -- 金额（分）
    currency            TEXT,           -- 币种
    status              TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4.3 数据库迁移

当代码更新后需要给旧数据库加新列时，使用自动迁移：

```python
# app/core/database.py
_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
]

async def _run_migrations(db: aiosqlite.Connection):
    """自动检测并补齐旧数据库缺失的列"""
    cursor = await db.execute("PRAGMA table_info(users)")
    rows = await cursor.fetchall()
    existing_cols = {row["name"] for row in rows}

    for sql in _MIGRATIONS:
        col_name = sql.split("ADD COLUMN ")[1].split(" ")[0]
        if col_name not in existing_cols:
            await db.execute(sql)
            await db.commit()
```

`get_db()` 函数在每次连接时自动运行迁移，不需要手动操作。

---

## 5. 第二步：用户认证系统

### 5.1 密码处理

**绝不能存明文密码！** 使用 bcrypt 哈希：

```python
# app/core/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """用户注册时调用，生成不可逆哈希"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """用户登录时调用，比对密码"""
    return pwd_context.verify(plain_password, hashed_password)
```

### 5.2 JWT Token

登录成功后，服务端签发一个 JWT Token。前端存到 `localStorage`，后续请求带在 `Authorization` 头里：

```python
from jose import jwt

def create_access_token(user_id: str) -> str:
    """签发 Token，有效期 30 分钟"""
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def decode_access_token(token: str) -> dict | None:
    """解析 Token，返回用户信息或 None"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
```

### 5.3 两种认证依赖注入

```python
# get_optional_user: 不强制登录，未登录返回 None
# get_current_user: 强制登录，未登录返回 401

async def get_optional_user(request: Request) -> dict | None:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    payload = decode_access_token(token)
    if not payload:
        return None
    return payload

async def get_current_user(request: Request) -> dict:
    user = await get_optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录")
    return user
```

### 5.4 注册/登录 API

```python
# POST /api/auth/register
# 入参：{ "email": "...", "password": "..." }
# 出参：{ "code": 0, "data": { "token": "eyJ...", "user": { ... } } }

# POST /api/auth/login
# 同上

# GET /api/auth/me
# Header：Authorization: Bearer <token>
# 出参：{ "code": 0, "data": { "user": { plan_id: "free" }, "subscription": { ... } } }
```

> **注意**：免费用户可以不用登录直接下载。付费功能（购买 VIP 等）才需要登录。

---

## 6. 第三步：创建支付会话

### 6.1 接口定义

```
POST /api/payment/create-checkout
Header:  Authorization: Bearer <token>    ← 必须登录
入参：   { "plan_id": "vip", "success_url": "...", "cancel_url": "..." }
出参：   { "code": 0, "data": { "checkout_url": "https://checkout.stripe.com/..." } }
```

### 6.2 代码详解

文件：`app/api/payment.py`

```python
@router.post("/create-checkout")
async def create_checkout_session(
    req: CreateCheckoutRequest,
    user: dict = Depends(get_current_user),  # 自动校验登录状态
):
    db = await get_db()

    # ❶ 查询用户信息
    cursor = await db.execute(
        "SELECT plan_id, stripe_customer_id FROM users WHERE id = ?",
        (user["sub"],)
    )
    row = await cursor.fetchone()

    # ❷ 如果已经是 VIP，直接拒绝
    if row["plan_id"] == "vip":
        raise HTTPException(status_code=400, detail="您已是 VIP 会员")

    # ❸ 如果用户没有 Stripe Customer ID，创建一个
    #    一个真实用户对应一个 Stripe Customer，方便后续管理
    customer_id = row["stripe_customer_id"]
    if not customer_id:
        customer = stripe.Customer.create(email=user.get("email", ""))
        customer_id = customer["id"]
        await db.execute(
            "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
            (customer_id, user["sub"]),
        )

    # ❹ 创建 Stripe Checkout Session（核心！）
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],       # 支付方式：银行卡
        mode="subscription",                 # 模式：订阅（每月自动扣款）
        line_items=[{
            "price": STRIPE_VIP_PRICE_ID,    # 用你在 Stripe Dashboard 创建的 Price ID
            "quantity": 1,
        }],
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={"user_id": user["sub"]},   # 💡 重要！Webhook 回调时靠这个找到用户
    )

    # ❺ 返回 Stripe 支付页面 URL
    #    前端拿到这个 URL 后直接 window.location.href 跳转
    return {"code": 0, "data": {"checkout_url": session["url"]}}
```

### 6.3 为什么把用户 ID 放在 metadata 里

支付过程发生在 Stripe 的页面，用户可能会关闭浏览器。支付成功后 Stripe 通过 Webhook 通知你的服务器 —— 这时**请求来自 Stripe 服务器，没有你的登录 Token**。

你要怎么知道是谁付了款？

答案就是 **metadata**：

```python
metadata={"user_id": user["sub"]}  # 创建会话时埋一个标记
```

Stripe 会把 metadata 原样带到 Webhook 事件中，你在回调里就能找到付款用户。

### 6.4 测试卡号

Stripe 测试模式提供专用卡号，不会被真实扣款：

| 场景 | 卡号 | 效果 |
|------|------|------|
| 支付成功 | `4242 4242 4242 4242` | 正常支付 |
| 需要 3D 验证 | `4000 0025 0000 3155` | 会弹出银行验证 |
| 支付失败 | `4000 0000 0000 0002` | 余额不足 |

有效期填未来日期，CVC 填任意 3 位数。

---

## 7. 第四步：Webhook 回调处理

这是整个支付系统最关键的环节，也是最容易出错的地方。

### 7.1 什么是 Webhook

支付发生在 Stripe 那边。支付完成后，Stripe 需要通知你的服务器「有人付款了，给他开通 VIP」。

这个通知机制就叫 **Webhook**：Stripe 主动发一个 HTTP 请求到你的服务器，告知发生了什么事件。

### 7.2 安全第一：签名验证

**任何人都可能伪造一个 Webhook 请求**，冒充 Stripe 给你的服务器发「我付款了」。你必须验证请求确实来自 Stripe：

```python
@app.post("/api/payment/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    # 🛡️ 签名验证：用 STRIPE_WEBHOOK_SECRET 校验请求是否真的来自 Stripe
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
```

### 7.3 幂等性保护

Stripe 保证「至少一次」送达 —— 如果 Webhook 没收到 200 响应，会**重试**。重试策略：

- 第一次失败：立即重试
- 第二次失败：1 分钟后重试
- 之后按指数退避，最多重试 **5 天**

如果每次重试都给用户开一次 VIP……显然不行。这就是**幂等性**：

> 同一个事件，无论处理多少次，结果都一样。

```python
event_id = event["id"]

# 检查是否已经处理过这个事件
cursor = await db.execute(
    "SELECT 1 FROM idempotency_records WHERE idempotency_key = ?",
    (event_id,)
)
if await cursor.fetchone():
    return {"status": "ok", "message": "Already processed"}  # 已处理，直接返回

# ... 处理事件 ...

# 处理完后记录到幂等表
await db.execute(
    "INSERT INTO idempotency_records (idempotency_key, event_type, processed_at) VALUES (?, ?, ?)",
    (event_id, event_type, now),
)
await db.commit()
```

### 7.4 处理三种关键事件

```python
event_type = event["type"]
data = event["data"]["object"]  # 事件数据：可能是 Session/Invoice/Subscription 对象

if event_type == "checkout.session.completed":
    # 💰 支付成功 → 开通 VIP
    await _handle_checkout_completed(db, data, event_id, now)

elif event_type == "invoice.paid":
    # 🔄 续费成功 → 更新订阅状态
    await _handle_invoice_paid(db, data, event_id, now)

elif event_type == "customer.subscription.deleted":
    # ❌ 用户取消了订阅 → 降级为免费用户
    await _handle_subscription_deleted(db, data, event_id, now)
```

### 7.5 checkout.session.completed — 开通 VIP

```python
async def _handle_checkout_completed(db, session, event_id, now):
    # 从 metadata 里取用户 ID（创建会话时埋进去的）
    metadata = _sget(session, "metadata", {})
    user_id = _sget(metadata, "user_id")
    if not user_id:
        return

    # 🔑 更新用户套餐为 VIP
    await db.execute(
        "UPDATE users SET plan_id = 'vip', updated_at = ? WHERE id = ?",
        (now, user_id)
    )

    # 🔑 保存 Stripe Customer ID（后续关单/退款需要）
    customer_id = _sget(session, "customer")
    if customer_id:
        await db.execute(
            "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
            (customer_id, user_id)
        )

    # 🔑 创建/更新订阅记录
    subscription_id = _sget(session, "subscription")
    if subscription_id:
        # 从 Stripe 获取订阅详情（周期起止时间）
        sub_info = stripe.Subscription.retrieve(subscription_id)
        # ... 写入 subscriptions 表 ...

    # 📝 记录支付日志
    log_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO payment_logs (id, user_id, stripe_event_id, amount_total, ...) VALUES (...)",
        (log_id, user_id, ...)
    )
```

### 7.6 ⚠️ StripeObject 取值陷阱

Stripe Python SDK 返回的对象**不是普通 dict**，不能用 `.get()` 方法：

```python
# ❌ 错误写法（Stripe Python SDK 15.x 不支持）
session.get("metadata", {}).get("user_id")
# → AttributeError: get

# ✅ 正确写法
def _sget(obj, key, default=None):
    try:
        return obj[key]
    except (KeyError, TypeError):
        return default

user_id = _sget(_sget(session, "metadata", {}), "user_id")
```

---

## 8. 第五步：套餐权限控制

### 8.1 套餐限制常量

文件：`app/models/user.py`

```python
PLAN_LIMITS = {
    "free": {
        "daily_downloads": 3,       # 每天 3 次下载
        "max_quality": "720p",      # 最高 720p 清晰度
        "subtitle_download": False, # 不能下载字幕
        "max_concurrent": 1,        # 同时只能下载 1 个
    },
    "vip": {
        "daily_downloads": 50,      # 每天 50 次
        "max_quality": "4K",        # 最高 4K
        "subtitle_download": True,  # 可以下载字幕
        "max_concurrent": 3,        # 同时下载 3 个
    },
}
```

### 8.2 在下载接口中检查权限

文件：`app/api/download.py`

```python
@router.post("")
async def create_download_task(
    req: DownloadRequest,
    user: dict | None = Depends(get_optional_user),  # 可选登录
):
    # 确定用户套餐
    user_id = user["sub"] if user else None
    plan_id = "free"
    if user_id:
        # 从数据库查最新套餐（因为可能刚通过 Webhook 升级了）
        row = await db.execute("SELECT plan_id FROM users ...").fetchone()
        plan_id = row["plan_id"] if row else "free"

    limits = PLAN_LIMITS[plan_id]

    # ❶ 每日下载次数限制
    if user_id:
        count = await get_daily_count(db, user_id)
        if count >= limits["daily_downloads"]:
            raise HTTPException(429, "今日下载次数已达上限，请升级VIP")

    # ❷ 字幕下载权限
    if req.subtitles and not limits["subtitle_download"]:
        raise HTTPException(403, "字幕下载是VIP专属功能")

    # ❸ 清晰度限制
    req_quality_height = {"720p": 720, "1080p": 1080, "4K": 2160}[req.quality]
    max_height = {"720p": 720, "4K": 2160}[limits["max_quality"]]
    if req_quality_height > max_height:
        raise HTTPException(403, "当前套餐最高支持 " + limits["max_quality"])
```

---

## 9. 第六步：前端支付流程

### 9.1 前端请求封装

文件：`web/src/lib/api.ts`

```typescript
const API_BASE = "/api";  // Next.js 自动代理到 localhost:8000

// 自动带 Token
function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 自动清 Token 跳登录
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  // 安全 JSON 解析
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.substring(0, 200));
  }
}

// 对外暴露的 API
export const api = {
  register: (email, pw) => request("/auth/register", { method: "POST", ... }),
  login: (email, pw)    => request("/auth/login", { method: "POST", ... }),
  getMe: ()             => request("/auth/me"),
  createCheckout: (planId) => request("/payment/create-checkout", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      success_url: window.location.origin + "/success",
      cancel_url: window.location.origin + "/",
    }),
  }),
};
```

### 9.2 全局认证状态管理

文件：`web/src/contexts/AuthContext.tsx`

```typescript
// 整个应用通过 useAuth() 获取用户状态
export function useAuth() {
  return {
    user,           // { email, plan_id, ... }  或 null
    subscription,   // { daily_download_count, status, ... }
    loading,        // 是否正在加载
    login(),
    register(),
    logout(),
    refresh(),      // 支付成功后调用，重新获取最新状态
  };
}

// 包装整个应用
// app/layout.tsx: <AuthProvider><html>...</html></AuthProvider>
```

关键生命周期：
```
页面加载 → AuthProvider 挂载
    → 读 localStorage 中的 token
    → 有 token → 调 GET /api/auth/me → 获取 user + subscription
    → 无 token → 直接显示未登录态
```

### 9.3 订阅套餐卡片

文件：`web/src/components/PricingCard.tsx`

```typescript
export default function PricingCard() {
  const { user } = useAuth();

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      router.push("/login");   // 没登录 → 先去登录
      return;
    }
    if (user.plan_id === "vip") {
      setError("您已是 VIP 会员");
      return;
    }

    // 调后端创建支付会话，拿到 checkout_url
    const res = await api.createCheckout(planId);
    if (res.code === 0 && res.data.checkout_url) {
      window.location.href = res.data.checkout_url;  // 跳转到 Stripe 支付页
    }
  };

  // 按钮文案根据登录状态和套餐动态变化：
  // 未登录 → "立即订阅"（点击跳登录）
  // 免费用户 → "立即订阅"（点击创建支付）
  // VIP 用户 → "已是 VIP"（禁用按钮）
}
```

### 9.4 支付成功回调页

文件：`web/src/app/success/page.tsx`

```typescript
export default function SuccessPage() {
  const { user, refresh } = useAuth();

  useEffect(() => {
    // 等待 3 秒给 Webhook 处理时间，然后刷新用户状态
    const timer = setTimeout(() => refresh(), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {user?.plan_id === "vip"
        ? "🎉 您已是 VIP 会员，立即体验高级功能吧！"
        : "处理中，请稍候刷新..."}
    </div>
  );
}
```

### 9.5 前端如何与后端通信（Next.js 代理）

Next.js 配置了 API 代理，`/api/*` 自动转发到 `localhost:8000/api/*`：

```js
// next.config.js 或类似配置
rewrites: async () => [
  { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }
]
```

这样前端只需写 `/api/xxx`，不用担心跨域问题。

---

## 10. 第七步：用户身份展示

### 10.1 Header 导航栏

未登录 → 显示「登录」「注册」按钮
已登录 → 显示身份徽章 + 邮箱（可点进账号页）

```typescript
// 免费用户
<span className="bg-gray-400 text-white rounded-full">免费用户</span>

// VIP 用户
<span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full">
  VIP 会员
</span>
```

### 10.2 ParseBar 配额提示

在解析框下方显示剩余下载次数：

```
未登录   → "未登录 · 每日免费 3 次"
免费用户 → "● 今日剩余 2/3 次"
VIP用户  → "● 今日剩余 48/50 次"
```

### 10.3 账号详情页 (`/account`)

显示完整信息：邮箱、当前套餐、到期时间、已用/总下载次数、升级按钮。

---

## 11. 开发调试指南

### 11.1 启动项目

```bash
# 终端 1：后端
cd rice-video
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 终端 2：前端
cd rice-video/web
npm run dev

# 终端 3：Stripe Webhook 转发（开发必须！）
stripe listen --forward-to localhost:8000/api/payment/webhook

# 浏览器访问 http://localhost:3000
```

### 11.2 完整支付测试流程

```
1. 注册账号 → POST /api/auth/register
2. 点击「立即订阅」→ 调用 /api/payment/create-checkout
3. 跳转到 Stripe 支付页 → 输入测试卡号 4242 4242 4242 4242
4. 支付成功 → Stripe 发送 Webhook → 后台升级 VIP
5. 页面跳转到 /success → 3 秒后刷新 → 显示 VIP 徽章
```

### 11.3 测试 Webhook 是否正常

```bash
# 查看最近的事件
stripe events list --limit 10

# 手动重放失败的事件
stripe events resend evt_xxxxx

# 查看后端日志
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer <token>"
```

### 11.4 测试安装 Stripe CLI

```bash
brew install stripe       # macOS
stripe login              # 绑定 Stripe 账号
stripe listen --forward-to localhost:8000/api/payment/webhook
```

---

## 12. 实战踩坑记录

以下是开发过程中遇到的真实 Bug 及解决方案：

### 12.1 数据库缺失 stripe_customer_id 列

**现象**：点击「立即订阅」后端 500。
**原因**：旧数据库在支付系统接入前创建，`CREATE TABLE IF NOT EXISTS` 不会补齐新列。
**修复**：新增 `_run_migrations()` 自动检测并 `ALTER TABLE ADD COLUMN`。

### 12.2 幂等性表列名写错

**现象**：Webhook 全部 500，重试 10 次全失败。
**错误**：`SELECT id FROM idempotency_records` → 实际列名是 `idempotency_key`。
**修复**：改为 `SELECT 1 FROM idempotency_records WHERE idempotency_key = ?`。

### 12.3 Stripe Python SDK 不支持 .get()

**现象**：`AttributeError: get`。
**原因**：Stripe SDK 15.x 的 `StripeObject` 只能用 `[]` 取值。
**修复**：封装 `_sget()` 函数，内部用 try/except。

### 12.4 新订阅 current_period_start 为 None

**现象**：`KeyError: 'current_period_start'`。
**原因**：新创建的订阅首次发票未支付时，这两个字段为 null。
**修复**：fallback 到 `created` 时间，end = start + 30 天。

### 12.5 Webhook 订阅记录重复插入

**现象**：同一用户数据库里有多条 subscription 记录。
**原因**：每次都用 `INSERT OR REPLACE` + 新 UUID。
**修复**：改为先 UPDATE，`rowcount == 0` 再 INSERT。

### 12.6 前端 API 非 JSON 响应无报错

**现象**：后端返回 HTML/文本时，前端只显示「网络错误，请稍后重试」。
**原因**：`res.json()` 解析失败直接进 catch，丢失了真实错误信息。
**修复**：先 `res.text()`，再 try `JSON.parse()`，失败时抛出文本内容。

---

## 13. 附录：完整文件清单

| 文件 | 行数 | 作用 |
|------|------|------|
| `.env.example` | 5 | 环境变量模板 |
| `app/api/auth.py` | 70 | 注册 / 登录 / 获取用户信息 |
| `app/api/payment.py` | 200 | 创建支付会话 + Webhook 处理 |
| `app/api/download.py` | 173 | 下载接口 + 套餐权限检查 |
| `app/core/config.py` | 31 | 读取环境变量 |
| `app/core/database.py` | 100 | SQLite 初始化 + 迁移 |
| `app/core/security.py` | 50 | JWT + 密码哈希 |
| `app/models/user.py` | 60 | 数据模型 + 套餐限制常量 |
| `app/main.py` | 40 | FastAPI 应用入口 |
| `web/src/lib/api.ts` | 70 | 前端统一请求封装 |
| `web/src/contexts/AuthContext.tsx` | 120 | 全局登录状态 |
| `web/src/components/PricingCard.tsx` | 160 | 定价卡片 |
| `web/src/components/Header.tsx` | 60 | 导航栏 + 用户徽章 |
| `web/src/components/ParseBar.tsx` | 90 | 解析栏 + 配额提示 |
| `web/src/app/login/page.tsx` | 60 | 登录页 |
| `web/src/app/register/page.tsx` | 80 | 注册页 |
| `web/src/app/account/page.tsx` | 110 | 账号详情页 |
| `web/src/app/success/page.tsx` | 60 | 支付成功页 |

---

> 文档版本：v1.0 | 更新日期：2026-05-01
> 配套项目：[rice-video](https://github.com/shilianjie/rice-video)
