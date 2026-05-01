# 万能视频下载器 部署上线方案

> 部署方案 | v3.0 Cloudflare Tunnel | 2026-05-01

---

## 一、部署目标

将「万能视频下载器」从本地开发环境部署到公网，用户可通过公网 URL 直接访问完整网站。

### 核心要求
- **完全免费**：不产生任何费用
- **无需信用卡**：不绑定任何支付方式
- **公网可访问**：提供可访问的 URL
- **功能完整**：视频下载、解析、AI 总结、支付等全部功能可用

---

## 二、方案选型过程

### 2.1 尝试过的方案及失败原因

| 序号 | 方案 | 失败原因 |
|------|------|---------|
| 1 | Render (Docker) | **免费层需要信用卡验证**（临时授权 $1） |
| 2 | Vercel (前端) + Render (后端) | **Vercel 不支持该邮箱域名注册**（地区限制） |
| 3 | Hugging Face Spaces (Docker) | **创建 Space 返回 418 错误**（地区限制） |
| 4 | Render Blueprint 一键部署 | 同方案 1，信用卡问题 |

### 2.2 最终方案：Cloudflare Tunnel

Cloudflare Tunnel 是 Cloudflare 提供的免费内网穿透工具，无需注册账号、无需信用卡、无地区限制。

```
用户浏览器
    │
    ▼
https://<random>.trycloudflare.com  (公网 URL)
    │
    │  Cloudflare 全球网络
    │
    ▼
┌──────────────────────────────────────────┐
│         本地机器 (localhost:8000)           │
│                                           │
│   FastAPI (uvicorn)                       │
│   ├── /api/*        → API 路由             │
│   ├── /_next/*      → Next.js 静态资源      │
│   ├── /docs         → Swagger API 文档      │
│   └── /*            → 前端页面 (兜底路由)     │
│                                           │
│   依赖: Python 3.9+ + ffmpeg + yt-dlp      │
│   前端: Next.js 16 output:"export" 静态导出  │
└──────────────────────────────────────────┘
```

### 2.3 Cloudflare Tunnel 特点

| 维度 | 说明 |
|------|------|
| 费用 | 完全免费 |
| 信用卡 | 不需要 |
| 账号 | 快速隧道无需注册 |
| 带宽 | 无限制 |
| HTTPS | 自动提供 SSL 证书 |
| 延迟 | 通过 Cloudflare 全球网络加速 |
| 限制 | URL 随机且临时（重启后变化），需本地机器保持运行 |

---

## 三、代码改造

### 3.1 架构调整：单服务器

原先的前后端分离架构（Next.js dev server :3000 + FastAPI :8000）改为单服务器架构：

- **FastAPI 同时提供 API 和前端静态文件**
- **Next.js 改为静态导出** (`output: "export"`)，不再需要 Node.js 运行时
- **所有 API 调用使用同源相对路径** `/api/*`，无 CORS 问题
- **SSE 流式总结不再需要绕过代理**，同服务器直连

### 3.2 Next.js 静态导出

```typescript
// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",           // 生成静态 HTML/CSS/JS
  images: {
    unoptimized: true,        // 静态导出不支持图片优化
  },
};

export default nextConfig;
```

构建产物输出到 `web/out/`，包含所有页面的 `.html` 文件和 `_next/static/` 资源。

### 3.3 FastAPI 托管前端静态文件

```python
# app/main.py 关键逻辑

# 1. API 路由先注册（优先级最高）
app.include_router(download.router)   # /api/download/*
app.include_router(parse.router)      # /api/parse/*
# ... 其他 API 路由

# 2. 静态资源挂载
app.mount("/_next", StaticFiles(directory=str(_next_dir)))

# 3. 前端页面兜底路由（最后注册，优先级最低）
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # /login → login.html, /register → register.html 等
    ...
```

静态文件目录自动检测逻辑：
- Docker 部署 → `static/`（多阶段构建产物复制目标）
- 本地开发 → `web/out/`（Next.js 构建产物）

