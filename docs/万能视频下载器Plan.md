# 万能视频下载器 实现方案

> 实施方案 | 基于 Research v1.0 | 2026-04-19

---

## 一、方案概述

### 1.1 产品定位
一款**轻量级多平台视频下载工具**，面向有批量下载视频需求的用户（内容创作者、教育工作者、普通用户），提供视频下载、字幕处理、AI 总结等能力。

### 1.2 核心功能
| 功能 | 优先级 | 说明 |
|------|--------|------|
| 视频下载 | P0 | 核心功能，支持 1700+ 平台 |
| 字幕下载/翻译 | P1 | 基于 yt-dlp 字幕能力 |
| 视频总结 | P2 | AI 能力，调用外部服务 |
| 付费功能 | P3 | 盈利模式 |

### 1.3 设计原则
- **轻量后端**：无数据库，使用内存 + Redis
- **开源复用**：直接使用 yt-dlp，代码改动最小化
- **付费导向**：UI 设计突出付费转化

---

## 二、技术架构

### 2.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
└─────────────────────────┬─────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼─────────────────────────────┐
│                    前端 (Next.js)                        │
│  - 视频链接输入                                          │
│  - 下载进度展示                                           │
│  - 订阅套餐展示                                           │
│  - 支付模块集成                                           │
└─────────────────────────┬─────────────────────────────┘
                          │ HTTP API
┌─────────────────────────▼─────────────────────────────┐
│              Python 后端 (FastAPI)                       │
│  - 轻量无数据库                                         │
│  - 直接调用 yt-dlp（import yt_dlp）                    │
│  - 任务队列（并发控制）                                   │
└───────────┬─────────────────────────┬───────────────────┘
            │ 直接调用               │ HTTP API
┌───────────▼───────────┐    ┌───────▼───────────────────┐
│      yt-dlp           │    │   AI 服务                 │
│   (Python 原生)       │    │   - 阿里云百炼            │
│   - 视频下载           │    │   - OpenAI (备选)         │
│   - 字幕处理           │    └───────────────────────────┘
└───────────────────────┘
```

> 📊 **架构图文件**：[万能视频下载器_架构图.excalidraw](./万能视频下载器_架构图.excalidraw)
> 可在 https://excalidraw.com 中导入查看

### 2.2 技术栈选择

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| **前端** | Next.js + Tailwind CSS | React 生态完善，样式参考 Research |
| **后端** | Python (FastAPI) | 轻量、yt-dlp 原生集成、无数据库友好 |
| **视频下载** | yt-dlp (Python) | 1700+ 平台支持，直接调用无需封装 |
| **AI 服务** | 阿里云百炼 (+ OpenAI 备选) | 阿里云百炼国内访问稳定 |
| **文件存储** | 本地临时存储 | 轻量优先，用户直接下载 |
| **状态存储** | 内存 / Redis | 轻量，无需数据库 |
| **支付** | 微信/支付宝沙箱 | 模拟支付，后续接入真实支付 |

### 2.3 目录结构
```
rice-video/
├── app/
│   ├── main.py              # FastAPI 后端入口
│   ├── api/
│   │   ├── download.py      # 下载相关接口
│   │   ├── task.py          # 任务状态接口
│   │   └── subscribe.py    # 订阅相关接口
│   ├── services/
│   │   ├── downloader.py   # yt-dlp 直接调用
│   │   └── translator.py   # AI 翻译服务
│   ├── models/
│   │   └── task.py          # 任务模型
│   └── core/
│       ├── config.py        # 配置管理
│       └── security.py      # JWT 安全
├── web/                     # 前端 (Next.js)
│   ├── app/
│   │   ├── page.tsx         # 首页
│   │   └── layout.tsx       # 布局
│   ├── components/
│   │   ├── DownloadCard.tsx
│   │   ├── PricingCard.tsx
│   │   ├── Header.tsx
│   │   └── ProgressBar.tsx
│   └── styles/
│       └── globals.css
├── requirements.txt         # Python 依赖
├── docs/
│   ├── 万能视频下载器Plan.md
│   └── 万能视频下载器Research.md
└── README.md
```

### 2.4 Python 依赖

```txt
# requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
yt-dlp==2024.02.10
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
redis==5.0.1
httpx==0.26.0
ffmpeg-python==0.2.0
```

---

## 三、功能模块详细设计

### 3.1 视频下载模块（P0）

#### 3.1.1 用户流程
```
用户输入 URL → FastAPI 解析 → 直接调用 yt_dlp → 返回文件/进度
```

> 📊 **流程图文件**：[万能视频下载器_流程图.excalidraw](./万能视频下载器_流程图.excalidraw)
> 可在 https://excalidraw.com 中导入查看

**流程说明**：
1. 用户在前端输入视频 URL
2. 前端发送 `POST /api/download` 请求
3. FastAPI 后端接收请求，生成 task_id
4. 后端调用 yt-dlp 开始下载（直接 `import yt_dlp`）
5. yt-dlp 通过 `progress_hooks` 推送下载进度
6. 后端通过 **Server-Sent Events (SSE)** 将进度推送给前端
7. 下载完成后，后端返回文件路径
8. 前端提供文件下载或在线播放

#### 3.1.2 API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /api/download` | POST | 提交下载任务 |
| `GET /api/download/status/{task_id}` | GET | 查询任务状态 |
| `GET /api/download/progress/{task_id}` | GET | 获取下载进度（Server-Sent Events） |
| `GET /api/download/file/{task_id}` | GET | 下载文件 |

