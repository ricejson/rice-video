# 万能视频下载器 视频总结功能 Research

> 深度调研报告 | 视频总结功能 | 2026-04-24

---

## 一、背景与目标

### 1.1 项目现状

根据《万能视频下载器Plan.md》，项目已完成：
- **Phase 1**：视频下载核心功能（yt-dlp + FastAPI）
- **Phase 1.5**：视频解析+预览功能（两阶段流程：解析→预览→下载）

当前用户流程：
```
用户输入URL → 点击"解析链接" → 展示视频预览卡片 → 点击"下载视频" → 下载完成
```

### 1.2 本次需求

**目标**：当用户解析一个比较长的视频时，提供视频总结功能，让用户快速了解视频核心要点，判断是否要下载。

**定位**：Phase 2/3 功能（Plan 中标注为 P2/P3）

### 1.3 设计原则

- 尽量吸引用户付费（突出实用性）
- 轻量后端（无数据库）
- 站在巨人肩膀上，使用成熟方案

---

## 二、参考网站亮点功能分析

### 2.1 NoteGPT (notegpt.io/cn/bilibili-summarizer)

#### 亮点功能

| 功能 | 说明 |
|------|------|
| **视频转录文本生成** | 自动提取视频语音为文字 |
| **AI深度总结** | 基于转录内容生成摘要 |
| **思维导图自动生成** | 可视化展示视频结构 |
| **多语言翻译** | 支持英语、日语、韩语、法语等 |
| **AI对话互动** | 可深入探讨视频内容 |

#### 用户交互流程

```
Step 1: 输入B站视频链接并点击生成
    ↓
Step 2: 5秒内获取总结、思维导图、转录文本
    ↓
Step 3: 保存内容到工作台
    ↓
Step 4: 可与AI继续对话，深入探讨内容
```

#### 总结输出格式

- 深度总结文本（段落式）
- 思维导图（可视化结构）
- 转录文本（原始字幕）
- 支持导出为 PDF/Word 文档

#### 特色交互设计

- 三步流程图标引导
- 实时用户评价模块
- 可折叠 FAQ 区域
- 五星评分系统
- 语言切换功能（中英文）

---

### 2.2 BibiGPT (bibigpt.co/desktop)

#### 亮点功能

| 功能 | 说明 |
|------|------|
| **One-click summary** | 一键总结，快速提取核心内容 |
| **AI-powered Q&A** | AI对话式理解，可追问视频内容 |
| **多平台支持** | YouTube、Bilibili、TikTok、Douyin、播客等 |
| **视觉分析** | 思维导图、知识图谱可视化 |
| **笔记集成** | Notion、Obsidian、Roam Research、Flomo |
| **本地文件处理** | 隐私模式，使用本地 Whisper/SenseVoice |
| **字幕生成** | 带时间戳的转录文本 |
| **分章节总结** | 结构化分析视频各部分 |
| **Flashcards** | 闪卡式学习，主动记忆 |
| **内容创作工具** | 社交图片、PPT、短视频生成 |
| **浏览器扩展** | 插件形式直接使用 |
| **开放 API** | 支持自动化集成 |

#### 用户交互流程

```
Step 1: 粘贴URL（YouTube、Bilibili等）或上传本地音视频文件
    ↓
Step 2: 点击"一键总结"启动AI处理
    ↓
Step 3: AI自动处理（显示进度指示器）
    ↓
Step 4: 查看生成的总结、转录、高亮笔记
    ↓
Step 5: 可使用AI聊天、创建闪卡、导出结果
    ↓
Step 6: 同步或导出到笔记平台
```

#### 总结输出格式

| 格式 | 描述 |
|------|------|
| Full Summary | 完整概述与关键点 |
| Chapter Breakdown | 分章节结构化分析 |
| Mind Map | 视觉思维导图 |
| Transcript | 带时间戳的字幕 |
| Highlight Notes | 关键句子提取 |
| Flash Cards | 间隔重复记忆卡片 |
| Visual Analysis | 逐帧视觉理解 |
| Article | 博客/微信格式化文本 |
| Social Cards | 可分享的图形卡片 |

