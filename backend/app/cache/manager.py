from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite
from fastapi import HTTPException

from app.config import get_settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def account_root(account_id: str) -> Path:
    settings = get_settings()
    root = Path(settings.cache_dir) / account_id
    # Isolation: never allow path traversal
    resolved = root.resolve()
    base = Path(settings.cache_dir).resolve()
    if not str(resolved).startswith(str(base)):
        raise HTTPException(403, "Доступ к чужой папке кэша запрещён")
    root.mkdir(parents=True, exist_ok=True)
    return root


def account_media_root(account_id: str) -> Path:
    settings = get_settings()
    base = Path(settings.media_dir).resolve()
    root = base / account_id
    resolved = root.resolve()
    if not resolved.is_relative_to(base):
        raise HTTPException(403, "Доступ к чужой папке медиа запрещён")
    root.mkdir(parents=True, exist_ok=True)
    return root


def assert_account_path(account_id: str, path: Path) -> Path:
    root = account_root(account_id).resolve()
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise HTTPException(403, "Доступ к чужой папке кэша запрещён")
    return resolved


def assert_account_media_path(account_id: str, path: Path) -> Path:
    root = account_media_root(account_id).resolve()
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise HTTPException(403, "Доступ к чужой папке медиа запрещён")
    return resolved


async def connect_cache(account_id: str) -> aiosqlite.Connection:
    db_path = account_root(account_id) / "cache.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA busy_timeout=5000")
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    await conn.executescript(schema)
    cur = await conn.execute("PRAGMA table_info(cached_messages)")
    columns = {row["name"] for row in await cur.fetchall()}
    if "last_access" not in columns:
        await conn.execute("ALTER TABLE cached_messages ADD COLUMN last_access TEXT")
        await conn.execute(
            "UPDATE cached_messages SET last_access = COALESCE(date, datetime('now')) WHERE last_access IS NULL"
        )
    await conn.commit()
    return conn


def _expires(days: int) -> Optional[str]:
    if days <= 0:
        return None
    return (datetime.now(tz=timezone.utc) + timedelta(days=days)).isoformat()


async def upsert_message(account_id: str, chat_id: int, msg: Any) -> None:
    settings = get_settings()
    conn = await connect_cache(account_id)
    try:
        date = msg.date
        if date and getattr(date, "tzinfo", None) is None:
            date = date.replace(tzinfo=timezone.utc)
        date_s = date.isoformat() if date else None
        waveform = None
        doc = getattr(getattr(msg, "media", None), "document", None)
        if doc:
            for attr in getattr(doc, "attributes", []) or []:
                if getattr(attr, "waveform", None) is not None:
                    waveform = json.dumps(list(attr.waveform)[:40])
                    break
        media_type = None
        if msg.media:
            media_type = type(msg.media).__name__
        await conn.execute(
            """
            INSERT INTO cached_messages
                        (chat_id, id, sender_id, text, date, out, edited, deleted, media_type, waveform_data, expires_at, last_access)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'))
            ON CONFLICT(chat_id, id) DO UPDATE SET
              text=excluded.text,
              edited=excluded.edited,
              media_type=excluded.media_type,
                            waveform_data=excluded.waveform_data,
                            last_access=datetime('now')
            """,
            (
                chat_id,
                msg.id,
                getattr(msg, "sender_id", None),
                msg.message,
                date_s,
                1 if getattr(msg, "out", False) else 0,
                1 if getattr(msg, "edit_date", None) else 0,
                media_type,
                waveform,
                _expires(settings.cache_ttl_days),
            ),
        )
        title = str(chat_id)
        ctype = "user"
        await conn.execute(
            """
            INSERT INTO cached_chats (id, type, title, last_message_date, last_message_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              last_message_date=excluded.last_message_date,
              last_message_id=excluded.last_message_id
            """,
            (chat_id, ctype, title, date_s, msg.id),
        )
        await conn.execute(
            """
            INSERT INTO cached_sources (chat_id, offset_date, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(chat_id) DO UPDATE SET offset_date=excluded.offset_date, updated_at=datetime('now')
            """,
            (chat_id, date_s),
        )
        await conn.commit()
    finally:
        await conn.close()


async def get_chat_offsets(account_id: str) -> dict[int, Optional[datetime]]:
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute("SELECT chat_id, offset_date FROM cached_sources")
        rows = await cur.fetchall()
        out: dict[int, Optional[datetime]] = {}
        for r in rows:
            od = r["offset_date"]
            if od:
                try:
                    out[int(r["chat_id"])] = datetime.fromisoformat(od)
                except ValueError:
                    out[int(r["chat_id"])] = None
            else:
                out[int(r["chat_id"])] = None
        return out
    finally:
        await conn.close()


async def list_cached_messages(
    account_id: str, chat_id: int, limit: int = 50, offset: int = 0
) -> list[dict[str, Any]]:
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            """
            SELECT * FROM cached_messages
            WHERE chat_id = ?
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (chat_id, limit, offset),
        )
        rows = await cur.fetchall()
        if rows:
            await conn.executemany(
                "UPDATE cached_messages SET last_access = datetime('now') WHERE chat_id = ? AND id = ?",
                [(chat_id, row["id"]) for row in rows],
            )
            await conn.commit()
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def purge_account_cache(account_id: str) -> None:
    import shutil

    for root in (account_root(account_id), account_media_root(account_id)):
        if root.exists():
            shutil.rmtree(root, ignore_errors=True)


async def account_cache_bytes(account_id: str) -> int:
    total = 0
    roots = {account_root(account_id), account_media_root(account_id)}
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file():
                try:
                    total += path.stat().st_size
                except OSError:
                    pass
    return total


async def record_cached_media(
    account_id: str,
    chat_id: int,
    message_id: int,
    path: Path,
    mime: str | None = None,
) -> None:
    path = assert_account_media_path(account_id, path)
    stat = path.stat()
    settings = get_settings()
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute("SELECT id FROM cached_media WHERE path = ? LIMIT 1", (str(path),))
        row = await cur.fetchone()
        if row:
            await conn.execute(
                """UPDATE cached_media
                   SET chat_id = ?, message_id = ?, mime = ?, size_bytes = ?,
                       last_access = datetime('now'), expires_at = ?
                   WHERE path = ?""",
                (chat_id, message_id, mime, stat.st_size, _expires(settings.cache_media_ttl_days), str(path)),
            )
        else:
            await conn.execute(
                """INSERT INTO cached_media
                   (chat_id, message_id, path, mime, size_bytes, last_access, expires_at)
                   VALUES (?, ?, ?, ?, ?, datetime('now'), ?)""",
                (chat_id, message_id, str(path), mime, stat.st_size, _expires(settings.cache_media_ttl_days)),
            )
        await conn.commit()
    finally:
        await conn.close()


async def touch_cached_media(
    account_id: str,
    path: Path,
    chat_id: int,
    message_id: int,
) -> None:
    path = assert_account_media_path(account_id, path)
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            "UPDATE cached_media SET last_access = datetime('now') WHERE path = ?",
            (str(path),),
        )
        await conn.commit()
        if cur.rowcount == 0 and path.is_file():
            await record_cached_media(account_id, chat_id, message_id, path)
    finally:
        await conn.close()
