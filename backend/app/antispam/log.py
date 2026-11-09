from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Optional

import aiosqlite

from app.config import get_settings

LOG_SCHEMA = """
CREATE TABLE IF NOT EXISTS antispam_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER,
    username TEXT,
    reason TEXT,
    action TEXT,
    matched_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_antispam_log_ch ON antispam_log(channel_id, created_at);
"""


def _db_path(account_id: str) -> Path:
    root = Path(get_settings().cache_dir) / account_id
    root.mkdir(parents=True, exist_ok=True)
    return root / "antispam_log.db"


async def _conn(account_id: str) -> aiosqlite.Connection:
    path = _db_path(account_id)
    conn = await aiosqlite.connect(str(path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA busy_timeout=5000")
    await conn.executescript(LOG_SCHEMA)
    await conn.commit()
    return conn


async def write_log(
    account_id: str,
    channel_id: int,
    user_id: Optional[int],
    username: Optional[str],
    reason: str,
    action: str,
    matched: List[str],
) -> None:
    conn = await _conn(account_id)
    try:
        await conn.execute(
            """
            INSERT INTO antispam_log (channel_id, user_id, username, reason, action, matched_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (channel_id, user_id, username, reason, action, json.dumps(matched, ensure_ascii=False)),
        )
        await conn.commit()
    finally:
        await conn.close()


async def read_log(account_id: str, channel_id: int, limit: int = 50) -> list[dict[str, Any]]:
    conn = await _conn(account_id)
    try:
        cur = await conn.execute(
            """
            SELECT id, channel_id, user_id, username, reason, action, matched_json, created_at
            FROM antispam_log
            WHERE channel_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (channel_id, limit),
        )
        rows = await cur.fetchall()
        out = []
        for r in rows:
            out.append(
                {
                    "id": r["id"],
                    "channel_id": r["channel_id"],
                    "user_id": r["user_id"],
                    "username": r["username"],
                    "reason": r["reason"],
                    "action": r["action"],
                    "matched": json.loads(r["matched_json"] or "[]"),
                    "created_at": r["created_at"],
                }
            )
        return out
    finally:
        await conn.close()


async def metrics_24h(account_id: str, channel_id: int) -> dict[str, int]:
    conn = await _conn(account_id)
    try:
        cur = await conn.execute(
            """
            SELECT action, COUNT(*) AS c FROM antispam_log
            WHERE channel_id = ? AND created_at >= datetime('now', '-1 day')
            GROUP BY action
            """,
            (channel_id,),
        )
        rows = await cur.fetchall()
        data = {r["action"]: r["c"] for r in rows}
        return {
            "deleted": data.get("delete", 0) + data.get("mute", 0) + data.get("ban", 0),
            "mutes": data.get("mute", 0),
            "bans": data.get("ban", 0),
        }
    finally:
        await conn.close()