#### 3.1.3 请求/响应示例

```json
// POST /api/download
// Request
{
  "url": "https://www.youtube.com/watch?v=xxx",
  "quality": "best",
  "format": "mp4",
  "subtitles": true,
  "translate": false
}

// Response
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "uuid-xxx",
    "status": "pending"
  }
}
```

#### 3.1.4 yt-dlp 直接调用（Python）

由于后端使用 Python，可以**直接导入 yt-dlp 模块**，无需额外封装：

```python
# app/services/downloader.py
import yt_dlp
import asyncio
import uuid
from typing import AsyncGenerator
from pathlib import Path

class VideoDownloader:
    def __init__(self, download_dir: str = "/tmp/downloads"):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.tasks = {}  # 内存存储任务状态

    async def download(
        self,
        url: str,
        task_id: str,
        quality: str = "best",
        subtitles: bool = False,
        translate: bool = False
    ) -> AsyncGenerator[dict, None]:
        """异步下载视频，实时推送进度"""

        # 构建格式参数
        if quality == "best":
            format_spec = "bestvideo+bestaudio/best"
        else:
            height = quality.replace("p", "")
            format_spec = f"bestvideo[height<={height}]+bestaudio/best"

        ydl_opts = {
            "format": format_spec,
            "outtmpl": str(self.download_dir / f"{task_id}.%(ext)s"),
            "merge_output_format": "mp4",
            "noplaylist": True,
        }

        if subtitles:
            ydl_opts["writesubs"] = True
            ydl_opts["writeautotransubs"] = True
            ydl_opts["subtitleslangs"] = ["en", "zh-Hans"]

        if translate:
            ydl_opts["translate-subs"] = True
            ydl_opts["subtitleslangs"] = ["en"]

        loop = asyncio.get_event_loop()

        def sync_download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return info

        # 在线程池中执行同步的 yt-dlp 下载
        info = await loop.run_in_executor(None, sync_download)

        yield {
            "status": "finished",
            "task_id": task_id,
            "filename": f"{task_id}.mp4",
            "title": info.get("title", "unknown"),
        }

    def get_progress(self, task_id: str) -> dict:
        """获取任务进度"""
        return self.tasks.get(task_id, {"status": "pending"})
```

#### 3.1.5 并发控制

```python
# app/core/config.py
from concurrent.futures import ThreadPoolExecutor

# 全局下载线程池，限制并发数
download_executor = ThreadPoolExecutor(max_workers=3)

# 免费用户：1 个并发，付费用户：3-5 个并发
FREE_MAX_CONCURRENT = 1
PAID_MAX_CONCURRENT = 3
```

### 3.2 字幕处理模块（P1）

#### 3.2.1 功能说明
- 下载原始字幕（支持 SRT、VTT 格式）
- 翻译字幕（调用 AI 服务）
- 烧录字幕到视频（FFmpeg）

#### 3.2.2 API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /api/subtitle/translate` | POST | 翻译字幕 |
| `GET /api/subtitle/{task_id}` | GET | 获取字幕文件 |

#### 3.2.3 字幕烧录

```python
# app/services/subtitle.py
import ffmpeg

def burn_subtitle(video_path: str, subtitle_path: str, output_path: str):
    """烧录字幕到视频"""
    stream = ffmpeg.input(video_path)
    stream = ffmpeg.filter(stream, 'subtitles', subtitle_path)
    stream = ffmpeg.output(stream, output_path)
    ffmpeg.run(stream, overwrite_output=True)
```

### 3.3 视频总结模块（P2）

#### 3.3.1 功能说明
- 提取视频音频
- 调用 AI 服务进行总结
- 返回文字总结

