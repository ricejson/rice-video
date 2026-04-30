# 万能视频下载器 视频总结功能 实现方案

> 实施方案 | 基于 Research v1.0 | 2026-04-24

---

## 一、方案概述

### 1.1 用户决策确认

| # | 问题 | 决策 |
|---|------|------|
| 1 | AI 服务选择 | **阿里云百炼** |
| 2 | 免费额度 | **免费用户都享有视频总结功能** |
| 3 | 触发时机 | **提供可选的视频总结按钮，点击后触发** |
| 4 | 总结格式 | **一键总结纯文本、思维导图知识图谱可视化、AI对话式理解可追问都要** |
| 5 | 长视频限制 | **无时长限制** |
| 6 | 是否复用下载文件 | **不需要** |

### 1.2 核心技术方案

**方案 D：yt-dlp 提取字幕 + 阿里云百炼 LLM 总结**

流程：
```
用户点击"AI总结" → yt-dlp提取字幕 → 阿里云百炼处理 → 返回多格式总结结果
```

### 1.3 设计原则

- **免费优先**：所有用户均可使用视频总结功能
- **轻量集成**：复用现有架构，不引入新数据库
- **多格式输出**：文本总结 + 思维导图 + AI 对话

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────▼───────────────────────────────────┐
│                     前端 (Next.js)                                │
│  - VideoPreviewCard 添加"AI总结"按钮                            │
│  - 总结结果展示区（文本/思维导图/对话）                          │
│  - AI 对话输入框                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP API
┌─────────────────────────────▼───────────────────────────────────┐
│                  Python 后端 (FastAPI)                             │
│  - /api/summarize          # 视频总结接口                        │
│  - /api/summarize/chat     # AI 对话接口                        │
│  - /api/summarize/mindmap  # 思维导图生成接口                   │
└───────────┬─────────────────────────────────┬───────────────────┘
            │                                 │
┌───────────▼───────────┐        ┌────────────▼───────────────────┐
│       yt-dlp          │        │       阿里云百炼                 │
│  - 提取字幕           │        │  - qwen-max 文本总结           │
│  - 备选：音频转写    │        │  - qwen-max 思维导图生成        │
└───────────────────────┘        │  - qwen-max 对话问答           │
                                 └────────────────────────────────┘
```

### 2.2 模块划分

| 模块 | 优先级 | 说明 |
|------|--------|------|
| **字幕提取** | P0 | 使用 yt-dlp 提取视频字幕 |
| **文本总结** | P0 | 调用 LLM 生成纯文本总结 |
| **思维导图** | P1 | 调用 LLM 生成思维导图结构 |
| **AI 对话** | P1 | 调用 LLM 支持用户追问 |
| **前端 UI** | P0 | 添加总结按钮和结果展示 |

---

## 三、功能模块详细设计

### 3.1 后端 API 设计

#### 3.1.1 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /api/summarize` | POST | 提交视频总结任务 |
| `GET /api/summarize/{task_id}` | GET | 查询总结任务状态和结果 |
| `POST /api/summarize/chat` | POST | AI 对话问答 |
| `GET /api/summarize/mindmap/{task_id}` | GET | 获取思维导图数据 |

#### 3.1.2 POST /api/summarize

**请求**：
```json
{
  "url": "https://www.bilibili.com/video/BVxxx",
  "formats": ["text", "mindmap", "chat"]
}
```

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "uuid-xxx",
    "status": "processing",
    "subtitles_available": true,
    "subtitles": [
      {"index": 0, "start": "00:00:00", "end": "00:00:05", "text": "欢迎观看本视频"}
    ]
  }
}
```

#### 3.1.3 GET /api/summarize/{task_id}

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "uuid-xxx",
    "status": "finished",
    "result": {
      "text_summary": "本视频主要介绍了...",
      "key_points": [
        "1. 核心要点1",
        "2. 核心要点2",
        "3. 核心要点3"
      ],
      "mindmap": {
        "root": "视频主题",
        "children": [
          {"text": "章节1", "children": [...]},
          {"text": "章节2", "children": [...]}
        ]
      }
    },
    "subtitles": [
      {"index": 0, "start": "00:00:00", "end": "00:00:05", "text": "欢迎观看本视频"}
    ]
  }
}
```

#### 3.1.4 POST /api/summarize/chat

