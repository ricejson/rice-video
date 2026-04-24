from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import download, task, subscribe, parse

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


@app.get("/")
async def root():
    return {"message": "万能视频下载器 API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
