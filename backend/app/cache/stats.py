from __future__ import annotations

from pathlib import Path
from typing import Any

from app.cache.manager import account_cache_bytes, account_root, connect_cache
from app.config import get_settings
from app.database import fetchall


def _size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for p in path.rglob("*"):
        if p.is_file():
            try:
                total += p.stat().st_size
            except OSError:
                pass
    return total


async def global_stats() -> dict[str, Any]:
    settings = get_settings()
    root = Path(settings.cache_dir)
    total = _size(root) + _size(Path(settings.media_dir))
    accounts = await fetchall("SELECT id, name, phone FROM accounts")
    per = []
    messages_total = 0
    media_total = 0
    for a in accounts:
        aid = a["id"]
        bytes_ = await account_cache_bytes(aid)
        conn = await connect_cache(aid)
        try:
            cur = await conn.execute("SELECT COUNT(*) AS c FROM cached_messages")
            mc = (await cur.fetchone())["c"]
            cur = await conn.execute("SELECT COUNT(*) AS c, COALESCE(SUM(size_bytes),0) AS s FROM cached_media")
            row = await cur.fetchone()
            messages_total += mc
            media_total += row["c"]
            per.append(
                {
                    "account_id": aid,
                    "name": a["name"],
                    "phone": a["phone"],
                    "bytes": bytes_,
                    "messages": mc,
                    "media": row["c"],
                }
            )
        finally:
            await conn.close()

    return {
        "total_bytes": total,
        "max_bytes": int(settings.cache_max_size_gb * (1024**3)),
        "messages": messages_total,
        "media": media_total,
        "accounts": per,
        "ttl_days": settings.cache_ttl_days,
        "media_ttl_days": settings.cache_media_ttl_days,
        "min_keep_days": settings.cache_min_keep_days,
    }


async def growth_30d(account_id: str | None = None) -> list[dict[str, Any]]:
    # Approximate: count messages per day from cache
    accounts = [account_id] if account_id else [r["id"] for r in await fetchall("SELECT id FROM accounts")]
    buckets: dict[str, int] = {}
    for aid in accounts:
        conn = await connect_cache(aid)
        try:
            cur = await conn.execute(
                """
                SELECT substr(date, 1, 10) AS d, COUNT(*) AS c
                FROM cached_messages
                WHERE date IS NOT NULL AND date >= datetime('now', '-30 days')
                GROUP BY d
                ORDER BY d
                """
            )
            for r in await cur.fetchall():
                buckets[r["d"]] = buckets.get(r["d"], 0) + r["c"]
        finally:
            await conn.close()
    return [{"date": k, "count": buckets[k]} for k in sorted(buckets.keys())]