### 3.4 前端 API 调用

所有 API 调用使用相对路径，与服务器同源：

| 位置 | 调用方式 |
|------|---------|
| `web/src/lib/api.ts` | `const API_BASE = "/api"` |
| `DownloadCard.tsx` SSE 流 | `fetch("/api/summarize/stream", ...)` |
| `DownloadCard.tsx` 解析/下载 | `fetch("/api/parse", ...)` 等 |
| `ChatPanel.tsx` AI 对话 | `fetch("/api/summarize/chat", ...)` |

### 3.5 Docker 多阶段构建

```
Stage 1: node:20-alpine
  ├── npm ci
  ├── npm run build          → 生成 web/out/
  └── 产物: /frontend/out/

Stage 2: python:3.10-slim
  ├── apt-get install ffmpeg
  ├── pip install -r requirements.txt
  ├── COPY app/ → app/
  ├── COPY --from=frontend /frontend/out/ → static/
  └── CMD: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}
```

Docker 镜像默认端口 7860（兼容 Hugging Face Spaces），生产环境通过 `PORT` 环境变量覆盖。

---

## 四、部署步骤（Cloudflare Tunnel）

### 步骤 1：构建前端静态文件

```bash
cd web
npm install
npm run build        # 输出到 web/out/
```

### 步骤 2：启动后端服务

```bash
cd /path/to/rice-video
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

验证：`curl http://localhost:8000/health` → `{"status":"ok"}`

### 步骤 3：安装 cloudflared

```bash
brew install cloudflared
```

或从 https://github.com/cloudflare/cloudflared/releases 下载对应平台二进制文件。

### 步骤 4：创建隧道

```bash
cloudflared tunnel --url http://localhost:8000
```

输出示例：
```
Your quick Tunnel has been created! Visit it at:
https://xxxxxxxx-yyyy-zzzz.trycloudflare.com
```

### 步骤 5：访问公网 URL

浏览器打开输出的 `https://*.trycloudflare.com` 地址即可。

### 一键启动脚本

```bash
#!/bin/bash
# deploy.sh - 构建前端 + 启动后端 + 创建隧道

set -e

echo "=== 构建前端 ==="
cd web && npm run build && cd ..

echo "=== 启动后端 ==="
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3

echo "=== 创建公网隧道 ==="
cloudflared tunnel --url http://localhost:8000
```

---

## 五、线上测试验证结果

### 5.1 测试通过清单

| # | 测试项 | 方法 | 结果 |
|---|--------|------|------|
| 1 | 健康检查 | `GET /health` | `{"status":"ok"}` |
| 2 | 首页加载 | `GET /` | 200 OK, 标题正确 |
| 3 | 登录页面 | `GET /login` | 200 OK |
| 4 | 注册页面 | `GET /register` | 200 OK |
| 5 | 账户页面 | `GET /account` | 200 OK |
| 6 | 静态资源 | `GET /_next/static/*` | 200 OK, CSS/JS 正常 |
| 7 | 用户注册 | `POST /api/auth/register` | 返回 JWT Token |
| 8 | 用户登录 | `POST /api/auth/login` | 验证密码, 返回 Token |
| 9 | 用户信息 | `GET /api/auth/me` | 返回用户和订阅信息 |
| 10 | 套餐列表 | `GET /api/subscribe/plans` | 返回 free + vip 套餐 |
| 11 | 视频解析 | `POST /api/parse` | 创建解析任务成功 |
| 12 | API 文档 | `GET /docs` | Swagger UI 正常 |

### 5.2 截图验证

- 首页 (`rice-final-homepage.png`, 143KB): 完整渲染，包含 Header、输入框、套餐卡片
- 登录页 (`rice-final-login.png`, 39KB): 邮箱/密码表单正常
- API 文档 (`rice-final-docs.png`, 225KB): Swagger UI 完整加载

