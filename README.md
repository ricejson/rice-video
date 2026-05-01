<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<h1 align="center">🎬 Rice Video</h1>
<p align="center"><strong>万能视频下载器 · 支持 1700+ 平台 · 免费下载 · AI 智能总结</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/平台-1700+-emerald" alt="Platforms">
  <img src="https://img.shields.io/badge/清晰度-最高_4K-blue" alt="Quality">
  <img src="https://img.shields.io/badge/AI-阿里云百炼-orange" alt="AI">
  <img src="https://img.shields.io/badge/支付-Stripe-635BFF?logo=stripe" alt="Stripe">
</p>

---

## 📖 项目简介

Rice Video 是一款轻量级的多平台视频下载工具，粘贴视频链接即可一键下载，并提供 **AI 视频总结**、**思维导图**、**AI 问答**等智能功能。

- 🎯 **免费下载**：视频下载完全免费，不限次数、不限清晰度
- 🧠 **AI 总结**：基于阿里云百炼大模型，自动生成视频摘要、思维导图、对话问答
- 🌍 **1700+ 平台**：基于 yt-dlp，支持 YouTube、Bilibili、抖音、TikTok 等主流平台
- 💳 **会员体系**：Stripe 支付集成，VIP 用户享每日 50 次 AI 总结

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📥 **视频下载** | 粘贴链接即可下载，支持 720p / 1080p / 4K |
| 📋 **视频解析** | 提取标题、封面、描述、时长、作者、平台等信息 |
| 📝 **字幕提取** | 下载原始字幕 / 自动生成字幕，支持弹幕提取 |
| 🤖 **AI 一键总结** | 自动生成视频内容摘要，SSE 流式输出 |
| 🧠 **思维导图** | 自动构建视频知识结构导图 |
| 💬 **AI 问答** | 基于视频内容的多轮对话问答 |
| 🎨 **播放列表** | 支持批量下载播放列表，可选择特定视频 |
| 👤 **用户系统** | 邮箱注册 / 登录，JWT 认证 |
| 💰 **会员订阅** | Stripe 支付，VIP 享更高 AI 配额 |

---

## 🛠 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端框架** | FastAPI (Python) | 0.109 |
| **前端框架** | Next.js (React) | 16.2 / 19.2 |
| **样式方案** | Tailwind CSS | v4 |
| **视频引擎** | yt-dlp | 2025.4.30 |
| **AI 服务** | 阿里云百炼 DashScope | qwen-max |
| **数据库** | SQLite (aiosqlite) | — |
| **认证** | JWT (python-jose + bcrypt) | — |
| **支付** | Stripe Checkout + Webhook | — |
| **HTTP 客户端** | httpx | 0.26 |
| **媒体处理** | FFmpeg | — |

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- FFmpeg（系统级安装）

### 1. 克隆项目

```bash
git clone https://github.com/your-username/rice-video.git
cd rice-video
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入必要的 API Key：

```bash
# 必填：阿里云百炼 API Key（AI 总结功能）
# 获取地址：https://bailian.console.aliyun.com/
ALIYUN_API_KEY=sk-xxxxxxxxxxxxxxxx

# 必填：JWT 密钥（生产环境请更换）
SECRET_KEY=your-secret-key-change-in-production

# 可选：Stripe 支付（不填则仅支持免费功能）
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_VIP_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxx
```

> 如果不需要支付功能，Stripe 相关配置可以留空，应用正常运行但无 VIP 订阅入口。

### 3. 安装依赖

```bash
# Python 依赖
pip install -r requirements.txt

