from fastapi import APIRouter

router = APIRouter(prefix="/api/subscribe", tags=["subscribe"])


@router.get("/plans")
async def get_plans():
    """获取订阅套餐（预留 Phase 4）"""
    return {
        "code": 0,
        "message": "success",
        "data": [
            {"id": "free", "name": "免费版", "price": 0, "daily_limit": 3, "quality": "720p"},
            {"id": "monthly", "name": "月卡", "price": 29, "daily_limit": 50, "quality": "1080p"},
            {"id": "yearly", "name": "年卡", "price": 199, "daily_limit": 200, "quality": "4K"},
        ]
    }