#### 特色交互设计

- **Command Palette** (Ctrl+K) 快速导航
- **Smart Folders** 标签过滤
- **Local Privacy Mode** 本地处理模式
- **Flash Capture** 语音备忘录
- **Batch Processing** 批量处理频道/订阅
- **Inline Highlighting** 内联高亮与分享
- **多语言界面**（中、英、日、韩、繁体）
- **主题定制**（浅色/深色/系统 + Ghibli 等风格主题）
- **全局快捷键** 支持

---

### 2.3 功能对比总结

| 功能 | NoteGPT | BibiGPT |
|------|---------|---------|
| 平台支持 | 主要是 Bilibili | 1700+（含 YouTube 等） |
| 本地处理 | ❌ | ✅（隐私模式） |
| 思维导图 | ✅ | ✅ |
| AI对话 | ✅ | ✅ |
| 笔记集成 | ❌ | ✅（Notion等） |
| 闪卡学习 | ❌ | ✅ |
| 浏览器扩展 | ❌ | ✅ |
| 导出格式 | PDF/Word | 多格式 |
| API | ❌ | ✅ |

---

## 三、当前项目架构分析

### 3.1 技术栈

| 层级 | 技术选型 | 现状 |
|------|----------|------|
| 前端 | Next.js + Tailwind CSS | ✅ 已完成 |
| 后端 | Python FastAPI | ✅ 已完成 |
| 视频下载 | yt-dlp | ✅ 已完成 |
| 字幕处理 | FFmpeg + yt-dlp | ⏳ 待 Phase 2 |
| AI 服务 | 阿里云百炼 / OpenAI | ⏳ 待 Phase 2/3 |

### 3.2 现有目录结构

```
rice-video/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── api/
│   │   ├── download.py      # 下载接口
│   │   ├── parse.py         # 解析接口
│   │   ├── task.py          # 任务状态
│   │   └── subscribe.py     # 订阅
│   ├── services/
│   │   └── downloader.py    # yt-dlp 调用
│   ├── models/
│   │   └── task.py          # 任务模型
│   └── core/
│       └── config.py         # 配置（已预留 AI_API_KEY）
├── web/
│   └── src/
│       ├── app/page.tsx     # 首页
│       └── components/
│           ├── DownloadCard.tsx      # 下载卡片（两阶段流程）
│           ├── VideoPreviewCard.tsx   # 视频预览卡片
│           ├── PricingCard.tsx        # 定价卡片
│           └── ProgressBar.tsx        # 进度条
└── requirements.txt
```

### 3.3 现有依赖

**Python (requirements.txt)**：
```
fastapi==0.109.0
yt-dlp==2025.4.30
ffmpeg-python==0.2.0
httpx==0.26.0
# 已预留 AI API Key 槽位
ALIYUN_API_KEY = os.getenv("ALIYUN_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
```

**前端 (package.json)**：
```
next: 16.2.4
react: 19.2.4
tailwindcss: ^4
```

### 3.4 现有 API 流程

```
前端                    后端                    yt-dlp
  │                       │                       │
  ├─ POST /api/parse ────►│                       │
  │                       ├── create_task() ─────►│
  │                       │◄─ task_id ───────────┤
  │◄─ {task_id} ─────────┤                       │
  │                       │                       │
  ├─ GET /api/parse/{id} ─┤                       │
  │                       ├── parse_video() ─────►│
  │                       │◄─ {title, thumb...} ──┤
  │◄─ {video_info} ──────┤                       │
```

---

## 四、视频总结技术方案分析

### 4.1 核心技术流程

视频总结的实现分为两个阶段：

```
┌─────────────────────────────────────────────────────────┐
│                    阶段一：音频提取                      │
│  视频文件 ──► FFmpeg 提取音频 ──► 音频文件（MP3/WAV）     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    阶段二：AI 处理                       │
│  音频文件 ──► 语音转文字 ──► LLM 总结 ──► 总结文本       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 方案对比

#### 方案 A：本地 Whisper（开源）

```python
# 安装：pip install -U openai-whisper
import whisper

