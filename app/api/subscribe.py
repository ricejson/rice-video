from fastapi import APIRouter, Depends
from app.core.security import get_optional_user
from app.core.config import STRIPE_VIP_PRICE_ID
from typing import Optional

router = APIRouter(prefix="/api/subscribe", tags=["subscribe"])


@router.get("/plans")
async def get_plans(user: Optional[dict] = Depends(get_optional_user)):
    """获取订阅套餐"""
    return {
        "code": 0,
        "message": "success",
        "data": [
            {
                "id": "free",
                "name": "免费版",
                "price": 0,
                "currency": "CNY",
                "daily_limit": 3,
                "quality": "720p",
                "features": ["每日 3 次下载", "单视频下载", "720p 清晰度", "AI 视频总结"],
            },
            {
                "id": "vip",
                "name": "VIP 会员",
                "price": 9.9,
                "currency": "CNY",
                "interval": "month",
                "daily_limit": 50,
                "quality": "4K",
                "features": ["每日 50 次下载", "批量下载", "4K 超清画质", "字幕下载", "AI 视频总结", "优先支持"],
            },
        ],
    }