**请求**：
```json
{
  "task_id": "uuid-xxx",
  "question": "视频中提到的第一个方法是什么？"
}
```

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "answer": "视频中提到的第一个方法是..."
  }
}
```

---

### 3.2 后端服务设计

#### 3.2.1 新增文件

```
app/
├── services/
│   ├── summarizer.py      # 新增：视频总结服务
│   └── downloader.py       # 已存在
├── api/
│   ├── summarize.py        # 新增：总结 API
│   ├── parse.py           # 已存在
│   └── download.py         # 已存在
└── models/
    └── task.py            # 已存在（需新增 SummaryTask）
```

#### 3.2.2 summarizer.py 设计

```python
# app/services/summalyzer.py
import asyncio
import httpx
from typing import Dict, Any, List, Optional, AsyncGenerator
from app.core.config import ALIYUN_API_KEY, dashscope_base_url
from app.models.task import TaskStatus

class VideoSummarizer:
    """视频总结服务"""

    def __init__(self):
        self.base_url = "https://dashscope.aliyuncs.com/api/v1"
        self.api_key = ALIYUN_API_KEY

    async def extract_subtitles(self, url: str, task_id: str) -> Dict[str, Any]:
        """使用 yt-dlp 提取字幕"""

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko'],
            'cookiefrombrowser': ('chrome', None, None, None),
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        }

        # 在线程池执行
        loop = asyncio.get_event_loop()

        def sync_extract():
            import yt_dlp
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return info

        info = await loop.run_in_executor(None, sync_extract)

        # 提取字幕
        subtitles = []
        if 'subtitles' in info:
            for lang, subs in info.get('subtitles', {}).items():
                for sub in subs:
                    subtitles.append({
                        'lang': lang,
                        'url': sub.get('url', '')
                    })

        return {
            'subtitles_available': len(subtitles) > 0,
            'subtitles': subtitles,
            'title': info.get('title', ''),
            'duration': info.get('duration', 0)
        }

    async def generate_text_summary(self, text: str) -> str:
        """调用阿里云百炼生成文本总结"""

        prompt = f"""请对以下视频字幕进行总结，生成简洁的中文摘要：

{text[:8000]}  # 限制输入长度

请按以下格式输出：
1. 一句话概括视频主题
2. 3-5个核心要点（用数字列表）
3. 适合人群

请用中文回答。"""

        return await self._call_llm(prompt)

    async def generate_mindmap(self, text: str) -> Dict[str, Any]:
        """调用阿里云百炼生成思维导图结构"""

        prompt = f"""请对以下视频字幕生成思维导图结构，用于可视化和梳理视频内容：

{text[:8000]}

请以JSON格式输出思维导图结构，格式如下：
{{
  "root": "视频主题",
  "children": [
    {{
      "text": "章节/主题1",
      "children": [
        {{"text": "子要点1.1"}},
        {{"text": "子要点1.2"}}
      ]
    }},
    {{
      "text": "章节/主题2",
      "children": [...]
    }}
  ]
}}

只输出JSON，不要其他内容。"""

        response = await self._call_llm(prompt)

        # 解析 JSON
        import json
        try:
            # 尝试提取 JSON
            if '```json' in response:
                response = response.split('```json')[1].split('```')[0]
            elif '```' in response:
                response = response.split('```')[1].split('```')[0]
            return json.loads(response.strip())
        except:
            return {
                "root": "视频内容",
                "children": [{"text": "内容摘要", "children": []}]
            }

    async def chat(self, text: str, question: str) -> str:
        """调用阿里云百炼进行对话问答"""

        prompt = f"""你是一个专业的视频内容分析师。以下是视频的字幕内容：

{text[:8000]}

请根据以上内容回答用户的问题。如果视频内容中没有相关信息，请说明"视频内容中没有提到"。

用户问题：{question}

请用中文回答。"""

        return await self._call_llm(prompt)

    async def _call_llm(self, prompt: str, model: str = "qwen-max") -> str:
        """调用阿里云百炼 LLM"""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "input": {
                "prompt": prompt
            },
            "parameters": {
                "temperature": 0.7,
                "top_p": 0.8
            }
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/services/aigc/text-generation/generation",
                headers=headers,
                json=payload
            )

            if response.status_code != 200:
                raise Exception(f"LLM API 调用失败: {response.text}")

            result = response.json()
            return result.get('output', {}).get('text', '')

# 全局单例
summarizer = VideoSummarizer()
```

#### 3.2.3 summarize.py API 设计

```python
# app/api/summarize.py
from fastapi import APIRouter, HTTPException
import asyncio

from app.models.task import ParseResponse
from app.services.summarizer import summarizer

router = APIRouter(prefix="/api/summarize", tags=["summarize"])