model = whisper.load_model("turbo")
result = model.transcribe("audio.mp3")
# result["text"] 包含转录文本
```

| 项目 | 说明 |
|------|------|
| **优势** | 免费、无 API 依赖、可离线、隐私保护 |
| **劣势** | 需要本地 GPU、英文效果好于中文、CPU 较慢 |
| **适用场景** | 用户本地部署、有 GPU 设备 |

#### 方案 B：OpenAI Whisper API

```python
# 调用 OpenAI API 转录
from openai import OpenAI
client = OpenAI()

audio_file = open("audio.mp3", "rb")
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file
)
```

| 项目 | 说明 |
|------|------|
| **优势** | 准确度高、支持多语言、无本地算力需求 |
| **劣势** | 国内访问受限（需要代理）、按分钟收费、隐私问题 |
| **费用** | $0.006 / 分钟（约 ¥0.04 / 分钟） |

#### 方案 C：阿里云语音转写 + 百炼 LLM

```python
# 阿里云语音转写（FunASR）
from modelscope.pipelines import pipeline
p = pipeline('speech Recognition', 'iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch')
result = p("audio.mp3")

# 阿里云百炼总结
import httpx
response = await client.post(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    headers={"Authorization": f"Bearer {ALIYUN_API_KEY}"},
    json={"model": "qwen-max", "input": {"prompt": f"请总结以下内容：{transcript}"}}
)
```

| 项目 | 说明 |
|------|------|
| **优势** | 国内访问稳定、已在项目预留、成本可控 |
| **劣势** | 语音转写需额外配置、百炼总结质量待验证 |
| **费用** | 语音转写约 ¥0.001 / 秒，百炼 LLM 按 token 收费 |

#### 方案 D：yt-dlp 提取字幕 + LLM 总结

```python
# 使用 yt-dlp 下载字幕（如果有）
ydl_opts = {
    'writesubtitles': True,
    'writeautomaticsub': True,
    'subtitleslangs': ['zh-Hans', 'en'],
}
# 然后用 LLM 总结字幕内容
```

| 项目 | 说明 |
|------|------|
| **优势** | 实现最简单、视频平台有字幕则无需转录 |
| **劣势** | 依赖平台提供字幕、自制视频无字幕、字幕质量参差 |
| **适用场景** | YouTube 等有官方字幕的视频 |

### 4.3 方案推荐

**推荐方案：方案 C（阿里云语音转写 + 百炼 LLM）**

理由：
1. 项目已在 `config.py` 预留 `ALIYUN_API_KEY`
2. 国内访问稳定，符合项目轻量原则
3. 阿里云 FunASR 语音转写对中文支持好
4. 可复用现有架构（FastAPI + httpx）

**备选方案：方案 A（本地 Whisper）**

理由：
- 如果用户有隐私需求或希望免费使用
- 可作为付费功能的对立面（免费用户用本地，付费用户用云端）

【comment】选择方案D



## 五、交互流程设计建议

### 5.1 触发时机选择

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A. 解析后立即总结** | 解析完视频信息后自动触发 | 用户无感知、体验流畅 | 增加解析时间、可能浪费 |
| **B. 下载后触发** | 下载完成后询问是否总结 | 确保用户真的要下载 | 需要等待下载完成 |
| **C. 手动触发** | 解析后显示"总结视频"按钮 | 最灵活、不强制 | 多一步操作 |

**建议**：采用 **方案 C（手动触发）**，理由：
- 总结是额外功能，不应阻塞主流程
- 用户主动触发说明确实有需求
- 可作为付费点区分免费/付费用户

### 5.2 新交互流程

```
用户输入URL → 点击"解析链接" → 展示视频预览卡片
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                         │
              点击"下载视频"                              点击"AI总结"（可选）
                    │                                         │
              开始下载流程                            显示"正在生成总结..."
                    │                                         │
              下载完成                                 AI 处理中...
                    │                                         │
              显示"保存到本地"                         展示总结结果
