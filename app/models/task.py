from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import uuid


class TaskStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    PARSED = "parsed"
    DOWNLOADING = "downloading"
    FINISHED = "finished"
    FAILED = "failed"


class DownloadTask(BaseModel):
    task_id: str
    url: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    speed: Optional[str] = None
    eta: Optional[str] = None
    title: Optional[str] = None
    filename: Optional[str] = None
    error: Optional[str] = None
    # 解析相关字段
    thumbnail: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    uploader: Optional[str] = None
    platform: Optional[str] = None
    is_playlist: bool = False
    playlist_count: int = 0
    entries: list = []
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

    class Config:
        use_enum_values = True


class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"
    format: str = "mp4"
    subtitles: bool = False
    translate: bool = False


class DownloadResponse(BaseModel):
    code: int = 0
    message: str = "success"
    data: Optional[Dict[str, Any]] = None


class ParseRequest(BaseModel):
    url: str


class ParseResponse(BaseModel):
    code: int = 0
    message: str = "success"
    data: Optional[Dict[str, Any]] = None


class SummarizeRequest(BaseModel):
    url: str
    formats: list = ["text", "mindmap", "chat"]


class ChatRequest(BaseModel):
    task_id: str
    question: str


class SummaryTask(BaseModel):
    task_id: str
    url: str
    status: TaskStatus = TaskStatus.PENDING
    # 字幕相关
    subtitles_available: bool = False
    subtitles: list = []
    subtitle_text: Optional[str] = None
    subtitle_with_timestamps: Optional[str] = None  # 带时间戳的原始字幕
    # 总结结果
    summary_text: Optional[str] = None
    summary_mindmap: Optional[Dict[str, Any]] = None
    # 对话上下文
    chat_history: list = []
    error: Optional[str] = None
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

    class Config:
        use_enum_values = True


def create_task_id() -> str:
    return str(uuid.uuid4())