@router.post("", response_model=ParseResponse)
async def create_summarize_task(req: SummarizeRequest):
    """提交视频总结任务"""

    # 创建任务
    task = downloader.create_task(req.url)

    # 异步执行总结
    asyncio.create_task(_run_summarize(task.task_id, req.url, req.formats))

    return ParseResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": "processing"
        }
    )


async def _run_summarize(task_id: str, url: str, formats: List[str]):
    """执行总结任务"""

    try:
        # 1. 提取字幕
        sub_info = await summarizer.extract_subtitles(url, task_id)

        if not sub_info['subtitles_available']:
            # 如果没有字幕，更新任务状态
            downloader.update_task(task_id, status=TaskStatus.FAILED, error="该视频没有可用字幕")
            return

        # 获取字幕文本内容
        subtitle_text = await _get_subtitle_text(sub_info['subtitles'])

        # 2. 生成文本总结
        text_summary = None
        if 'text' in formats:
            text_summary = await summarizer.generate_text_summary(subtitle_text)

        # 3. 生成思维导图
        mindmap = None
        if 'mindmap' in formats:
            mindmap = await summarizer.generate_mindmap(subtitle_text)

        # 更新任务结果
        downloader.update_task(
            task_id,
            status=TaskStatus.FINISHED,
            summary_text=text_summary,
            summary_mindmap=mindmap,
            subtitles=sub_info['subtitles']
        )

    except Exception as e:
        downloader.update_task(task_id, status=TaskStatus.FAILED, error=str(e))


@router.get("/{task_id}", response_model=ParseResponse)
async def get_summarize_result(task_id: str):
    """获取总结结果"""
    task = downloader.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return ParseResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status,
            "result": {
                "text_summary": getattr(task, 'summary_text', None),
                "mindmap": getattr(task, 'summary_mindmap', None)
            },
            "subtitles": getattr(task, 'subtitles', [])
        }
    )