# Node.js 依赖
cd web && npm install && cd ..
```

### 4. 启动服务

```bash
# 一键启动（后端 + 前端）
./start.sh
```

或分别启动：

```bash
# 终端 1：后端（端口 8000）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 终端 2：前端（端口 3000）
cd web && npm run dev
```

### 5. 访问

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 前端界面 |
| http://localhost:8000 | 后端 API |
| http://localhost:8000/docs | Swagger API 文档 |

---

## 📡 API 概览

### 视频解析 & 下载

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|:---:|
| POST | `/api/parse` | 提交视频解析任务 | — |
| GET | `/api/parse/{task_id}` | 查询解析进度 | — |
| POST | `/api/download` | 提交下载任务 | — |
| GET | `/api/download/status/{task_id}` | 查询下载进度 | — |
| GET | `/api/download/file/{task_id}` | 获取视频文件 | — |

### AI 总结

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|:---:|
| POST | `/api/summarize/stream` | SSE 流式文本总结 + 思维导图 | ✅ |
| POST | `/api/summarize/chat` | AI 对话问答 | ✅ |
| GET | `/api/summarize/{task_id}` | 获取历史总结结果 | — |

### 用户 & 支付

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|:---:|
| POST | `/api/auth/register` | 邮箱注册 | — |
| POST | `/api/auth/login` | 登录获取 JWT | — |
| GET | `/api/auth/me` | 获取用户信息 & 配额 | ✅ |
| GET | `/api/subscribe/plans` | 获取套餐列表 | — |
| POST | `/api/payment/create-checkout` | 创建 Stripe 支付 | ✅ |

---

## 📂 项目结构

```
rice-video/
├── app/                          # Python 后端
│   ├── main.py                   # FastAPI 入口，CORS，路由
│   ├── api/
│   │   ├── download.py           # 下载端点
│   │   ├── parse.py              # 解析端点
│   │   ├── summarize.py          # AI 总结端点（SSE 流式）
│   │   ├── auth.py               # 认证端点
│   │   ├── payment.py            # Stripe 支付端点
│   │   └── subscribe.py          # 套餐端点
│   ├── models/
│   │   ├── task.py               # 任务数据模型
│   │   └── user.py               # 用户模型 + 配额常量
│   ├── services/
│   │   ├── downloader.py         # yt-dlp 封装
│   │   └── summarizer.py         # AI 调用 + 字幕提取
│   └── core/
│       ├── config.py             # 环境变量配置
│       ├── database.py           # SQLite + 迁移
│       └── security.py           # JWT + 密码加密
├── web/                          # Next.js 前端
│   ├── src/
│   │   ├── app/                  # 页面路由
│   │   │   ├── page.tsx          # 首页
│   │   │   ├── login/            # 登录页
│   │   │   ├── register/         # 注册页
│   │   │   ├── account/          # 账户页
│   │   │   └── success/          # 支付成功页
│   │   ├── components/
│   │   │   ├── DownloadCard.tsx  # 核心流程编排
│   │   │   ├── ParseBar.tsx      # URL 输入 & 配额展示
│   │   │   ├── SummaryCard.tsx   # AI 总结展示
│   │   │   ├── ChatPanel.tsx     # AI 问答面板
│   │   │   ├── MindMapViewer.tsx # 思维导图渲染
│   │   │   ├── PricingCard.tsx   # 套餐卡片
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # 认证状态管理
│   │   └── lib/
│   │       └── api.ts            # API 客户端
│   └── next.config.ts            # API 代理配置
├── downloads/                    # 视频下载目录
├── data/                         # SQLite 数据库
├── docs/                         # 文档
├── requirements.txt              # Python 依赖
├── .env.example                  # 环境变量模板
├── start.sh                      # 一键启动脚本
└── README.md
```

---

## 🔧 配置详解

### 阿里云百炼（AI 功能）

AI 总结、思维导图、问答功能使用阿里云百炼大模型平台。需要：

1. 注册 [阿里云百炼](https://bailian.console.aliyun.com/)
2. 开通 DashScope 服务，获取 API Key
3. 填入 `.env` 中的 `ALIYUN_API_KEY`

未配置时，前端会显示「API Key 未配置」的友好提示，不影响下载功能。

### Stripe 支付（可选）

如需 VIP 订阅功能：

1. 注册 [Stripe](https://dashboard.stripe.com/) 账号
2. 创建 Product → 获取 Price ID，填入 `STRIPE_VIP_PRICE_ID`
3. 获取 API Keys 填入 `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`
4. 本地测试 Webhook：
   ```bash
   stripe listen --forward-to localhost:8000/api/payment/webhook
   ```
   将输出的 `whsec_xxx` 填入 `STRIPE_WEBHOOK_SECRET`

### 配额体系

| 权益 | 免费用户 | VIP 会员 |
|------|:---:|:---:|
| 视频下载 | 无限 | 无限 |
| 最高清晰度 | 4K | 4K |
| AI 总结（每天） | 3 次 | 50 次 |
| 价格 | 免费 | ¥9.9/月 |

---

## 🏗 架构说明

```
浏览器 (localhost:3000)
    │
    ├── /api/parse, /api/download, ...
    │   └── Next.js Rewrite Proxy ──► FastAPI (localhost:8000)
    │
    └── /api/summarize/stream (SSE)
        └── 直连 FastAPI ──► 阿里云百炼 (DashScope)
                              │
FastAPI  ◄────────────────────┘
    │
    ├── yt-dlp (线程池) ──► 视频下载 & 字幕提取
    ├── SQLite ──► 用户 & 订阅 & 支付记录
    ├── DashScope ──► AI 文本生成 (qwen-max)
    └── Stripe API ──► 支付 & 订阅管理
```

- **SSE 流式输出** 绕过 Next.js 代理直接连接后端，避免缓冲延迟
- **yt-dlp** 在独立线程池中运行（最多 3 个并发），防止阻塞事件循环
- **下载任务** 存储在内存中，不持久化；用户和订阅数据存储在 SQLite

---

## 🚢 部署

### Docker（推荐）

```dockerfile
# 后端 Dockerfile (app/Dockerfile)
FROM python:3.10-slim
RUN apt-get update && apt-get install -y ffmpeg
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# 前端 Dockerfile (web/Dockerfile)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### 环境变量

生产环境请确保设置：

```bash
SECRET_KEY=<random-64-char-string>
ALIYUN_API_KEY=sk-xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_VIP_PRICE_ID=price_xxx
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

```bash
# 开发分支
git checkout -b feat/your-feature

# 提交规范
feat: 新功能
fix: 问题修复
docs: 文档更新
refactor: 代码重构
```

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — 强大的视频下载引擎
- [FastAPI](https://fastapi.tiangolo.com/) — 高性能 Python Web 框架
- [Next.js](https://nextjs.org/) — React 全栈框架
- [阿里云百炼](https://bailian.console.aliyun.com/) — AI 大模型服务
- [Stripe](https://stripe.com/) — 全球支付解决方案
