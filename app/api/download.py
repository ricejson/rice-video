from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import asyncio

from app.models.task import DownloadRequest, DownloadResponse, TaskStatus
from app.models.user import PLAN_LIMITS
from app.services.downloader import downloader
from app.core.database import get_db
from app.core.security import get_optional_user

router = APIRouter(prefix="/api/download", tags=["download"])


@router.post("", response_model=DownloadResponse)
async def create_download_task(
    req: DownloadRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """提交下载任务（含套餐权限检查）"""
    db = await get_db()

    # 确定用户权限
    user_id = user.get("sub") if user else None
    plan_id = "free"

    if user_id:
        # 从数据库获取最新套餐信息
        cursor = await db.execute("SELECT plan_id FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            plan_id = row["plan_id"]

    limits = PLAN_LIMITS.get(plan_id, PLAN_LIMITS["free"])

    # 检查每日下载次数
    if user_id:
        today = date.today().isoformat()
        cursor = await db.execute(
            "SELECT daily_download_count, download_count_date FROM subscriptions WHERE user_id = ?",
            (user_id,),
        )
        sub = await cursor.fetchone()
        if sub:
            count_date = sub["download_count_date"]
            count = sub["daily_download_count"]

            # 新的一天，重置计数
            if count_date != today:
                count = 0
                await db.execute(
                    "UPDATE subscriptions SET daily_download_count = 0, download_count_date = ?, updated_at = ? WHERE user_id = ?",
                    (today, date.today().isoformat(), user_id),
                )

            if count >= limits["daily_downloads"]:
                raise HTTPException(
                    status_code=429,
                    detail=f"今日下载次数已达上限 ({limits['daily_downloads']} 次)，请明天再试或升级 VIP",
                )

            # 增加下载计数
            await db.execute(
                "UPDATE subscriptions SET daily_download_count = daily_download_count + 1, download_count_date = ?, updated_at = ? WHERE user_id = ?",
                (today, date.today().isoformat(), user_id),
            )
            await db.commit()

    # 检查字幕下载权限
    if req.subtitles and not user_id:
        raise HTTPException(status_code=403, detail="字幕下载需要登录，请先注册免费账号")

    if req.subtitles and not limits["subtitle_download"]:
        raise HTTPException(status_code=403, detail="字幕下载是 VIP 专属功能，请升级套餐")

    # 检查清晰度限制（将 quality 和 limits max_quality 做对比）
    req_quality_height = _quality_to_height(req.quality)
    max_height = _quality_to_height(limits["max_quality"])
    if req_quality_height > max_height:
        raise HTTPException(
            status_code=403,
            detail=f"当前套餐最高支持 {limits['max_quality']} 清晰度，请升级 VIP",
        )

    task = downloader.create_task(req.url)

    # 启动异步下载
    asyncio.create_task(_run_download(
        task.task_id,
        req.url,
        req.quality,
        req.subtitles,
        req.translate,
    ))

    return DownloadResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status,
            "plan_id": plan_id,
        },
    )


def _quality_to_height(quality: str) -> int:
    """将 quality 字符串转为像素高度数值"""
    quality_map = {
        "best": 720,  # 默认 best=720p
        "720p": 720,
        "1080p": 1080,
        "1440p": 1440,
        "4K": 2160,
        "2160p": 2160,
    }
    return quality_map.get(quality, 720)


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
