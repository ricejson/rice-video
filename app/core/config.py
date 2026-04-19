import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 全局下载线程池，限制并发数
download_executor = ThreadPoolExecutor(max_workers=3)

# 免费用户：1 个并发，付费用户：3-5 个并发
FREE_MAX_CONCURRENT = 1
PAID_MAX_CONCURRENT = 3

# JWT 配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# AI 服务配置（Phase 2/3 使用）
ALIYUN_API_KEY = os.getenv("ALIYUN_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
