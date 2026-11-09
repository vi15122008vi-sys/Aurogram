from __future__ import annotations

from pathlib import Path
from typing import Optional
import mimetypes

from app.cache.manager import account_media_root
from app.config import get_settings
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


def media_path(account_id: str, chat_id: int, message_id: int, ext: str = "bin") -> Path:
    settings = get_settings()
    root = account_media_root(account_id) / "media" / str(chat_id)
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{message_id}.{ext}"


async def download_message_media(
    account: dict,
    chat_id: int,
    message_id: int,
) -> Optional[Path]:
    client = await get_client(account["id"], account)
    msg = await with_floodwait(lambda: client.get_messages(chat_id, ids=message_id))
    if not msg or not msg.media:
        return None
    dest_dir = account_media_root(account["id"]) / "media" / str(chat_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = await with_floodwait(
        lambda: client.download_media(msg, file=str(dest_dir / str(message_id)))
    )
    if not path:
        return None
    result = Path(path)
    from app.cache.manager import record_cached_media

    await record_cached_media(
        account["id"],
        chat_id,
        message_id,
        result,
        mimetypes.guess_type(result.name)[0],
    )
    return result


def resolve_media_file(account_id: str, chat_id: int, message_id: int) -> Optional[Path]:
    settings = get_settings()
    folders = (
        account_media_root(account_id) / "media" / str(chat_id),
        Path(settings.cache_dir) / account_id / "media" / str(chat_id),
    )
    for folder in folders:
        if not folder.exists():
            continue
        matches = list(folder.glob(f"{message_id}.*"))
        for match in matches:
            if "transcoded" not in str(match):
                return match
        if matches:
            return matches[0]
    return None