```

### 5.3 总结结果展示位置

**建议**：在视频预览卡片下方新增总结区域

```
┌─────────────────────────────────────────┐
│  [视频预览卡片 - 封面、标题、描述]          │
├─────────────────────────────────────────┤
│  📝 AI 视频总结                           │
│  ─────────────────────────               │
│  1. 核心要点 1                            │
│  2. 核心要点 2                            │
│  3. 核心要点 3                            │
│                                         │
│  [💬 向AI提问]  [📋 复制总结]  [📥 导出]   │
└─────────────────────────────────────────┘
```

---

## 六、风险点 / 歧义点 / 待确认问题

### 6.1 风险点

| 风险 | 描述 | 应对建议 |
|------|------|----------|
| **AI 服务成本** | 视频转写和总结需要消耗 API配额/费用 | 设置每日免费额度、付费解锁更多次数 |
| **长视频处理** | 超过 30 分钟的视频转写耗时久 | 分段处理、显示预估时间 |
| **隐私风险** | 用户视频内容上传到第三方 AI 服务 | 明确隐私政策、提供本地处理选项 |
| **总结质量** | AI 总结可能不准确或不完整 | 提供"向AI提问"功能让用户深入了解 |
| **平台字幕缺失** | 部分视频没有字幕，依赖语音转写 | 语音转写作为兜底方案 |

### 6.2 歧义点

| 歧义 | 描述 | 待确认 |
|------|------|--------|
| **免费额度** | 免费用户是否享有视频总结功能？每日限制多少次？ | **待确认** |
| **触发时机** | 解析后自动触发 vs 下载后触发 vs 手动触发？ | **待确认** |
| **总结格式** | 纯文本 vs 分章节 vs 思维导图？ | **待确认** |
| **AI 服务选择** | 阿里云百炼 vs OpenAI vs 本地 Whisper？ | **待确认** |
| **付费定位** | 视频总结是否作为付费功能？ | **待确认** |

### 6.3 待确认问题（需人工确认）

| # | 问题 | 建议排查方向 |
|---|------|--------------|
| 1 | **AI 服务选择**：使用阿里云百炼还是 OpenAI？ | 使用阿里云百炼 |
| 2 | **免费额度**：免费用户是否享有视频总结功能？ | 目前就设计成免费用户都享有视频总结功能 |
| 3 | **触发时机**：用户点击哪个按钮触发总结？ | 提供可选的视频总结按钮，点击后出发总结 |
| 4 | **总结格式**：输出什么格式的总结？（纯文本/分章节/思维导图） | 一键总结纯文本、思维导图知识图谱可视化、AI对话式理解可追问都要 |
| 5 | **长视频限制**：是否有视频时长限制？超过限制如何处理？ | 无时长限制 |
| 6 | **是否复用下载的视频文件**：总结是否复用已下载的文件？ | 不需要 |

---

## 七、后续排查建议

在人工确认上述问题后，建议继续排查：

1. **AI 服务接入**：确认阿里云百炼 API 的具体调用方式和费用
2. **音频转写测试**：使用 FFmpeg 提取音频 + 阿里云 FunASR 进行转写测试
3. **LLM 总结 Prompt**：设计适合视频总结的 Prompt 模板
4. **前端组件设计**：参考 VideoPreviewCard 设计总结结果展示组件
5. **API 设计**：设计 `/api/summarize` 接口

---

## 八、参考资料

- [NoteGPT - Bilibili Summarizer](https://notegpt.io/cn/bilibili-summarizer)
- [BibiGPT - AI Video Summarization](https://bibigpt.co/desktop)
- [OpenAI Whisper GitHub](https://github.com/openai/whisper)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [阿里云百炼 API](https://help.aliyun.com/)
- [万能视频下载器Plan.md](./万能视频下载器Plan.md)

---

> **文档状态**：Research 完成，待人工确认方案
>
> 更新日期：2026-04-24
