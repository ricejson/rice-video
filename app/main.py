from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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

# 注册 API 路由（必须在静态文件挂载之前）
app.include_router(download.router)
app.include_router(task.router)
app.include_router(subscribe.router)
app.include_router(parse.router)
app.include_router(summarize.router)
app.include_router(auth.router)
app.include_router(payment.router)

# 静态文件目录：Docker 部署使用 static/，本地开发使用 web/out/
_BASE = Path(__file__).resolve().parent.parent
STATIC_DIR = _BASE / "static"
if not STATIC_DIR.exists():
    _web_out = _BASE / "web" / "out"
    if _web_out.exists():
        STATIC_DIR = _web_out

# 挂载 Next.js 静态资源 (_next/static, favicon 等)
if STATIC_DIR.exists():
    _next_dir = STATIC_DIR / "_next"
    if _next_dir.exists():
        app.mount("/_next", StaticFiles(directory=str(_next_dir)), name="next_static")


@app.on_event("startup")
async def startup():
    await get_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/health")
async def health():
    return {"status": "ok"}


# 前端页面兜底路由 —— 必须在所有 API 路由之后注册
if STATIC_DIR.exists():

    async def _serve_static(full_path: str):
        """Serve static files with .html fallback for clean URLs."""
        file_path = STATIC_DIR / full_path

        # 直接命中文件 (favicon.ico, file.svg 等)
        if file_path.is_file():
            return FileResponse(file_path)

        # /login → login.html, /register → register.html 等
        if full_path:
            html_path = STATIC_DIR / f"{full_path}.html"
            if html_path.is_file():
                return FileResponse(html_path)

        # /some/path/ → /some/path/index.html
        index_path = file_path / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)

        # 最终兜底: index.html (SPA 回退)
        fallback = STATIC_DIR / "index.html"
        if fallback.is_file():
            return FileResponse(fallback)

        return FileResponse(STATIC_DIR / "404.html") if (STATIC_DIR / "404.html").is_file() else {"message": "Not Found"}

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}, 404
        return await _serve_static(full_path)

    @app.get("/")
    async def serve_root():
        index = STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        return {"message": "万能视频下载器 API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
