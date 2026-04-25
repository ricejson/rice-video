from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import asyncio

from app.models.task import DownloadRequest, DownloadResponse, TaskStatus
from app.services.downloader import downloader

router = APIRouter(prefix="/api/download", tags=["download"])


@router.post("", response_model=DownloadResponse)
async def create_download_task(req: DownloadRequest):
    """提交下载任务"""
    task = downloader.create_task(req.url)

    # 启动异步下载（不等待完成）
    asyncio.create_task(_run_download(
        task.task_id,
        req.url,
        req.quality,
        req.subtitles,
        req.translate
    ))

    return DownloadResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status
        }
    )


async def _run_download(
    task_id: str,
    url: str,
    quality: str,
    subtitles: bool,
    translate: bool
):
    """运行下载任务"""
    await downloader.download(
        url=url,
        task_id=task_id,
        quality=quality,
        subtitles=subtitles,
        translate=translate
    )


@router.get("/status/{task_id}", response_model=DownloadResponse)
async def get_task_status(task_id: str):
    """查询任务状态"""
    task = downloader.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return DownloadResponse(
        code=0,
        message="success",
        data=downloader.get_progress(task_id)
    )


@router.get("/file/{task_id}")
async def download_file(task_id: str):
    """下载文件"""
    task = downloader.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.FINISHED:
        raise HTTPException(status_code=400, detail="Task not finished")

    from app.core.config import DOWNLOAD_DIR
    file_path = DOWNLOAD_DIR / task.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=task.filename,
        media_type="video/mp4"
    )
