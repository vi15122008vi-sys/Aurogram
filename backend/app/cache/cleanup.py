from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.cache.manager import account_media_root, account_root, connect_cache
from app.config import get_settings
from app.database import fetchall

log = logging.getLogger("aurogram.cleanup")


def _dir_size(path: Path) -> int:
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


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


async def _compact_account(account_id: str) -> None:
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        await cur.fetchall()
        await cur.close()
        cur = await conn.execute("VACUUM")
        await cur.close()
    finally:
        await conn.close()


async def run_cleanup() -> dict:
    settings = get_settings()
    cache_root = Path(settings.cache_dir)
    media_root = Path(settings.media_dir)
    max_bytes = int(settings.cache_max_size_gb * (1024**3))
    target = int(max_bytes * settings.cache_target_ratio)
    now = datetime.now(tz=timezone.utc)
    min_keep = now - timedelta(days=settings.cache_min_keep_days)

    freed = 0
    msg_removed = 0
    media_removed = 0

    accounts = await fetchall("SELECT id FROM accounts")
    account_ids = [r["id"] for r in accounts]
    # also scan folders
    for data_root in (cache_root, media_root):
        if data_root.exists():
            for child in data_root.iterdir():
                if child.is_dir() and not child.name.startswith("_") and child.name not in account_ids:
                    account_ids.append(child.name)

    # TTL pass, including old records created before TTL was enabled.
    for aid in account_ids:
        conn = await connect_cache(aid)
        changed = False
        try:
            if settings.cache_ttl_days > 0:
                cutoff = (now - timedelta(days=settings.cache_ttl_days)).isoformat()
                cur = await conn.execute(
                    """DELETE FROM cached_messages
                       WHERE (expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now'))
                          OR (date IS NOT NULL AND datetime(date) <= datetime(?))""",
                    (cutoff,),
                )
                removed = cur.rowcount or 0
                msg_removed += removed
                changed |= removed > 0

            media_cutoff = (
                now - timedelta(days=settings.cache_media_ttl_days)
                if settings.cache_media_ttl_days > 0
                else None
            )
            cur = await conn.execute(
                "SELECT id, path, created_at, expires_at FROM cached_media"
            )
            media_rows = await cur.fetchall()
            account_dir = account_root(aid).resolve()
            media_account_dir = account_media_root(aid).resolve()
            for row in media_rows:
                path = Path(row["path"])
                resolved = path.resolve()
                expires_at = _parse_datetime(row["expires_at"])
                created_at = _parse_datetime(row["created_at"])
                expired = bool(expires_at and expires_at <= now)
                expired |= bool(media_cutoff and created_at and created_at <= media_cutoff)
                if path.exists() and not (
                    resolved.is_relative_to(media_account_dir) or resolved.is_relative_to(account_dir)
                ):
                    log.warning("ignoring cache path outside account root: %s", path)
                    continue
                if not path.exists():
                    expired = True
                if not expired:
                    continue
                if path.is_file():
                    try:
                        size = path.stat().st_size
                        path.unlink(missing_ok=True)
                        freed += size
                        media_removed += 1
                    except OSError:
                        log.warning("could not remove expired media %s", path)
                        continue
                await conn.execute("DELETE FROM cached_media WHERE id = ?", (row["id"],))
                changed = True

            if media_cutoff:
                media_folders = (
                    media_account_dir / "media",
                    media_account_dir / "media_transcoded",
                    account_dir / "media",
                    account_dir / "media_transcoded",
                )
                for folder in media_folders:
                    if not folder.exists():
                        continue
                    for path in folder.rglob("*"):
                        if not path.is_file():
                            continue
                        try:
                            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
                            if modified <= media_cutoff:
                                size = path.stat().st_size
                                path.unlink(missing_ok=True)
                                freed += size
                                media_removed += 1
                                await conn.execute("DELETE FROM cached_media WHERE path = ?", (str(path),))
                                changed = True
                        except OSError:
                            continue
            await conn.commit()
        finally:
            await conn.close()
        if changed:
            await _compact_account(aid)

    # LRU by size when over budget (TTL==0 or still over).
    # Порядок жёсткий: сначала самое давно неиспользуемое медиа, и только потом —
    # сообщения, да и то лишь при CACHE_EVICT_MESSAGES=true.
    total = _dir_size(cache_root) + _dir_size(media_root)
    if total <= max_bytes:
        if freed or msg_removed or media_removed:
            log.info(
                "cleanup: freed %.1f GB, %s messages, %s media",
                freed / (1024**3),
                msg_removed,
                media_removed,
            )
        return {"freed": freed, "messages": msg_removed, "media": media_removed}

    # Use recorded access time where available; file atime covers unindexed media.
    access_by_path: dict[str, float] = {}
    metadata_paths: dict[str, tuple[str, str]] = {}
    for aid in account_ids:
        conn = await connect_cache(aid)
        try:
            cur = await conn.execute("SELECT path, last_access FROM cached_media")
            for row in await cur.fetchall():
                path_key = str(Path(row["path"]).resolve())
                access_at = _parse_datetime(row["last_access"])
                if access_at:
                    access_by_path[path_key] = access_at.timestamp()
                metadata_paths[path_key] = (aid, row["path"])
        finally:
            await conn.close()

    # Prefer entries outside the soft minimum-retention window, then evict true LRU.
    media_files: list[tuple[int, float, Path, str]] = []
    for aid in account_ids:
        media_account_dir = account_media_root(aid)
        legacy_cache_dir = account_root(aid)
        media_folders = (
            media_account_dir / "media",
            media_account_dir / "media_transcoded",
            legacy_cache_dir / "media",
            legacy_cache_dir / "media_transcoded",
        )
        for folder in media_folders:
            if not folder.exists():
                continue
            for p in folder.rglob("*"):
                if not p.is_file():
                    continue
                try:
                    st = p.stat()
                except OSError:
                    continue
                access_time = access_by_path.get(str(p.resolve()), st.st_atime or st.st_mtime)
                priority = 0 if datetime.fromtimestamp(access_time, tz=timezone.utc) <= min_keep else 1
                media_files.append((priority, access_time, p, aid))

    media_files.sort(key=lambda item: (item[0], item[1]))
    removed_metadata: dict[str, set[str]] = {}
    for _priority, _access_time, path, aid in media_files:
        if total <= target:
            break
        try:
            sz = path.stat().st_size
            path.unlink(missing_ok=True)
            freed += sz
            total -= sz
            media_removed += 1
            entry = metadata_paths.get(str(path.resolve()))
            if entry:
                removed_metadata.setdefault(entry[0], set()).add(entry[1])
        except OSError:
            pass

    for aid, paths in removed_metadata.items():
        conn = await connect_cache(aid)
        try:
            await conn.executemany(
                "DELETE FROM cached_media WHERE path = ?",
                [(path,) for path in paths],
            )
            await conn.commit()
        finally:
            await conn.close()
        await _compact_account(aid)
    total = _dir_size(cache_root) + _dir_size(media_root)

    if total > target:
        if settings.cache_evict_messages:
            # Осознанный opt-in: вытесняем самые давно читавшиеся сообщения.
            for aid in account_ids:
                while total > target:
                    conn = await connect_cache(aid)
                    try:
                        cur = await conn.execute(
                            """SELECT chat_id, id FROM cached_messages
                               ORDER BY COALESCE(last_access, date, '') ASC LIMIT 5000"""
                        )
                        rows = await cur.fetchall()
                        if not rows:
                            break
                        await conn.executemany(
                            "DELETE FROM cached_messages WHERE chat_id = ? AND id = ?",
                            [(row["chat_id"], row["id"]) for row in rows],
                        )
                        msg_removed += len(rows)
                        await conn.commit()
                        await conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                        await conn.execute("VACUUM")
                    finally:
                        await conn.close()
                    total = _dir_size(cache_root) + _dir_size(media_root)
                if total <= target:
                    break
        else:
            # Медиа закончилось, а лимит всё ещё превышен: историю не трогаем,
            # только подчищаем WAL, чтобы не раздувались служебные файлы.
            for aid in account_ids:
                conn = await connect_cache(aid)
                try:
                    await conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                    await conn.commit()
                finally:
                    await conn.close()
            log.warning(
                "cleanup: %.2f GB > %.2f GB после LRU медиа; сообщения не удаляем "
                "(CACHE_EVICT_MESSAGES=false)",
                total / (1024**3),
                max_bytes / (1024**3),
            )

    log.info(
        "cleanup: freed %.1f GB, %s messages, %s media",
        freed / (1024**3),
        msg_removed,
        media_removed,
    )
    return {"freed": freed, "messages": msg_removed, "media": media_removed}
