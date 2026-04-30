import aiosqlite
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "rice_video.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

_connection: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _connection
    if _connection is None:
        _connection = await aiosqlite.connect(str(DB_PATH))
        _connection.row_factory = aiosqlite.Row
        await _connection.executescript(_SCHEMA)
        await _connection.commit()
        # 迁移：为旧数据库添加缺失的列
        await _run_migrations(_connection)
    return _connection


async def close_db():
    global _connection
    if _connection:
        await _connection.close()
        _connection = None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    plan_id             TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id  TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL,
    stripe_subscription_id  TEXT,
    stripe_customer_id      TEXT,
    plan_id                 TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active',
    current_period_start    TEXT,
    current_period_end      TEXT,
    canceled_at             TEXT,
    daily_download_count    INTEGER NOT NULL DEFAULT 0,
    download_count_date     TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    processed_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_logs (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    stripe_event_id     TEXT NOT NULL,
    stripe_session_id   TEXT,
    amount_total        INTEGER,
    currency            TEXT,
    status              TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""

_MIGRATIONS = [
    # 为旧数据库添加 stripe_customer_id 列
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
]

async def _run_migrations(db: aiosqlite.Connection):
    """Execute database migrations to add missing columns"""
    # 获取 users 表已有列
    cursor = await db.execute("PRAGMA table_info(users)")
    rows = await cursor.fetchall()
    existing_cols = {row["name"] for row in rows}

    for sql in _MIGRATIONS:
        try:
            # 简单解析 ALTER TABLE ... ADD COLUMN <col_name> ...
            col_name = sql.split("ADD COLUMN ")[1].split(" ")[0]
            if col_name not in existing_cols:
                await db.execute(sql)
                await db.commit()
        except Exception as e:
            print(f"Migration warning: {e}")