#### 3.3.2 音频提取

```python
# app/services/summarizer.py
import ffmpeg
import openai  # 或阿里云百炼 SDK

async def extract_audio(video_path: str) -> str:
    """提取视频音频"""
    audio_path = video_path.replace(".mp4", ".mp3")
    stream = ffmpeg.input(video_path)
    stream = ffmpeg.output(stream, audio_path, acodec='libmp3lame')
    ffmpeg.run(stream, overwrite_output=True)
    return audio_path

async def summarize_audio(audio_path: str) -> str:
    """调用 AI 服务总结音频内容"""
    # 使用阿里云百炼或 OpenAI
    # 实际实现调用 AI 转写 + 总结 API
    return "视频总结内容..."
```

#### 3.3.3 AI 服务选择

| 服务 | 优势 | 劣势 |
|------|------|------|
| **阿里云百炼** | Research 中已引用，团队可能已有账号 | 需确认 API 配额 |
| OpenAI | 能力强，生态成熟 | 国内访问受限，需代理 |
| 阿里云 | 国内访问稳定 | 价格较高 |

> **推荐**：阿里云百炼作为主服务，OpenAI 作为备选

### 3.4 付费模块（P3）

#### 3.4.1 付费模式

| 模式 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **订阅制（月/年）** | 稳定收入 | 定价需谨慎 | ⭐⭐⭐ |
| 按次付费 | 灵活 | 收入不稳定 | ⭐⭐ |
| 免费 + 内购 | 引流容易 | 转化路径长 | ⭐⭐⭐⭐ |

> **推荐**：**免费 + 订阅制**，基础功能免费，高级功能（批量下载、高清、翻译）订阅后可用

#### 3.4.2 套餐设计

| 套餐 | 价格 | 功能 |
|------|------|------|
| 免费版 | ¥0 | 每日 3 次，单视频，720p |
| 月卡 | ¥29/月 | 每日 50 次，批量 5，1080p，字幕 |
| 年卡 | ¥199/年 | 每日 200 次，批量 20，4K，AI 总结 |

#### 3.4.3 付费 UI 设计

参考 Research 中的 UI 风格：
- 玻璃拟态价格卡片
- 蓝色渐变主色调付费按钮
- 对比表格使用卡片式布局
- 突出"限时优惠"文案

```tsx
// PricingCard 组件示意
<div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl h-14 flex items-center justify-center">
    <span className="text-white font-bold">立即订阅</span>
  </div>
</div>
```

---

## 四、待确认问题与我的方案建议

> ⚠️ **以下问题需要你人工确认**

### 4.1 付费模式

| 选项 | 我的建议 |
|------|----------|
| A. 订阅制（月/年） | ⭐ **推荐**：稳定收入 |
| B. 按次付费 | 适合低频用户 |
| C. 免费 + 内购 | 引流容易 |

**我的选择**：A（免费 + 订阅制），理由：Research 强调"吸引用户付费"，订阅制更符合商业目标

### 4.2 定价策略

| 套餐 | 我的建议价格 |
|------|--------------|
| 免费版 | ¥0，每日 3 次 |
| 月卡 | ¥29/月 |
| 年卡 | ¥199/年（约 ¥16.6/月） |

### 4.3 后端技术栈

| 选项 | 我的建议 |
|------|----------|
| A. Python FastAPI | ⭐ **推荐**：轻量、yt-dlp 原生集成 |
| B. Flask | 简单但功能不如 FastAPI |
| C. Django | 过于重量级 |

**我的选择**：A（Python FastAPI），理由：
- 后端使用 Python，可以直接 `import yt_dlp`，无需进程间通信
- FastAPI 轻量、异步支持好、自动 API 文档

### 4.4 AI 服务选择

| 选项 | 我的建议 |
|------|----------|
| A. 阿里云百炼 | ⭐ **推荐**：团队已有，阿里云百炼在 Research 中已引用 |
| B. OpenAI | 能力强但国内访问受限 |
| C. 阿里云 | 国内访问稳定但价格高 |

**我的选择**：A，理由：阿里云百炼在 rice-video 的 ainmanager 中已有使用经验

### 4.5 文件存储方案

| 选项 | 我的建议 |
|------|----------|
| A. 本地临时存储 | ⭐ **推荐**：轻量，用户直接下载 |
| B. OSS | 需要额外费用 |
| C. Redis | 不适合大文件 |

**我的选择**：A，理由：Research 要求"尽量轻量"，本地存储实现最简单

### 4.6 用户认证方式

