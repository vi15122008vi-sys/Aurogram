from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import aiosqlite

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    name TEXT DEFAULT '',
    username TEXT,
    auth_state TEXT DEFAULT 'ok',
    api_id_enc TEXT,
    api_hash_enc TEXT,
    token TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    last_sync TEXT,
    meta_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS channel_settings (
    account_id TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    antispam_json TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (account_id, channel_id)
);

CREATE TABLE IF NOT EXISTS antispam_stopwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'custom',
    enabled INTEGER NOT NULL DEFAULT 1,
    is_regex INTEGER NOT NULL DEFAULT 0,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    UNIQUE(account_id, channel_id, word, category)
);

CREATE TABLE IF NOT EXISTS antispam_word_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    actor TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    name TEXT DEFAULT '',
    token_enc TEXT NOT NULL,
    webhook_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    endpoint TEXT UNIQUE NOT NULL,
    keys_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listener_heartbeat (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL,
    uptime INTEGER NOT NULL DEFAULT 0,
    accounts_active INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT,
    errors_24h INTEGER NOT NULL DEFAULT 0,
    ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    name TEXT NOT NULL,
    tokens_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stopwords_channel
    ON antispam_stopwords(account_id, channel_id, category);
CREATE INDEX IF NOT EXISTS idx_word_history_channel
    ON antispam_word_history(account_id, channel_id, created_at);
"""


def meta_db_path() -> Path:
    settings = get_settings()
    root = Path(settings.cache_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root / "_meta.db"


async def connect(path: Optional[Path] = None) -> aiosqlite.Connection:
    db_path = path or meta_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA busy_timeout=5000")
    await conn.execute("PRAGMA foreign_keys=ON")
    return conn


async def init_db() -> None:
    settings = get_settings()
    Path(settings.sessions_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.cache_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    conn = await connect()
    try:
        await conn.executescript(SCHEMA)
        await conn.commit()
    finally:
        await conn.close()


async def fetchone(sql: str, params: tuple[Any, ...] = ()) -> Optional[aiosqlite.Row]:
    conn = await connect()
    try:
        cur = await conn.execute(sql, params)
        return await cur.fetchone()
    finally:
        await conn.close()


async def fetchall(sql: str, params: tuple[Any, ...] = ()) -> list[aiosqlite.Row]:
    conn = await connect()
    try:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()
    finally:
        await conn.close()


async def execute(sql: str, params: tuple[Any, ...] = ()) -> int:
    conn = await connect()
    try:
        cur = await conn.execute(sql, params)
        await conn.commit()
        return cur.lastrowid or 0
    finally:
        await conn.close()


async def executemany(sql: str, seq: list[tuple[Any, ...]]) -> None:
    conn = await connect()
    try:
        await conn.executemany(sql, seq)
        await conn.commit()
    finally:
        await conn.close()


async def write_listener_heartbeat(heartbeat: dict[str, Any]) -> None:
    await execute(
        """INSERT INTO listener_heartbeat
           (id, status, uptime, accounts_active, last_message_at, errors_24h, ts)
           VALUES (1, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             uptime = excluded.uptime,
             accounts_active = excluded.accounts_active,
             last_message_at = excluded.last_message_at,
             errors_24h = excluded.errors_24h,
             ts = excluded.ts""",
        (
            str(heartbeat.get("status", "dead")),
            int(heartbeat.get("uptime", 0)),
            int(heartbeat.get("accounts_active", 0)),
            heartbeat.get("last_message_at"),
            int(heartbeat.get("errors_24h", 0)),
            str(heartbeat.get("ts", "")),
        ),
    )


async def read_listener_heartbeat() -> dict[str, Any]:
    row = await fetchone("SELECT * FROM listener_heartbeat WHERE id = 1")
    return dict(row) if row else {}