---

## 六、遇到的问题及修复

### 6.1 部署平台兼容性

| 问题 | 平台 | 现象 | 解决方案 |
|------|------|------|---------|
| 信用卡要求 | Render | 免费层需 $1 验证 | 放弃 Render |
| 邮箱限制 | Vercel | "Invalid email domain" | 放弃 Vercel |
| 地区限制 | Hugging Face | 418 错误 | 放弃 HF |
| 最终选择 | Cloudflare | 无需账号/信用卡 | ✅ |

### 6.2 代码兼容性问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 注册接口 500 错误 | `bcrypt==5.0.0` 移除了 `__about__` 属性，`passlib` 不兼容 | `requirements.txt` 锁定 `bcrypt<5.0` |
| Python 3.9 启动失败 | `X \| None` 联合类型语法需要 Python 3.10+ | 改为 `Optional[X]` |
| Docker 构建失败 | `.dockerignore` 排除了 `web/` 目录，多阶段构建第一阶段无法复制 | 改为 `web/node_modules` 排除 |
| 前端 404 | `STATIC_DIR` 硬编码为 `static/`，本地不存在 | 增加 `web/out/` 自动检测 |

---

## 七、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `Dockerfile` | 多阶段构建：Node 前端 + Python 后端 |
| 新建 | `.dockerignore` | Docker 构建排除文件 |
| 新建 | `render.yaml` | Render Blueprint 配置（备用） |
| 修改 | `.gitignore` | 添加 .env / \_\_pycache\_\_ / data / static |
| 修改 | `web/next.config.ts` | `output: "export"` 静态导出 |
| 修改 | `app/main.py` | 托管前端静态文件 + STATIC_DIR 自动检测 |
| 修改 | `app/core/database.py` | `Optional[X]` 替代 `X \| None` |
| 修改 | `requirements.txt` | 锁定 `bcrypt<5.0` |
| 修改 | `web/src/components/DownloadCard.tsx` | SSE 同源调用 |
| 修改 | `web/src/components/ChatPanel.tsx` | API 相对路径 |

---

## 八、升级到永久部署

当前方案依赖本地机器运行，适合开发和演示。如需 **7×24 永久部署**，推荐以下路径：

### 方案 A：Cloudflare 命名隧道（推荐）

1. 注册 Cloudflare 账号（免费，支持的邮箱较广）
2. 创建命名隧道：`cloudflared tunnel create rice-video`
3. 配置 DNS 指向隧道
4. 绑定自定义域名，获得永久 URL

优点：仍免费，URL 不变，可配置自定义域名。

### 方案 B：Docker 部署到云服务器

项目已提供完整 `Dockerfile`，可部署到任意支持 Docker 的平台：

- **阿里云 ECS**（国内首选，需实名认证）
- **腾讯云 Lighthouse**
- **AWS EC2**（12 个月免费层，需信用卡）
- **Oracle Cloud**（永久免费 ARM 实例，需信用卡）

Docker 部署命令：
```bash
docker build -t rice-video .
docker run -d -p 8000:8000 \
  -e SECRET_KEY=xxx \
  -e ALIYUN_API_KEY=xxx \
  rice-video
```

### 方案 C：第三方 PaaS（持续关注）

随着新平台出现，可关注以下免费 Docker 托管服务：
- 新的 Render 替代品（不要求信用卡）
- 国内 Serverless 平台的容器支持
- 开源 PaaS（如 CapRover、Dokploy 自建）

---

## 九、本地开发

日常开发仍使用原有方式：

```bash
# 启动后端 (FastAPI, port 8000)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 启动前端 (Next.js dev server, port 3000, 代理 API 到 8000)
cd web && npm run dev
```

前端开发模式自动通过 Next.js rewrites 代理 `/api/*` 到 `localhost:8000`。

生产部署时，前端 `npm run build` 静态导出，由 FastAPI 统一托管。