| 选项 | 我的建议 |
|------|----------|
| A. JWT | ⭐ **推荐**：无状态，适合微服务 |
| B. Session | 需要 Redis 支持 |
| C. 无状态（Token） | 不适合有用户体系的产品 |

**我的选择**：A，理由：轻量无数据库的前提下，JWT 是最简单方案

### 4.7 并发控制

| 选项 | 我的选择 |
|------|----------|
| A. 限制同时 3 个任务 | ⭐ **推荐**：平衡用户体验和服务器压力 |
| B. 不限制 | 可能导致服务器过载 |
| C. 需付费才能多并发 | 付费点之一 |

**我的选择**：A（免费用户 1 个，付费用户 3 个），理由：作为付费点之一

---

## 五、实施计划

### 5.1 阶段划分

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| **Phase 1** | 项目初始化、yt-dlp 集成、视频下载核心 | P0 |
| **Phase 2** | 字幕下载、翻译功能 | P1 |
| **Phase 3** | AI 总结功能 | P2 |
| **Phase 4** | 付费模块、订阅系统 | P3 |

### 5.2 Phase 1 详细任务

1. **项目初始化**
   - [ ] Python FastAPI 后端项目创建
   - [ ] Next.js 前端项目创建
   - [ ] yt-dlp Python 环境配置（`pip install yt-dlp`）
   - [ ] FFmpeg 安装指引

2. **前端开发**
   - [ ] 主页 UI（参考 Research 风格）
   - [ ] 视频 URL 输入组件
   - [ ] 下载进度展示组件（Server-Sent Events）

3. **后端开发**
   - [ ] 下载任务提交接口（POST /api/download）
   - [ ] yt-dlp 直接调用下载
   - [ ] 进度实时推送（Server-Sent Events）
   - [ ] 文件下载接口（GET /api/download/file/{task_id}）

4. **联调测试**
   - [ ] YouTube 视频下载测试
   - [ ] 进度实时推送测试

---

## 六、风险应对

| 风险 | 应对措施 |
|------|----------|
| 版权投诉 | 明确免责声明，仅供用户下载原创内容 |
| 平台封禁 | 使用代理、cookie 导入、版本更新机制 |
| FFmpeg 依赖 | 提供安装脚本，Docker 镜像预装 |
| 高并发压垮服务器 | 任务队列 + 并发数限制 |
| AI 服务成本 | 按调用量计费，设置每日配额 |

---

## 七、验收标准

### 7.1 Phase 1 验收

- [ ] 能下载 YouTube 视频（720p+）
- [ ] 能展示下载进度（百分比、速度、剩余时间）
- [ ] UI 符合 Research 风格（蓝色渐变、玻璃拟态、大圆角）
- [ ] 后端无数据库，纯内存状态

### 7.2 Phase 2 验收

- [ ] 能下载字幕文件（SRT/VTT）
- [ ] 能翻译字幕（中文）
- [ ] 能烧录字幕到视频

### 7.3 Phase 3 验收

- [ ] 能对视频进行 AI 总结
- [ ] 总结结果正确率 > 80%

### 7.4 Phase 4 验收

- [ ] 付费 UI 符合设计规范
- [ ] 订阅功能正常工作
- [ ] 支付流程完整（模拟）

---

## 八、开发问题排查与解决方案

> 本章节记录 Phase 1 开发过程中遇到的问题及解决方案

### 8.1 SSE 连接中断问题

**问题描述**：
- 前端使用 EventSource (SSE) 连接 `/api/download/progress/{task_id}` 获取下载进度
- 浏览器控制台显示"连接中断"
- Next.js 代理可能不支持 SSE 长连接

**解决方案**：
- 改用**轮询机制**替代 SSE，每 1 秒调用 `GET /api/download/status/{task_id}` 获取进度
- 前端使用 `setInterval` 实现轮询，下载完成或失败时清除定时器

**伪代码**：
```typescript
// 前端轮询实现
const pollingRef = useRef<NodeJS.Timeout | null>(null);

const handleDownload = async () => {
  // 提交任务...
  const taskId = data.data.task_id;

  // 启动轮询
  pollingRef.current = setInterval(async () => {
    const statusRes = await fetch(`/api/download/status/${taskId}`);
    const statusData = await statusRes.json();

    setTask(statusData.data);

    // 下载完成或失败时停止轮询
    if (statusData.data.status === "finished" ||
        statusData.data.status === "failed") {
      clearInterval(pollingRef.current);
      setLoading(false);
    }
  }, 1000);
};
```

**变更点**：
- `web/src/components/DownloadCard.tsx` - 重构下载逻辑，移除 SSE 改用轮询

---

### 8.2 Bilibili 412 Precondition Failed 错误

