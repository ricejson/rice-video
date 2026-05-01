from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import List, Optional

from app.models.task import SummarizeRequest, ChatRequest, SummaryTask, TaskStatus, ParseResponse, create_task_id
from app.models.user import PLAN_LIMITS
from app.services.summarizer import summarizer
from app.core.database import get_db
from app.core.security import get_optional_user

router = APIRouter(prefix="/api/summarize", tags=["summarize"])

# 存储总结任务（内存）
summary_tasks: dict = {}


def get_task(task_id: str) -> SummaryTask:
    """获取任务"""
    return summary_tasks.get(task_id)


def create_summary_task(url: str) -> SummaryTask:
    """创建总结任务"""
    task_id = create_task_id()
    task = SummaryTask(
        task_id=task_id,
        url=url,
        status=TaskStatus.PENDING
    )
    summary_tasks[task_id] = task
    return task


def update_task(task_id: str, **kwargs) -> None:
    """更新任务状态"""
    if task_id in summary_tasks:
        task = summary_tasks[task_id]
        for key, value in kwargs.items():
            if hasattr(task, key):
                setattr(task, key, value)
        from datetime import datetime
        task.updated_at = datetime.now()


async def _check_summarize_quota(user: Optional[dict]) -> tuple[int, int, str]:
    """检查 AI 总结配额，返回 (剩余次数, 每日上限, plan_id) 或抛出 HTTPException"""
    if not user or not user.get("sub"):
        raise HTTPException(status_code=401, detail="AI 总结功能需要登录，请先注册免费账号")

    db = await get_db()
    user_id = user["sub"]
    today = date.today().isoformat()

    # 获取用户套餐
    cursor = await db.execute("SELECT plan_id FROM users WHERE id = ?", (user_id,))
    row = await cursor.fetchone()
    plan_id = row["plan_id"] if row else "free"
    limits = PLAN_LIMITS.get(plan_id, PLAN_LIMITS["free"])
    daily_limit = limits["daily_summaries"]

    # 获取今日使用次数
    cursor = await db.execute(
        "SELECT daily_summary_count, summary_count_date FROM subscriptions WHERE user_id = ?",
        (user_id,),
    )
    sub = await cursor.fetchone()
    count = 0
    if sub:
        count_date = sub["summary_count_date"]
        count = sub["daily_summary_count"]
        # 新的一天，重置计数
        if count_date != today:
            count = 0
            await db.execute(
                "UPDATE subscriptions SET daily_summary_count = 0, summary_count_date = ?, updated_at = ? WHERE user_id = ?",
                (today, today, user_id),
            )

    if count >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"今日 AI 总结次数已达上限 ({daily_limit} 次)，请明天再试或升级 VIP",
        )

    remaining = daily_limit - count
    return remaining, daily_limit, plan_id


async def _increment_summary_count(user_id: str):
    """增加 AI 总结使用计数"""
    db = await get_db()
    today = date.today().isoformat()
    await db.execute(
        "UPDATE subscriptions SET daily_summary_count = daily_summary_count + 1, summary_count_date = ?, updated_at = ? WHERE user_id = ?",
        (today, today, user_id),
    )
    await db.commit()


@router.post("", response_model=ParseResponse)
async def create_summarize_task(req: SummarizeRequest):
    """提交视频总结任务"""

    # 创建任务
    task = create_summary_task(req.url)

    # 异步执行总结
    asyncio.create_task(_run_summarize(task.task_id, req.url, req.formats))

    return ParseResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status
        }
    )


async def _run_summarize(task_id: str, url: str, formats: List[str]):
    """执行总结任务"""

    try:
        update_task(task_id, status=TaskStatus.PARSING)

        # 1. 提取字幕
        sub_info = await summarizer.extract_subtitles(url, task_id)

        if not sub_info['subtitles_available']:
            update_task(
                task_id,
                status=TaskStatus.FAILED,
                error="该视频没有可用字幕"
            )
            return

        subtitle_text = sub_info.get('subtitle_text', '')

        # 更新字幕信息
        update_task(
            task_id,
            subtitles_available=True,
            subtitles=sub_info.get('subtitles', []),
            subtitle_text=subtitle_text,
            subtitle_with_timestamps=sub_info.get('subtitle_with_timestamps', '')
        )

        # 2. 生成文本总结
        text_summary = None
        if 'text' in formats:
            update_task(task_id, status=TaskStatus.PARSING)
            text_summary = await summarizer.generate_text_summary(subtitle_text)
            update_task(task_id, summary_text=text_summary)

        # 3. 生成思维导图
        mindmap = None
        if 'mindmap' in formats:
            mindmap = await summarizer.generate_mindmap(subtitle_text)
            update_task(task_id, summary_mindmap=mindmap)

        # 完成任务
        update_task(
            task_id,
            status=TaskStatus.FINISHED
        )

    except Exception as e:
        update_task(task_id, status=TaskStatus.FAILED, error=str(e))


