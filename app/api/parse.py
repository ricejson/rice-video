from fastapi import APIRouter, HTTPException
import asyncio

from app.models.task import ParseRequest, ParseResponse
from app.services.downloader import downloader

router = APIRouter(prefix="/api/parse", tags=["parse"])


@router.post("", response_model=ParseResponse)
async def parse_video_url(req: ParseRequest):
    """解析视频元数据（封面、标题、描述、时长等）"""
    # 创建任务
    task = downloader.create_task(req.url)

    # 启动异步解析（不等待完成）
    asyncio.create_task(_run_parse(task.task_id, req.url))

    return ParseResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status
        }
    )


async def _run_parse(task_id: str, url: str):
    """运行解析任务"""
    try:
        await downloader.parse_video(url, task_id)
    except Exception:
        # 错误已在 parse_video 中处理
        pass


@router.get("/{task_id}", response_model=ParseResponse)
async def get_parse_result(task_id: str):
    """获取解析结果"""
    task = downloader.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    progress = downloader.get_progress(task_id)

    return ParseResponse(
        code=0,
        message="success",
        data=progress
    )
