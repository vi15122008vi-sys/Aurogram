from __future__ import annotations

import shutil
from typing import Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response

from app.cache.manager import account_cache_bytes
from app.cache.manager import purge_account_cache
from app.config import get_settings
from app.deps import get_current_account
from app.models import AccountOut, CachePurgeRequest
from app.telegram.auth import logout

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    account: dict[str, Any] = Depends(get_current_account),
) -> list[AccountOut]:
    cache_bytes = await account_cache_bytes(account["id"])
    return [
        AccountOut(
            id=account["id"],
            name=account["name"] or account["phone"],
            phone=account["phone"],
            username=account["username"],
            auth_state=account["auth_state"],
            last_sync=account["last_sync"],
            cache_bytes=cache_bytes,
        )
    ]


@router.delete("/current", status_code=204)
async def remove_current_account(
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    await logout(account, purge_cache=False)
    response = Response(status_code=204)
    response.delete_cookie("auth_token", path="/")
    return response


@router.get("/current/cache")
async def cache_status(
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    settings = get_settings()
    root = Path(settings.cache_dir) / account["id"]
    try:
        disk = shutil.disk_usage(root if root.exists() else Path(settings.cache_dir))
        disk_pct = round(disk.used / disk.total * 100, 1) if disk.total else 0.0
    except OSError:
        disk_pct = 0.0
    return {
        "bytes": await account_cache_bytes(account["id"]),
        "disk_pct": disk_pct,
        "max_size_gb": settings.cache_max_size_gb,
        "ttl_days": settings.cache_ttl_days,
        "media_ttl_days": settings.cache_media_ttl_days,
    }


@router.post("/current/cache/purge", status_code=204)
async def purge_cache(
    payload: CachePurgeRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    if payload.confirm != f"PURGE {account['id']}":
        raise HTTPException(status_code=400, detail="Подтверждение очистки не совпадает")
    await purge_account_cache(account["id"])
    return Response(status_code=204)