@router.post("/stream")
async def create_summarize_stream(
    req: SummarizeRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """提交视频总结任务 - SSE 流式输出文本总结（需登录，消耗每日配额）"""

    # 配额检查（在生成器外执行）
    remaining, daily_limit, plan_id = await _check_summarize_quota(user)
    user_id = user["sub"]

    task_id = create_task_id()
    summary_tasks[task_id] = SummaryTask(
        task_id=task_id,
        url=req.url,
        status=TaskStatus.PENDING
    )

    async def event_generator():
        quota_consumed = False
        try:
            # 状态：开始提取字幕
            yield f"data: {json.dumps({'type': 'status', 'message': '正在提取字幕...', 'task_id': task_id, 'quota_remaining': remaining, 'quota_limit': daily_limit})}\n\n"

            sub_info = await summarizer.extract_subtitles(req.url, task_id)

            if not sub_info['subtitles_available']:
                yield f"data: {json.dumps({'type': 'error', 'message': '该视频没有可用字幕'})}\n\n"
                return

            # 字幕提取成功，消耗配额
            if not quota_consumed:
                await _increment_summary_count(user_id)
                quota_consumed = True

            subtitle_text = sub_info.get('subtitle_text', '')
            subtitle_with_timestamps = sub_info.get('subtitle_with_timestamps', '')

            # 保存总结任务
            summary_tasks[task_id].subtitle_text = subtitle_text
            summary_tasks[task_id].subtitle_with_timestamps = subtitle_with_timestamps
            summary_tasks[task_id].subtitles_available = True
            summary_tasks[task_id].status = TaskStatus.PARSING

            yield f"data: {json.dumps({'type': 'status', 'message': '正在生成AI总结...', 'task_id': task_id, 'subtitle_with_timestamps': subtitle_with_timestamps})}\n\n"

            # 流式生成文本总结
            full_text = ""
            async for chunk in summarizer.generate_text_summary_stream(subtitle_text):
                full_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk, 'task_id': task_id})}\n\n"

            # 保存文本总结
            summary_tasks[task_id].summary_text = full_text

            # 先发送 done，结束 loading 状态
            summary_tasks[task_id].status = TaskStatus.FINISHED
            yield f"data: {json.dumps({'type': 'done', 'task_id': task_id, 'full_text': full_text})}\n\n"

            # 再异步生成思维导图（不阻塞文本展示）
            if 'mindmap' in req.formats:
                try:
                    mindmap = await summarizer.generate_mindmap(subtitle_text)
                    summary_tasks[task_id].summary_mindmap = mindmap
                    yield f"data: {json.dumps({'type': 'mindmap', 'data': mindmap, 'task_id': task_id})}\n\n"
                except Exception as e:
                    print(f"思维导图生成失败: {e}")

        except Exception as e:
            summary_tasks[task_id].status = TaskStatus.FAILED
            summary_tasks[task_id].error = str(e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/{task_id}", response_model=ParseResponse)
async def get_summarize_result(task_id: str):
    """获取总结结果"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return ParseResponse(
        code=0,
        message="success",
        data={
            "task_id": task.task_id,
            "status": task.status,
            "error": task.error,
            "result": {
                "text_summary": task.summary_text,
                "mindmap": task.summary_mindmap,
                "subtitle_with_timestamps": task.subtitle_with_timestamps
            },
            "subtitles_available": task.subtitles_available,
            "subtitles": task.subtitles
        }
    )


@router.post("/chat", response_model=ParseResponse)
async def chat_with_video(
    req: ChatRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """AI 对话问答（需登录，消耗每日配额）"""

    # 配额检查
    remaining, daily_limit, plan_id = await _check_summarize_quota(user)
    user_id = user["sub"]

    task = get_task(req.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.subtitle_text:
        raise HTTPException(status_code=400, detail="没有可用的字幕内容")

    # 调用 AI 对话
    result = await summarizer.chat(
        text=task.subtitle_text,
        question=req.question,
        history=task.chat_history
    )

    # 消耗配额
    await _increment_summary_count(user_id)

    # 更新对话历史
    if result.get('history'):
        update_task(req.task_id, chat_history=result['history'])

    return ParseResponse(
        code=0,
        message="success",
        data={
            "answer": result.get('answer', '抱歉，回答失败')
        }
    )