@router.post("/chat", response_model=ParseResponse)
async def chat_with_video(req: ChatRequest):
    """AI 对话问答"""

    task = downloader.get_task(req.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not getattr(task, 'subtitles', None):
        raise HTTPException(status_code=400, detail="没有可用的字幕内容")

    # 获取字幕文本
    subtitle_text = await _get_subtitle_text(task.subtitles)

    # 调用 AI 对话
    answer = await summarizer.chat(subtitle_text, req.question)

    return ParseResponse(
        code=0,
        message="success",
        data={
            "answer": answer
        }
    )
```

#### 3.2.4 任务模型扩展

```python
# app/models/task.py - 新增字段

class SummaryTask(BaseModel):
    # 现有字段...

    # 新增总结相关字段
    summary_text: Optional[str] = None
    summary_mindmap: Optional[Dict[str, Any]] = None
    subtitles: List[Dict[str, Any]] = []

class SummarizeRequest(BaseModel):
    url: str
    formats: List[str] = ["text", "mindmap", "chat"]

class ChatRequest(BaseModel):
    task_id: str
    question: str
```

---

### 3.3 前端组件设计

#### 3.3.1 交互流程

```
视频预览卡片 (VideoPreviewCard)
            │
            ├── 原有按钮：["下载视频"]  ["取消"]
            │
            └── 新增按钮：["AI 总结 ▼"]
                              │
                              ├── [一键总结]  → 生成纯文本总结
                              ├── [生成思维导图] → 生成可视化结构
                              └── [向AI提问]   → 展开对话输入框
```

#### 3.3.2 新增组件

```
web/src/components/
├── SummaryCard.tsx        # 新增：总结结果展示卡片
├── MindMapViewer.tsx      # 新增：思维导图可视化组件
└── ChatPanel.tsx         # 新增：AI 对话面板
```

#### 3.3.3 SummaryCard.tsx 设计

```tsx
// web/src/components/SummaryCard.tsx
"use client";

import { useState } from "react";
import MindMapViewer from "./MindMapViewer";
import ChatPanel from "./ChatPanel";

interface SummaryCardProps {
  taskId: string;
  textSummary?: string;
  mindmap?: any;
  onClose: () => void;
}

export default function SummaryCard({
  taskId,
  textSummary,
  mindmap,
  onClose
}: SummaryCardProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "mindmap" | "chat">("summary");
  const [loading, setLoading] = useState(false);

  return (
    <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === "summary"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          📝 一键总结
        </button>
        <button
          onClick={() => setActiveTab("mindmap")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === "mindmap"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          🧠 思维导图
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === "chat"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          💬 向AI提问
        </button>
      </div>

      {/* 内容区域 */}
      <div className="min-h-[300px]">
        {activeTab === "summary" && (
          <div className="prose prose-blue max-w-none">
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{textSummary}</p>
            )}
          </div>
        )}

        {activeTab === "mindmap" && mindmap && (
          <MindMapViewer data={mindmap} />
        )}

        {activeTab === "chat" && (
          <ChatPanel taskId={taskId} />
        )}
      </div>

      {/* 底部操作 */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
```

#### 3.3.4 MindMapViewer.tsx 设计

```tsx
// web/src/components/MindMapViewer.tsx
"use client";

import { useMemo } from "react";

interface MindMapNode {
  text: string;
  children?: MindMapNode[];
}

interface MindMapViewerProps {
  data: MindMapNode;
}

export default function MindMapViewer({ data }: MindMapViewerProps) {
  // 递归渲染思维导图
  const renderNode = (node: MindMapNode, index: number) => (
    <div key={index} className="flex flex-col items-center">
      <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg font-medium min-w-[120px] text-center">
        {node.text}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="relative mt-4">
          <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-blue-300 -translate-x-1/2"></div>
          <div className="flex gap-4 pt-6">
            {node.children.map((child, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-blue-300"></div>
                {renderNode(child, i)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex justify-center overflow-auto pb-8">
      {renderNode(data, 0)}
    </div>
  );
}
```

#### 3.3.5 ChatPanel.tsx 设计

```tsx
// web/src/components/ChatPanel.tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  taskId: string;
}

export default function ChatPanel({ taskId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "你好！我是AI助手，可以回答关于这个视频的问题。请问你想了解什么？"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/summarize/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, question: userMessage })
      });

      const data = await res.json();
      if (data.code === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: data.data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "抱歉，回答失败。" }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "抱歉，网络错误。" }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[400px]">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <span className="animate-pulse">AI 思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="输入问题..."
          className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

#### 3.3.6 VideoPreviewCard 修改

在现有的 VideoPreviewCard 中添加"AI 总结"按钮：

```tsx
// VideoPreviewCard.tsx - 新增按钮

{/* 操作按钮 */}
<div className="flex gap-3">
  {/* 原有下载按钮 */}
  <button
    onClick={onDownload}
    disabled={loading}
    className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 ..."
  >
    {/* ... */}
  </button>

  {/* 新增：AI 总结按钮 */}
  <button
    onClick={onSummarize}
    disabled={loading}
    className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center gap-2"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    AI 总结
  </button>

  <button onClick={onCancel} className="px-8 py-4 ...">
    取消
  </button>
</div>
```

#### 3.3.7 DownloadCard.tsx 修改

添加总结状态和 AI 对话功能：

```tsx
// DownloadCard.tsx - 新增状态和逻辑

type Stage = "input" | "parsing" | "parsed" | "downloading" | "summarizing";

// 新增总结相关状态
const [showSummary, setShowSummary] = useState(false);
const [summaryResult, setSummaryResult] = useState<any>(null);

// 处理 AI 总结
const handleSummarize = async () => {
  if (!task) return;

  setLoading(true);
  setStage("summarizing");

  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: task.url,
        formats: ["text", "mindmap", "chat"]
      })
    });

    const data = await res.json();
    const summaryTaskId = data.data.task_id;

    // 轮询总结结果
    const pollSummary = setInterval(async () => {
      const statusRes = await fetch(`/api/summarize/${summaryTaskId}`);
      const statusData = await statusRes.json();

      if (statusData.data.status === "finished") {
        clearInterval(pollSummary);
        setSummaryResult(statusData.data.result);
        setShowSummary(true);
        setLoading(false);
        setStage("parsed");
      } else if (statusData.data.status === "failed") {
        clearInterval(pollSummary);
        setError("总结生成失败");
        setLoading(false);
        setStage("parsed");
      }
    }, 2000);

  } catch (err: any) {
    setError(err.message || "总结失败");
    setLoading(false);
    setStage("parsed");
  }
};

// 解析后展示预览卡片（包含 AI 总结按钮）
if (stage === "parsed" && task) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <VideoPreviewCard
        video={task as any}
        onDownload={handleDownload}
        onSummarize={handleSummarize}  // 新增
        onCancel={handleCancel}
        selectedEntries={selectedEntries}
        onEntryToggle={handleEntryToggle}
        loading={loading}
      />

      {/* 总结结果展示 */}
      {showSummary && summaryResult && (
        <SummaryCard
          taskId={task.task_id}
          textSummary={summaryResult.text_summary}
          mindmap={summaryResult.mindmap}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
```

---

## 四、修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/summarize.py` | 新增 | 视频总结 API |
| `app/services/summarizer.py` | 新增 | 视频总结服务（字幕提取 + LLM 调用） |
| `app/models/task.py` | 修改 | 新增 SummarizeRequest、ChatRequest、SummaryTask 字段 |
| `web/src/components/SummaryCard.tsx` | 新增 | 总结结果展示卡片 |
| `web/src/components/MindMapViewer.tsx` | 新增 | 思维导图可视化组件 |
| `web/src/components/ChatPanel.tsx` | 新增 | AI 对话面板组件 |
| `web/src/components/VideoPreviewCard.tsx` | 修改 | 添加 onSummarize props 和 AI 总结按钮 |
| `web/src/components/DownloadCard.tsx` | 修改 | 添加总结流程逻辑 |

---

## 五、依赖更新

### 5.1 Python 依赖

```txt
# requirements.txt 新增
dashscope>=1.20.0   # 阿里云百炼 SDK（备选，如不使用 HTTP API）
```

### 5.2 前端依赖

```json
// package.json 无需新增（使用原生 React + Tailwind）
```

---

## 六、待确认问题

> ⚠️ 以下问题需要在实施前确认

| # | 问题 | 说明 |
|---|------|------|
| 1 | **阿里云百炼 API 详细调用方式** | 当前方案假设使用 HTTP API `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`，需要确认 API 地址和认证方式是否正确 |
| 2 | **dashscope SDK vs HTTP API** | 使用阿里云官方 dashscope Python SDK 还是直接调用 HTTP API？建议使用 HTTP API 更轻量 |
| 3 | **字幕内容获取方式** | yt-dlp 提取的字幕是 URL，需要额外下载字幕内容。如何获取完整字幕文本？ |
| 4 | **思维导图前端渲染** | 当前 MindMapViewer 使用简单的树状结构，是否需要更复杂的可视化库（如 D3.js）？ |
| 5 | **对话上下文** | 当前对话是否需要维护上下文（多轮对话）？ |

---

## 七、风险应对

| 风险 | 应对措施 |
|------|----------|
| 视频无字幕 | 提示用户"该视频没有可用字幕"，不阻塞主流程 |
| LLM API 调用失败 | 添加重试机制（最多3次），失败后提示用户 |
| 字幕内容过长 | 限制输入 LLM 的字幕长度（如前 8000 字符） |
| API 费用超支 | 设置每日/每次调用限额 |
| 思维导图 JSON 解析失败 | 提供降级方案，返回默认结构 |

---

## 八、实施计划

### Phase 1：核心功能（视频总结 + AI 对话）

1. **后端 API**（1天）
   - [ ] 新增 `/api/summarize` 接口
   - [ ] 实现字幕提取逻辑
   - [ ] 实现 LLM 调用（文本总结 + 对话）

2. **前端 UI**（1天）
   - [ ] VideoPreviewCard 添加 AI 总结按钮
   - [ ] SummaryCard 总结结果展示
   - [ ] ChatPanel AI 对话功能

### Phase 2：增强功能（思维导图）

3. **思维导图**（0.5天）
   - [ ] 后端生成思维导图 JSON
   - [ ] 前端 MindMapViewer 组件

### Phase 3：优化

4. **体验优化**（0.5天）
   - [ ] 加载状态优化
   - [ ] 错误处理完善
   - [ ] 多轮对话上下文

---

## 九、验收标准

### 9.1 功能验收

- [ ] 视频预览卡片显示"AI 总结"按钮
- [ ] 点击后能提取视频字幕（如果有）
- [ ] 能生成纯文本总结
- [ ] 能生成思维导图结构
- [ ] 能进行 AI 对话问答
- [ ] 总结结果正确显示在前端

### 9.2 交互验收

- [ ] AI 总结按钮不阻塞视频下载流程
- [ ] 总结加载中显示 loading 状态
- [ ] 失败时显示友好错误提示
- [ ] 思维导图正确渲染
- [ ] 对话面板支持多轮聊天

### 9.3 性能验收

- [ ] 字幕提取时间 < 10秒
- [ ] 文本总结响应时间 < 30秒
- [ ] 前端无明显卡顿

---

## 十、参考资料

- [阿里云百炼 API](https://bailian.console.aliyun.com/)
- [yt-dlp Subtitles](https://github.com/yt-dlp/yt-dlp#subtitle-options)
- [万能视频下载器Research.md](./万能视频下载器Research.md)
- [万能视频下载器Plan.md](./万能视频下载器Plan.md)
- [万能视频下载器视频总结功能Research.md](./万能视频下载器视频总结功能Research.md)

---

> **文档状态**：方案设计完成，待人工确认后实施
>
> 更新日期：2026-04-24
