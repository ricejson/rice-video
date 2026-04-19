# 万能视频下载器 Research

> 深度调研报告 | 2026-04-19

---

## 一、背景与目标

### 1.1 现状痛点
- 视频平台限制多（平台不支持、清晰度限制、无法批量下载）
- 用户有强烈刚需但缺乏趁手工具

### 1.2 目标
开发一款**万用视频下载器**，核心能力：
1. **视频下载**（核心）—— 支持多平台
2. **视频总结**（AI 能力）
3. **字幕翻译**（AI 能力）
4. **付费功能**（盈利模式）

### 1.3 设计原则
- 尽量吸引用户付费（突出实用性）
- 需要后端，但尽量轻量（不用数据库）
- 站在巨人肩膀上，使用开源方案（如 yt-dlp）降低开发风险

---

## 二、前端 UI 设计风格（参考：ai.codefather.cn/painting）

### 2.1 配色方案
| 角色 | 颜色 | 用途 |
|------|------|------|
| 主色调 | `#3b82f6` (blue-500) → `#6366f1` (indigo-600) | 渐变，贯穿全局 |
| 辅助色 | `indigo-400/30`, `slate-900/500` | 背景、文本 |
| 强调色 | `#FFB7C5`（粉色） | 特定标题/高亮 |
| 透明层 | `bg-white/70` | 毛玻璃底色 |

### 2.2 视觉风格
- **玻璃拟态（Glassmorphism）**：`backdrop-blur-2xl` + 半透明背景
- **大圆角卡片**：`rounded-[2.5rem]`（2.5rem 圆角）
- **多层阴影**：`shadow-[0_20px_50px_rgba(0,0,0,0.05)]`
- **渐变装饰线**：`bg-gradient-to-r from-transparent via-blue-500/20 to-transparent`
- **背景光晕**：蓝色/靛蓝色 `blur-[100px]` 圆形光斑

### 2.3 按钮设计
```css
/* 主按钮 */
{
  background: gradient blue-500 → indigo-600
  box-shadow: shadow-lg shadow-blue-500/20
  border-radius: rounded-2xl
  height: h-14 (56px)
  hover: scale-[1.02]
  active: scale-[0.98]
  transition: transition-all
}

/* 次要按钮 */
{
  background: bg-gray-50/50
  hover: border-blue-100, text-blue-500
}
```

### 2.4 布局结构
- 最大宽度：`max-w-screen-xl`（1280px）
- 响应式：`p-4`（移动端）、`p-0`（桌面端）
- 居中对齐：`mx-auto`
- 充足留白：`pt-12 px-4`

### 2.5 动效设计
| 动画 | 用途 |
|------|------|
| `animate-float` | 浮动效果 |
| `animate-pulse-soft` | 脉冲效果 |
| `animate-scan` | 扫描线效果 |
| `animate-tilt` | 倾斜效果 |

### 2.6 付费相关 UI 设计要点
> ⚠️ **待确认**：参考网站 ai.codefather.cn/painting 本身未包含付费/会员页面

**建议付费 UI 设计方向**：
- 价格卡片使用大圆角 + 玻璃拟态
- 主色调按钮引导付费行为
- 突出"限时优惠"、"特价"等文案
- 使用蓝色渐变作为付费按钮背景
- 套餐对比表格使用卡片式布局

---

## 三、yt-dlp 使用方式详解

### 3.1 项目概述
- **定位**：命令行音视频下载工具，基于 youtube-dl 的活跃分支
- **许可证**：Unlicense（完全开源）
- **支持网站**：1700+（README 目录标题）
- **运行环境**：Python 3.10+

### 3.2 安装方式

| 方式 | 命令 |
|------|------|
| 二进制 | `yt-dlp`（Unix）、`yt-dlp.exe`（Windows）、`yt-dlp_macos`（macOS） |
| pip | `pip install yt-dlp` |
| 包管理器 | Homebrew、winget 等 |

### 3.3 命令行基本用法

```bash
# 基本下载
yt-dlp URL

# 下载最佳质量（合并音视频）
yt-dlp -f "bestvideo+bestaudio" URL

# 提取音频
yt-dlp -x --audio-format mp3 URL

# 指定输出模板
yt-dlp --output "%(title)s.%(ext)s" URL

# 代理设置
yt-dlp --proxy "http://proxy:port" URL

# 从浏览器导入 cookie（绕过登录）
yt-dlp --cookies-from-browser chrome URL

# 更新版本
yt-dlp -U
```

