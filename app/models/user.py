from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class UserInDB(BaseModel):
    id: str
    email: str
    password_hash: str
    plan_id: str = "free"
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


class UserPublic(BaseModel):
    id: str
    email: str
    plan_id: str
    created_at: str


class SubscriptionInDB(BaseModel):
    id: str
    user_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    plan_id: str = "free"
    status: str = "active"
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    canceled_at: Optional[str] = None
    daily_download_count: int = 0
    download_count_date: Optional[str] = None
    daily_summary_count: int = 0
    summary_count_date: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class UserRegisterRequest(BaseModel):
    email: str
    password: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    code: int = 0
    message: str = "success"
    data: Optional[Dict[str, Any]] = None


class CreateCheckoutRequest(BaseModel):
    plan_id: str = "vip"
    success_url: str = ""
    cancel_url: str = ""


# 套餐权限常量
PLAN_LIMITS = {
    "free": {"daily_downloads": -1, "daily_summaries": 3,  "max_quality": "4K", "max_concurrent": 1, "subtitle_download": True},
    "vip":  {"daily_downloads": -1, "daily_summaries": 50, "max_quality": "4K", "max_concurrent": 3, "subtitle_download": True},
}
