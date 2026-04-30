from datetime import datetime
import uuid

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends

from app.core.config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_VIP_PRICE_ID
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import CreateCheckoutRequest, AuthResponse

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/payment", tags=["payment"])


def _sget(obj, key, default=None):
    """安全地从 StripeObject 或 dict 中取值"""
    try:
        return obj[key]
    except (KeyError, TypeError):
        return default


@router.post("/create-checkout", response_model=AuthResponse)
async def create_checkout_session(
    req: CreateCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """创建 Stripe Checkout 支付会话"""
    db = await get_db()

    # 检查是否已经是 VIP
    cursor = await db.execute("SELECT plan_id, stripe_customer_id FROM users WHERE id = ?", (user["sub"],))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    if row["plan_id"] == "vip":
        raise HTTPException(status_code=400, detail="您已是 VIP 会员")

    try:
        # 查找或创建 Stripe Customer
        customer_id = row["stripe_customer_id"]
        if not customer_id:
            customer = stripe.Customer.create(email=user.get("email", ""))
            customer_id = customer["id"]
            await db.execute(
                "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
                (customer_id, user["sub"]),
            )

        # 创建 Checkout Session
        success_url = req.success_url or "http://localhost:3000/success"
        cancel_url = req.cancel_url or "http://localhost:3000/"

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": STRIPE_VIP_PRICE_ID, "quantity": 1}],
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            metadata={"user_id": user["sub"]},
        )

        return AuthResponse(data={"checkout_url": session["url"]})

    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=f"创建支付会话失败: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """接收 Stripe Webhook 事件"""
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        return {"status": "error", "message": "Webhook secret not configured"}

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    db = await get_db()

    # 幂等性检查
    event_id = event["id"]
    cursor = await db.execute(
        "SELECT 1 FROM idempotency_records WHERE idempotency_key = ?", (event_id,)
    )
    if await cursor.fetchone():
        return {"status": "ok", "message": "Already processed"}

    now = datetime.utcnow().isoformat()

    # 根据事件类型分发处理
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, data, event_id, now)

    elif event_type == "invoice.paid":
        await _handle_invoice_paid(db, data, event_id, now)

    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, data, event_id, now)

    # 记录幂等
    await db.execute(
        "INSERT INTO idempotency_records (idempotency_key, event_type, processed_at) VALUES (?, ?, ?)",
        (event_id, event_type, now),
    )
    await db.commit()

    return {"status": "ok"}


async def _handle_checkout_completed(db, session, event_id: str, now: str):
    """处理支付完成 - 开通 VIP"""
    # Stripe session 对象使用 [] 访问
    metadata = _sget(session, "metadata", {})
    user_id = _sget(metadata, "user_id")
    if not user_id:
        return

    subscription_id = _sget(session, "subscription")
    amount_total = _sget(session, "amount_total")
    currency = _sget(session, "currency")
    session_id = _sget(session, "id")

    # 更新用户套餐
    await db.execute("UPDATE users SET plan_id = 'vip', updated_at = ? WHERE id = ?", (now, user_id))

    # 更新用户 stripe_customer_id
    customer_id = _sget(session, "customer")
    if customer_id:
        await db.execute("UPDATE users SET stripe_customer_id = ? WHERE id = ?", (customer_id, user_id))

    # 更新订阅记录
    if subscription_id:
        sub_info = stripe.Subscription.retrieve(subscription_id)
        period_start = _sget(sub_info, "current_period_start") or _sget(sub_info, "created")
        period_end = _sget(sub_info, "current_period_end") or (period_start + 2592000 if period_start else None)  # fallback: 30 days
        ps = datetime.utcfromtimestamp(period_start).isoformat() if period_start else now
        pe = datetime.utcfromtimestamp(period_end).isoformat() if period_end else now

        # 先尝试更新已有记录
        cursor = await db.execute(
            "UPDATE subscriptions SET plan_id = 'vip', stripe_subscription_id = ?, stripe_customer_id = ?, "
            "status = 'active', current_period_start = ?, current_period_end = ?, updated_at = ? "
            "WHERE user_id = ?",
            (subscription_id, customer_id, ps, pe, now, user_id),
        )
        if cursor.rowcount == 0:
            await db.execute(
                """INSERT INTO subscriptions
                   (id, user_id, stripe_subscription_id, stripe_customer_id, plan_id, status,
                    current_period_start, current_period_end, daily_download_count, download_count_date,
                    created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'vip', 'active', ?, ?, 0, NULL, ?, ?)""",
                (str(uuid.uuid4()), user_id, subscription_id, customer_id, ps, pe, now, now),
            )
    else:
        await db.execute(
            "UPDATE subscriptions SET plan_id = 'vip', status = 'active', updated_at = ? WHERE user_id = ?",
            (now, user_id),
        )

    # 记录支付日志
    log_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO payment_logs (id, user_id, stripe_event_id, stripe_session_id, amount_total, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)",
        (log_id, user_id, event_id, session_id, amount_total, currency, now),
    )


async def _handle_invoice_paid(db, invoice, event_id: str, now: str):
    """处理续费成功"""
    subscription_id = _sget(invoice, "subscription")
    if not subscription_id:
        return

    await db.execute(
        "UPDATE subscriptions SET status = 'active', updated_at = ? WHERE stripe_subscription_id = ?",
        (now, subscription_id),
    )


async def _handle_subscription_deleted(db, subscription, event_id: str, now: str):
    """处理订阅取消"""
    subscription_id = _sget(subscription, "id")
    if not subscription_id:
        return

    await db.execute(
        "UPDATE users SET plan_id = 'free', updated_at = ? WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1)",
        (now, subscription_id),
    )
    await db.execute(
        "UPDATE subscriptions SET plan_id = 'free', status = 'expired', canceled_at = ?, updated_at = ? WHERE stripe_subscription_id = ?",
        (now, now, subscription_id),
    )
