from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import download, task, subscribe, parse, summarize, auth, payment
from app.core.database import get_db, close_db

app = FastAPI(
    title="万能视频下载器 API",
    description="一款轻量级多平台视频下载工具",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(download.router)
app.include_router(task.router)
app.include_router(subscribe.router)
app.include_router(parse.router)
app.include_router(summarize.router)
app.include_router(auth.router)
app.include_router(payment.router)


@app.on_event("startup")
async def startup():
    await get_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/")
async def root():
    return {"message": "万能视频下载器 API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
