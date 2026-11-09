from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.database import read_listener_heartbeat as read_db_heartbeat
from app.database import write_listener_heartbeat as write_db_heartbeat

_lock = asyncio.Lock()


def index_path() -> Path:
    root = Path(get_settings().cache_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root / "_index.json"


async def read_index() -> dict[str, Any]:
    path = index_path()
    if not path.exists():
        return {"accounts": {}, "listener": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"accounts": {}, "listener": {}}


async def write_index(data: dict[str, Any]) -> None:
    path = index_path()
    async with _lock:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def update_listener_heartbeat(listener: dict[str, Any]) -> None:
    await write_db_heartbeat(listener)
    data = await read_index()
    data["listener"] = listener
    await write_index(data)


async def get_listener_heartbeat() -> dict[str, Any]:
    heartbeat = await read_db_heartbeat()
    if heartbeat:
        return heartbeat
    data = await read_index()
    return data.get("listener") or {}
