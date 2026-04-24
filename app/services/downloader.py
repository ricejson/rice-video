import yt_dlp
import asyncio
import uuid
from typing import AsyncGenerator, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import threading

from app.core.config import DOWNLOAD_DIR, download_executor
from app.models.task import DownloadTask, TaskStatus, create_task_id


class VideoDownloader:
    """视频下载器，使用 yt-dlp 直接调用"""

    def __init__(self):
        self.download_dir = DOWNLOAD_DIR
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.tasks: Dict[str, DownloadTask] = {}
        self._lock = threading.Lock()

    def create_task(self, url: str) -> DownloadTask:
        """创建下载任务"""
        task_id = create_task_id()
        task = DownloadTask(
            task_id=task_id,
            url=url,
            status=TaskStatus.PENDING
        )
        with self._lock:
            self.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        """获取任务状态"""
        with self._lock:
            return self.tasks.get(task_id)

    def update_task(self, task_id: str, **kwargs) -> None:
        """更新任务状态"""
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                task.updated_at = datetime.now()

    def get_progress(self, task_id: str) -> Dict[str, Any]:
        """获取任务进度"""
        task = self.get_task(task_id)
        if not task:
            return {"status": "not_found"}
        return {
            "task_id": task.task_id,
            "status": task.status,
            "progress": task.progress,
            "speed": task.speed,
            "eta": task.eta,
            "title": task.title,
            "filename": task.filename,
            "error": task.error,
            # 解析相关字段
            "url": task.url,
            "thumbnail": task.thumbnail,
            "description": task.description,
            "duration": task.duration,
            "duration_str": task.duration_str,
            "uploader": task.uploader,
            "platform": task.platform,
            "is_playlist": task.is_playlist,
            "playlist_count": task.playlist_count,
            "entries": task.entries
        }

    async def download(
        self,
        url: str,
        task_id: str,
        quality: str = "best",
        subtitles: bool = False,
        translate: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """异步下载视频，实时推送进度"""

        self.update_task(task_id, status=TaskStatus.DOWNLOADING)

        # 构建格式参数，优先选择 H.264/AVC 编码（QuickTime 兼容）
        if quality == "best":
            # 优先选择 H.264/AVC 编码（QuickTime 兼容），否则降级
            format_spec = "(bestvideo[height<=720][vcodec~='avc']/bestvideo[height<=720])+bestaudio/best"
        else:
            height = quality.replace("p", "")
            format_spec = f"(bestvideo[height<={height}][vcodec~='avc']/bestvideo[height<={height}])+bestaudio/best"

        def progress_hook(d: Dict[str, Any]):
            """进度回调"""
            if d['status'] == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded = d.get('downloaded_bytes', 0)
                speed = d.get('speed', 0)
                eta = d.get('eta', 0)

                progress = (downloaded / total * 100) if total > 0 else 0
                speed_str = self._format_speed(speed) if speed else "N/A"
                eta_str = self._format_eta(eta) if eta else "N/A"

                self.update_task(
                    task_id,
                    progress=progress,
                    speed=speed_str,
                    eta=eta_str
                )
            elif d['status'] == 'finished':
                self.update_task(
                    task_id,
                    progress=100,
                    status=TaskStatus.FINISHED,
                    filename=d.get('filename')
                )

        ydl_opts = {
            'format': format_spec,
            'outtmpl': str(self.download_dir / f'{task_id}.%(ext)s'),
            'merge_output_format': 'mp4',
            'noplaylist': True,
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
            # 从浏览器获取 cookies（支持 Chrome、Firefox、Safari）
            'cookiesfrombrowser': ('chrome', None, None, None),
            # 备用 headers
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        }

        if subtitles:
            ydl_opts['writesubtitles'] = True
            ydl_opts['writeautomaticsub'] = True
            ydl_opts['subtitleslangs'] = ['en', 'zh-Hans']

        if translate:
            ydl_opts['translate-subs'] = True
            ydl_opts['subtitleslangs'] = ['en']

        loop = asyncio.get_event_loop()

        def sync_download():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    return info
            except Exception as e:
                self.update_task(task_id, status=TaskStatus.FAILED, error=str(e))
                raise

        try:
            info = await loop.run_in_executor(download_executor, sync_download)

            self.update_task(
                task_id,
                status=TaskStatus.FINISHED,
                progress=100,
                title=info.get('title', 'unknown') if info else 'unknown',
                filename=f"{task_id}.mp4"
            )

            yield {
                "status": "finished",
                "task_id": task_id,
                "filename": f"{task_id}.mp4",
                "title": info.get('title', 'unknown') if info else 'unknown',
            }
        except Exception as e:
            self.update_task(task_id, status=TaskStatus.FAILED, error=str(e))
            yield {
                "status": "failed",
                "task_id": task_id,
                "error": str(e)
            }

    @staticmethod
    def _format_speed(speed: float) -> str:
        """格式化速度"""
        if speed is None:
            return "N/A"
        if speed > 1024 * 1024:
            return f"{speed / (1024 * 1024):.1f} MB/s"
        elif speed > 1024:
            return f"{speed / 1024:.1f} KB/s"
        else:
            return f"{speed:.0f} B/s"

    @staticmethod
    def _format_eta(seconds: int) -> str:
        """格式化剩余时间"""
        if seconds is None:
            return "N/A"
        if seconds >= 3600:
            return f"{seconds // 3600}h {(seconds % 3600) // 60}m"
        elif seconds >= 60:
            return f"{seconds // 60}m {seconds % 60}s"
        else:
            return f"{seconds}s"

    async def parse_video(self, url: str, task_id: str) -> Dict[str, Any]:
        """解析视频元数据，不下载"""
        self.update_task(task_id, status=TaskStatus.PARSING)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'cookiesfrombrowser': ('chrome', None, None, None),
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        }

        loop = asyncio.get_event_loop()

        def sync_parse():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    return info
            except Exception as e:
                self.update_task(task_id, status=TaskStatus.FAILED, error=str(e))
                raise

        try:
            info = await loop.run_in_executor(download_executor, sync_parse)

            # 提取基本信息
            thumbnail = info.get('thumbnail') if info else None
            fixed_thumbnail = self._fix_thumbnail_url(thumbnail) if thumbnail else None

            # 异步下载缩略图为 base64（绕过防盗链）
            thumbnail_base64 = await self.download_thumbnail_as_base64(fixed_thumbnail) if fixed_thumbnail else None

            result = {
                'task_id': task_id,
                'url': url,
                'title': info.get('title', '未知标题') if info else '未知标题',
                'thumbnail': thumbnail_base64 or fixed_thumbnail,
                'description': info.get('description', '') if info else '',
                'duration': info.get('duration', 0) if info else 0,
                'duration_str': self._format_duration(info.get('duration', 0) if info else 0),
                'uploader': info.get('uploader', '未知作者') if info else '未知作者',
                'platform': self._extract_platform(url),
                'is_playlist': info.get('_type') == 'playlist' if info else False,
                'playlist_count': 0,
                'entries': []
            }

            # 如果是 playlist，提取 entries
            if result['is_playlist'] and info and 'entries' in info:
                entries = info['entries'] or []
                result['playlist_count'] = len(entries)
                result['entries'] = [
                    {
                        'index': i + 1,
                        'title': entry.get('title', f'视频{i+1}') if entry else f'视频{i+1}',
                        'duration': entry.get('duration', 0) if entry else 0,
                        'duration_str': self._format_duration(entry.get('duration', 0) if entry else 0),
                        'thumbnail': self._fix_thumbnail_url(entry.get('thumbnail')) if entry and entry.get('thumbnail') else None
                    }
                    for i, entry in enumerate(entries[:50])  # 最多取50个
                ]

            # 更新任务状态
            self.update_task(
                task_id,
                status=TaskStatus.PARSED,
                title=result['title'],
                thumbnail=result['thumbnail'],
                description=result['description'],
                duration=result['duration'],
                duration_str=result['duration_str'],
                uploader=result['uploader'],
                platform=result['platform'],
                is_playlist=result['is_playlist'],
                playlist_count=result['playlist_count'],
                entries=result['entries']
            )

            return result

        except Exception as e:
            self.update_task(task_id, status=TaskStatus.FAILED, error=str(e))
            raise

    @staticmethod
    def _format_duration(seconds: float) -> str:
        """格式化视频时长"""
        if seconds is None or seconds == 0:
            return "00:00"
        # 确保转换为 int
        seconds = int(seconds)
        if seconds >= 3600:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            return f"{hours}:{minutes:02d}:{secs:02d}"
        else:
            minutes = seconds // 60
            secs = seconds % 60
            return f"{minutes}:{secs:02d}"

    @staticmethod
    def _extract_platform(url: str) -> str:
        """提取视频平台"""
        if 'bilibili.com' in url:
            return '哔哩哔哩'
        elif 'youtube.com' in url or 'youtu.be' in url:
            return 'YouTube'
        elif 'twitter.com' in url or 'x.com' in url:
            return 'X/Twitter'
        elif 'tiktok.com' in url:
            return 'TikTok'
        elif 'douyin.com' in url:
            return '抖音'
        elif 'v.weibo.com' in url:
            return '微博'
        elif 'ixigua.com' in url:
            return '西瓜视频'
        else:
            return '其他'

    @staticmethod
    def _fix_thumbnail_url(thumbnail: str) -> str:
        """修复 thumbnail URL，将 http 转换为 https"""
        if thumbnail and thumbnail.startswith('http://'):
            return thumbnail.replace('http://', 'https://')
        return thumbnail

    @staticmethod
    async def download_thumbnail_as_base64(thumbnail_url: str) -> str:
        """下载缩略图并转为 base64，用于绕过防盗链"""
        import httpx
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
                # 添加 referer 头来绕过防盗链
                headers = {
                    'Referer': 'https://www.bilibili.com/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                response = await client.get(thumbnail_url, headers=headers)
                if response.status_code == 200:
                    import base64
                    img_data = base64.b64encode(response.content).decode('utf-8')
                    mime_type = response.headers.get('content-type', 'image/jpeg')
                    return f"data:{mime_type};base64,{img_data}"
        except Exception as e:
            print(f"下载缩略图失败: {e}")
        return thumbnail_url  # 失败时返回原 URL


# 全局单例
downloader = VideoDownloader()
