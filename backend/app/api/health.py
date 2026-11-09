from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import shutil

from fastapi import APIRouter

from app.cache.index import get_listener_heartbeat
from app.config import get_settings
from app.database import fetchall

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    settings = get_settings()
    heartbeat = await get_listener_heartbeat()
    accounts = await fetchall("SELECT id FROM accounts WHERE auth_state = 'ok'")

    listener_status = str(heartbeat.get("status", "dead"))
    heartbeat_time = heartbeat.get("ts")
    if heartbeat_time:
        try:
            timestamp = datetime.fromisoformat(str(heartbeat_time))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - timestamp).total_seconds() > 90:
                listener_status = "dead"
        except ValueError:
            listener_status = "dead"
    else:
        listener_status = "dead"

    try:
        usage = shutil.disk_usage(Path(settings.cache_dir))
        disk_pct = round(usage.used / usage.total * 100, 1) if usage.total else 0.0
    except OSError:
        disk_pct = 0.0

    status = "ok" if listener_status == "ok" else "degraded"
    return {
        "status": status,
        "listener": listener_status if listener_status in {"ok", "reconnecting", "dead"} else "dead",
        "accounts_alive": len(accounts),
        "disk_pct": disk_pct,
    }