**问题描述**：
- Bilibili 返回 `HTTP Error 412: Precondition Failed`
- 直接访问视频页面需要浏览器 Cookie 验证

**解决方案**：
- 添加 `cookiesfrombrowser` 选项，让 yt-dlp 从 Chrome 浏览器读取 Cookie
- 同时添加浏览器 User-Agent headers 模拟真实浏览器请求

**伪代码**：
```python
ydl_opts = {
    # 从 Chrome 浏览器读取 cookies
    'cookiesfrombrowser': ('chrome', None, None, None),
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
}
```

**变更点**：
- `app/services/downloader.py` - 添加 `cookiesfrombrowser` 和 `http_headers` 配置

---

### 8.3 视频编码不兼容 QuickTime

**问题描述**：
- 下载的 MP4 文件与 QuickTime Player 不兼容
- 使用 `ffprobe` 检查发现视频编码为 **AV1 (av01)**，QuickTime 不支持

**根因分析**：
- Bilibili 提供多种编码格式：H.264 (avc1) 和 AV1 (av01)
- 默认选择最高质量格式，但 AV1 编码 Mac 原生不支持

**解决方案**：
- 使用 yt-dlp 格式选择器优先选择 H.264/AVC 编码
- 格式选择器语法：`[vcodec~='avc']` 匹配 AVC 编码

**伪代码**：
```python
# 构建格式参数，优先选择 H.264/AVC 编码
if quality == "best":
    # 优先选择 H.264/AVC 编码，否则降级
    format_spec = "(bestvideo[height<=720][vcodec~='avc']/bestvideo[height<=720])+bestaudio/best"
else:
    height = quality.replace("p", "")
    format_spec = f"(bestvideo[height<={height}][vcodec~='avc']/bestvideo[height<={height}])+bestaudio/best"
```

**可用格式参考（Bilibili BV173D9BGE23）**：
| Format ID | 分辨率 | 编码 | 文件大小 |
|-----------|--------|------|----------|
| 30064 | 1280x720 | avc1.640033 (H.264) | ~694MB |
| 100024 | 1280x720 | av01 (AV1) | ~395MB |
| 30080 | 1920x1080 | avc1.640034 (H.264) | ~1.59GB |
| 100026 | 1920x1080 | av01 (AV1) | ~779MB |

**变更点**：
- `app/services/downloader.py` - 修改 `format_spec` 格式选择器

---

### 8.4 本地文件保存问题

**问题描述**：
- 用户无法选择下载文件保存到本地哪个目录

**解决方案**：
- 由于浏览器安全限制，网页无法直接访问本地文件系统
- 采用标准方式：前端调用 `/api/download/file/{task_id}` 获取文件流
- 使用 `URL.createObjectURL()` + 临时 `<a>` 标签触发浏览器下载对话框
- 用户可在浏览器下载对话框中选择保存位置

**伪代码**：
```typescript
const handleDownloadFile = async () => {
  const res = await fetch(`/api/download/file/${taskId}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
};
```

**变更点**：
- `web/src/components/DownloadCard.tsx` - 添加 `handleDownloadFile` 方法处理文件下载

---

### 8.5 yt-dlp 版本问题

**问题描述**：
- `requirements.txt` 中指定 `yt-dlp==2024.02.10` 版本不存在
- pip 报错：`No matching distribution found for yt-dlp==2024.02.10`

**解决方案**：
- 更新为可用的稳定版本 `yt-dlp==2025.4.30`

**变更点**：
- `requirements.txt` - 修改 `yt-dlp==2025.4.30`

---

## 九、参考资料

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [yt-dlp Format Selection](https://github.com/yt-dlp/yt-dlp?tab=readme-ov-file#format-selection)
- [参考网站：AI 绘图提示词](https://ai.codefather.cn/painting)
- [万能视频下载器Research.md](./万能视频下载器Research.md)
- [架构图.excalidraw](./万能视频下载器_架构图.excalidraw)
- [流程图.excalidraw](./万能视频下载器_流程图.excalidraw)

---

## 十、验收标准（更新版）

### 10.1 Phase 1 验收

- [x] 能下载 YouTube 视频（720p+）
- [x] 能展示下载进度（百分比、速度、剩余时间）
- [x] UI 符合 Research 风格（蓝色渐变、玻璃拟态、大圆角）
- [x] 后端无数据库，纯内存状态
- [x] 视频编码兼容 QuickTime (H.264)
- [x] Bilibili 下载支持（需 Chrome Cookie）

---

> **文档状态**：Phase 1 开发完成，已验证
>
> 更新日期：2026-04-19
