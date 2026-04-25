import asyncio
import json
import os
import tempfile
from typing import Dict, Any, List, Optional
from pathlib import Path

import yt_dlp
import dashscope
from dashscope import Generation

from app.core.config import ALIYUN_API_KEY

dashscope.api_key = ALIYUN_API_KEY


class VideoSummarizer:
    """视频总结服务"""

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "rice_video_subtitles"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = dashscope.api_key

    async def extract_subtitles(self, url: str, task_id: str) -> Dict[str, Any]:
        """使用 yt-dlp 提取字幕"""

        # 创建临时目录用于保存字幕文件
        subtitle_dir = self.temp_dir / task_id
        subtitle_dir.mkdir(parents=True, exist_ok=True)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'ai-zh'],
            'subtitlesformat': 'srt',
            'outtmpl': str(subtitle_dir / '%(id)s.%(ext)s'),
            'cookiesfrombrowser': ('chrome', None, None, None),
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        }

        loop = asyncio.get_event_loop()

        def sync_extract():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    return info
            except Exception as e:
                print(f"字幕提取失败: {e}")
                return None

        info = await loop.run_in_executor(None, sync_extract)

        if not info:
            return {
                'subtitles_available': False,
                'subtitles': [],
                'subtitle_text': '',
                'title': '',
                'duration': 0
            }

        # 优先从 subtitles 或 automatic_captions 中提取字幕内容
        subtitles_data = info.get('subtitles') or {}
        auto_subtitles_data = info.get('automatic_captions') or {}

        subtitle_text = ""
        subtitle_with_timestamps = ""

        # 优先使用 AI 字幕（ai-zh），其次是中文字幕
        for lang in ['ai-zh', 'zh-Hans', 'zh-Hant', 'en']:
            # 先检查普通字幕
            if lang in subtitles_data:
                sub_list = subtitles_data[lang]
                for sub in sub_list:
                    if 'data' in sub:
                        # 直接包含字幕内容（带时间戳的原始格式）
                        subtitle_with_timestamps = sub['data']
                        subtitle_text = self._parse_subtitle_content(subtitle_with_timestamps)
                        break
                    elif 'url' in sub:
                        subtitle_with_timestamps = await self._download_subtitle_text(sub['url'])
                        if subtitle_with_timestamps:
                            subtitle_text = self._parse_subtitle_content(subtitle_with_timestamps)
                            break
                if subtitle_with_timestamps:
                    break

            # 再检查自动字幕
            if lang in auto_subtitles_data and not subtitle_with_timestamps:
                sub_list = auto_subtitles_data[lang]
                for sub in sub_list:
                    if 'data' in sub:
                        subtitle_with_timestamps = sub['data']
                        subtitle_text = self._parse_subtitle_content(subtitle_with_timestamps)
                        break
                    elif 'url' in sub:
                        subtitle_with_timestamps = await self._download_subtitle_text(sub['url'])
                        if subtitle_with_timestamps:
                            subtitle_text = self._parse_subtitle_content(subtitle_with_timestamps)
                            break
                if subtitle_with_timestamps:
                    break

        # 如果没有从 info 中获取到字幕，尝试读取下载的字幕文件
        if not subtitle_with_timestamps:
            subtitle_files = list(subtitle_dir.glob('*.srt'))
            for sub_file in subtitle_files:
                try:
                    with open(sub_file, 'r', encoding='utf-8') as f:
                        subtitle_with_timestamps = f.read()
                        subtitle_text = self._parse_subtitle_content(subtitle_with_timestamps)
                        break
                except Exception as e:
                    print(f"读取字幕文件失败: {e}")
                    continue

        return {
            'subtitles_available': bool(subtitle_text.strip()),
            'subtitles': [{'lang': 'auto', 'text': subtitle_text[:500]}] if subtitle_text else [],
            'subtitle_text': subtitle_text,
            'subtitle_with_timestamps': subtitle_with_timestamps,
            'title': info.get('title', ''),
            'duration': info.get('duration', 0)
        }

    def _parse_subtitle_content(self, content: str) -> str:
        """解析字幕内容，提取纯文本"""
        if not content:
            return ""

        # 如果是 SRT 格式（包含时间轴如 00:00:00,000 --> 00:00:03,080）
        if '-->' in content and (',' in content or '.' in content):
            lines = content.strip().split('\n')
            text_lines = []
            for line in lines:
                line = line.strip()
                # 跳过时间轴行
                if '-->' in line:
                    continue
                # 跳过序号
                if line.isdigit():
                    continue
                # 跳过空行
                if not line:
                    continue
                # 收集文本行
                text_lines.append(line)
            return ' '.join(text_lines)

        # 如果是纯文本，直接返回
        return content.strip()

    async def _download_subtitle_text(self, url: str) -> str:
        """下载字幕文件内容"""
        import httpx

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    content = response.text
                    # 如果是 VTT 格式
                    if '-->'.join(content):
                        return self._parse_vtt(content)
                    return content
        except Exception as e:
            print(f"下载字幕失败: {e}")
        return ""

    def _build_summary_prompt(self, text: str) -> str:
        """构建总结 prompt"""
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars]

        return f"""请对以下视频字幕进行总结，生成简洁的中文摘要：

{text}

请按以下格式输出：
1. 一句话概括视频主题
2. 3-5个核心要点（用数字列表）
3. 适合人群

请用中文回答。"""

    async def generate_text_summary(self, text: str) -> str:
        """调用阿里云百炼生成文本总结"""

        if not text or not text.strip():
            return "无法生成总结：没有可用的字幕内容"

        # 检查 API Key
        if not self.api_key:
            return "无法生成总结：阿里云 API Key 未配置。请在环境变量中设置 ALIYUN_API_KEY"

        prompt = self._build_summary_prompt(text)

        try:
            response = Generation.call(
                model='qwen-max',
                prompt=prompt,
                temperature=0.7,
                top_p=0.8
            )

            if response.status_code == 200:
                return response.output.get('text', '总结生成失败')
            else:
                return f"总结生成失败: {response.message}"

        except Exception as e:
            error_msg = str(e)
            if "No API-key" in error_msg or "api_key" in error_msg.lower():
                return "无法生成总结：阿里云 API Key 未配置或无效。请在环境变量中设置 ALIYUN_API_KEY"
            return f"调用AI服务失败: {error_msg}"

    async def generate_text_summary_stream(self, text: str):
        """流式调用阿里云百炼生成文本总结，yield 增量文本块"""
        import queue
        import threading

        if not text or not text.strip():
            yield "无法生成总结：没有可用的字幕内容"
            return

        if not self.api_key:
            yield "无法生成总结：阿里云 API Key 未配置。请在环境变量中设置 ALIYUN_API_KEY"
            return

        prompt = self._build_summary_prompt(text)
        print(f"[流式总结] 开始调用 DashScope 流式 API, prompt 长度: {len(prompt)}")

        loop = asyncio.get_event_loop()
        chunk_queue: queue.Queue = queue.Queue()

        def sync_stream():
            try:
                responses = Generation.call(
                    model='qwen-max',
                    prompt=prompt,
                    temperature=0.7,
                    top_p=0.8,
                    stream=True,
                    incremental_output=True
                )
                print(f"[流式总结] Generation.call 返回, 类型: {type(responses)}")
                chunk_count = 0
                for response in responses:
                    if response.status_code == 200:
                        text_chunk = response.output.text
                        if text_chunk:
                            chunk_count += 1
                            chunk_queue.put(text_chunk)
                    else:
                        print(f"[流式总结] API 错误: {response.status_code} {response.message}")
                        chunk_queue.put(f"\n[生成失败: {response.message}]")
                        break
                print(f"[流式总结] 完成, 共 {chunk_count} 个文本块")
            except Exception as e:
                print(f"[流式总结] 异常: {e}")
                chunk_queue.put(f"\n[调用AI服务失败: {str(e)}]")
            finally:
                chunk_queue.put(None)  # 结束标记

        thread = threading.Thread(target=sync_stream, daemon=True)
        thread.start()

        while True:
            try:
                chunk = await loop.run_in_executor(None, chunk_queue.get)
                if chunk is None:
                    break
                yield chunk
            except Exception as e:
                print(f"[流式总结] 读取队列失败: {e}")
                yield f"\n[流式读取失败: {str(e)}]"
                break

    async def generate_mindmap(self, text: str) -> Dict[str, Any]:
        """调用阿里云百炼生成思维导图结构"""

        if not text or not text.strip():
            return {
                "root": "视频内容",
                "children": [{"text": "无字幕内容", "children": []}]
            }

        # 检查 API Key
        if not self.api_key:
            return {
                "root": "视频内容",
                "children": [{"text": "阿里云 API Key 未配置", "children": []}]
            }

        # 截断过长的文本
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars]

        prompt = f"""请对以下视频字幕生成思维导图结构，用于可视化和梳理视频内容：

{text}

请以严格的JSON格式输出思维导图结构，格式如下：
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

注意：
1. 只输出JSON，不要任何其他内容
2. JSON必须能被JSON.parse解析
3. children可以为空数组[]
4. 每个节点的text字段是必填的"""

        try:
            response = Generation.call(
                model='qwen-max',
                prompt=prompt,
                temperature=0.7,
                top_p=0.8,
                result_format='message'
            )

            if response.status_code == 200:
                response_text = response.output.choices[0].message.content

                # 提取 JSON
                if '```json' in response_text:
                    response_text = response_text.split('```json')[1].split('```')[0]
                elif '```' in response_text:
                    response_text = response_text.split('```')[1].split('```')[0]

                try:
                    return json.loads(response_text.strip())
                except json.JSONDecodeError:
                    return {
                        "root": "视频内容",
                        "children": [{"text": "思维导图解析失败", "children": []}]
                    }
            else:
                return {
                    "root": "视频内容",
                    "children": [{"text": f"生成失败: {response.message}", "children": []}]
                }

        except Exception as e:
            error_msg = str(e)
            if "No API-key" in error_msg or "api_key" in error_msg.lower():
                return {
                    "root": "视频内容",
                    "children": [{"text": "阿里云 API Key 未配置", "children": []}]
                }
            return {
                "root": "视频内容",
                "children": [{"text": f"AI调用失败: {error_msg}", "children": []}]
            }

    async def chat(self, text: str, question: str, history: List[Dict] = None) -> Dict[str, Any]:
        """调用阿里云百炼进行对话问答"""

        if not text or not text.strip():
            return {"answer": "无法回答：没有可用的字幕内容", "history": history or []}

        # 检查 API Key
        if not self.api_key:
            return {"answer": "无法回答：阿里云 API Key 未配置。请在环境变量中设置 ALIYUN_API_KEY", "history": history or []}

        # 截断过长的文本
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars]

        # 构建带上下文的 prompt
        history_text = ""
        if history:
            for h in history[-3:]:  # 只取最近3轮对话
                history_text += f"\n用户：{h.get('question', '')}\n助手：{h.get('answer', '')}"

        prompt = f"""你是一个专业的视频内容分析师。以下是视频的字幕内容：

{text}
{history_text}

请根据以上内容回答用户的问题。如果视频内容中没有相关信息，请说明"视频内容中没有提到"。

用户问题：{question}

请用中文回答。"""

        new_history = history or []

        try:
            response = Generation.call(
                model='qwen-max',
                prompt=prompt,
                temperature=0.7,
                top_p=0.8,
                result_format='message'
            )

            if response.status_code == 200:
                answer = response.output.choices[0].message.content
                new_history.append({"question": question, "answer": answer})
                return {"answer": answer, "history": new_history}
            else:
                return {"answer": f"回答失败: {response.message}", "history": new_history}

        except Exception as e:
            error_msg = str(e)
            if "No API-key" in error_msg or "api_key" in error_msg.lower():
                return {"answer": "无法回答：阿里云 API Key 未配置或无效。请在环境变量中设置 ALIYUN_API_KEY", "history": new_history}
            return {"answer": f"调用AI服务失败: {error_msg}", "history": new_history}


# 全局单例
summarizer = VideoSummarizer()
