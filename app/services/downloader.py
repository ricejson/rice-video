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
            "error": task.error
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


# 全局单例
downloader = VideoDownloader()
