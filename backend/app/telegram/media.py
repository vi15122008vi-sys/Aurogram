from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path
from typing import Optional

from telethon.errors import FileReferenceExpiredError

from app.cache.manager import account_media_root
from app.config import get_settings
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait

# Превью: 640px по длинной стороне — хватает для сетки медиа-библиотеки,
# а весит в 10–40 раз меньше оригинала.
THUMB_MAX_SIDE = 640
THUMB_QUALITY = 80
THUMB_DIR = "thumbs"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
MIN_THUMB_SOURCE_BYTES = 40_000


def media_path(account_id: str, chat_id: int, message_id: int, ext: str = "bin") -> Path:
    settings = get_settings()
    root = account_media_root(account_id) / "media" / str(chat_id)
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{message_id}.{ext}"


def thumb_path(account_id: str, chat_id: int, message_id: int) -> Path:
    """Превью живёт в отдельной папке, чтобы не попадать под glob оригиналов."""
    root = account_media_root(account_id) / "media" / str(chat_id) / THUMB_DIR
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{message_id}.jpg"


def _image_thumb(source: Path, target: Path) -> bool:
    """Синхронная ресайзилка (вызывается через asyncio.to_thread)."""
    try:
        from PIL import Image
    except ImportError:  # Pillow не установлен — превью просто не будет
        return False
    try:
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE))
            image.save(target, "JPEG", quality=THUMB_QUALITY, optimize=True)
        return target.is_file()
    except Exception:
        return False


async def _video_thumb(source: Path, target: Path) -> bool:
    """Первый кадр видео через ffmpeg (он уже нужен для видеосообщений)."""
    try:
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", "1", "-i", str(source),
            "-frames:v", "1",
            "-vf", f"scale='min({THUMB_MAX_SIDE},iw)':-2",
            str(target),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
    except (FileNotFoundError, OSError):
        return False
    try:
        await asyncio.wait_for(process.communicate(), timeout=25)
    except asyncio.TimeoutError:
        process.kill()
        return False
    return process.returncode == 0 and target.is_file()


async def ensure_thumbnail(
    account_id: str,
    chat_id: int,
    message_id: int,
    source: Path,
) -> Optional[Path]:
    """Гарантирует наличие превью. Возвращает None, если сделать не удалось."""
    try:
        if not source.is_file():
            return None
        size = source.stat().st_size
        target = thumb_path(account_id, chat_id, message_id)
        if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
            return target
        suffix = source.suffix.lower()
        if suffix in IMAGE_SUFFIXES:
            if size < MIN_THUMB_SOURCE_BYTES:
                return None
            ok = await asyncio.to_thread(_image_thumb, source, target)
        elif suffix in VIDEO_SUFFIXES:
            ok = await _video_thumb(source, target)
        else:
            ok = False
        if not ok:
            return None
        return target if target.is_file() else None
    except OSError:
        return None


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
    try:
        path = await with_floodwait(
            lambda: client.download_media(msg, file=str(dest_dir / str(message_id)))
        )
    except FileReferenceExpiredError:
        # Telegram file references are short-lived; fetch a fresh message object once and retry.
        fresh_message = await with_floodwait(lambda: client.get_messages(chat_id, ids=message_id))
        if not fresh_message or not fresh_message.media:
            return None
        try:
            path = await with_floodwait(
                lambda: client.download_media(fresh_message, file=str(dest_dir / str(message_id)))
            )
        except FileReferenceExpiredError:
            return None
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
    # Превью готовим сразу после попадания файла в кэш: сетка медиа грузится мгновенно.
    try:
        await ensure_thumbnail(account["id"], chat_id, message_id, result)
    except Exception:
        pass
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
