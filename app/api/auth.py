from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.models.user import UserRegisterRequest, UserLoginRequest, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(req: UserRegisterRequest):
    """用户注册"""
    db = await get_db()

    # 检查邮箱是否已注册
    cursor = await db.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if await cursor.fetchone():
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    password_hash = hash_password(req.password)

    await db.execute(
        "INSERT INTO users (id, email, password_hash, plan_id, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
        (user_id, req.email, password_hash, now, now),
    )

    # 创建对应的免费订阅记录
    sub_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO subscriptions (id, user_id, plan_id, status, created_at, updated_at) VALUES (?, ?, 'free', 'active', ?, ?)",
        (sub_id, user_id, now, now),
    )

    await db.commit()

    token = create_access_token(data={"sub": user_id, "email": req.email, "plan": "free"})

    return AuthResponse(data={"token": token, "user": {"id": user_id, "email": req.email, "plan_id": "free"}})


@router.post("/login", response_model=AuthResponse)
async def login(req: UserLoginRequest):
    """用户登录"""
    db = await get_db()

    cursor = await db.execute("SELECT id, email, password_hash, plan_id FROM users WHERE email = ?", (req.email,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token(data={"sub": row["id"], "email": row["email"], "plan": row["plan_id"]})

    return AuthResponse(data={
        "token": token,
        "user": {"id": row["id"], "email": row["email"], "plan_id": row["plan_id"]},
    })


@router.get("/me", response_model=AuthResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    db = await get_db()

    cursor = await db.execute(
        "SELECT u.id, u.email, u.plan_id, u.created_at, s.status, s.current_period_end, s.daily_download_count "
        "FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id WHERE u.id = ?",
        (user["sub"],),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    return AuthResponse(data={
        "user": {
            "id": row["id"],
            "email": row["email"],
            "plan_id": row["plan_id"],
            "created_at": row["created_at"],
        },
        "subscription": {
            "status": row["status"],
            "current_period_end": row["current_period_end"],
            "daily_download_count": row["daily_download_count"],
        },
    })
