from fastapi import APIRouter, HTTPException
import asyncio
from typing import List

from app.models.task import SummarizeRequest, ChatRequest, SummaryTask, TaskStatus, ParseResponse, create_task_id
from app.services.summarizer import summarizer

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
async def chat_with_video(req: ChatRequest):
    """AI 对话问答"""

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