### 3.4 Python API 调用方式

```python
import yt_dlp

# 基本下载
def basic_download():
    with yt_dlp.YoutubeDL() as ydl:
        ydl.download(['视频URL'])

# 带选项下载
def advanced_download():
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',  # 格式选择
        'outtmpl': '%(title)s.%(ext)s',         # 输出模板
        'progress_hooks': [progress_hook],       # 进度回调
        'postprocessors': [{
            'key': 'FFmpegMergeDownloaded',      # 合并音视频
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(['视频URL'])

# 进度回调
def progress_hook(d):
    if d['status'] == 'downloading':
        print(f"下载进度: {d.get('_percent_str', 'N/A')}")
    elif d['status'] == 'finished':
        print("下载完成")

# 字幕下载和翻译
def subtitle_download():
    ydl_opts = {
        'writesubs': True,           # 下载字幕
        'writeautotransubs': True,   # 下载自动字幕
        'subtitleslangs': ['en', 'zh-Hans'],  # 字幕语言
        'translate-subs': True,     # 翻译字幕
    }
```

### 3.5 核心依赖

| 依赖 | 用途 | 必需性 |
|------|------|--------|
| **FFmpeg** | 合并音视频流、格式转换、字幕烧录 | **必须** |
| Python 3.10+ | 运行环境 | 必须 |
| curl_cffi | TLS 指纹模拟（绕过反爬） | 推荐 |
| mutagen | 嵌入缩略图 | 可选 |
| requests | HTTP 代理支持 | 可选 |
| brotli | Brotli 压缩支持 | 可选 |

> ⚠️ **FFmpeg 注意**：必须是 **ffmpeg binary**，不是 Python 包

### 3.6 支持的主要平台（30+）

| 分类 | 平台 |
|------|------|
| 综合视频 | YouTube、抖音、哔哩哔哩、Facebook |
| 短视频 | TikTok、Instagram、X/Twitter |
| 流媒体 | Netflix、Amazon Prime、Hulu、Disney+、HBO Max |
| 直播/原创 | Twitch、TVer、Vimeo、Dailymotion |
| 音频 | SoundCloud、Bandcamp、Spotify |

---

## 四、风险点 / 歧义点 / 待确认问题

### 4.1 风险点

| 风险 | 描述 | 应对建议 |
|------|------|----------|
| **版权风险** | 下载受版权保护的视频可能涉及法律问题 | 明确免责声明，仅供用户下载自己有权下载的内容 |
| **平台封锁** | 视频平台可能封禁 IP 或要求登录 | 使用代理、cookie 导入、更新版本 |
| **FFmpeg 依赖** | 必需安装 FFmpeg 才能合并音视频 | 提供安装指引或打包版 |
| **清晰度限制** | 部分平台对免费用户限制清晰度 | 考虑付费/登录方案 |

### 4.2 歧义点

| 歧义 | 描述 | 待确认 |
|------|------|--------|
| **付费模式** | 是订阅制还是按次付费？ | 需要人工确认 |
| **定价策略** | 价格区间和套餐设计 | 需要人工确认 |
| **后端技术栈** | Go 还是 Python？轻量方案具体是什么？ | 需要人工确认 |
| **视频总结** | 使用哪个 AI 服务？成本如何？ | 需要人工确认 |
| **字幕翻译** | 翻译引擎选择（免费/付费） | 需要人工确认 |

### 4.3 待确认问题

| 问题 | 详情 | 建议排查方向 |
|------|------|--------------|
| **AI 服务选择** | 视频总结、字幕翻译用哪家 AI？ | 火山引擎/OpenAI/其他 |
| **付费 UI 具体样式** | 参考网站无付费页面，需自行设计 | 参考其他 SaaS 付费页面 |
| **用户认证方式** | 是否需要用户登录系统？ | JWT/Session/无状态 |
| **文件存储** | 下载文件存储在哪里？本地/OSS？ | 需要确认存储方案 |
| **并发限制** | 是否限制同时下载数量？ | 需要确认产品策略 |

---

## 五、参考资料

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [参考网站：AI 绘图提示词](https://ai.codefather.cn/painting)

---

> **文档状态**：Research 完成，待人工确认方案
