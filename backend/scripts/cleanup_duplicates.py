#!/usr/bin/env python3
"""Удаление дубликатов аккаунтов по номеру телефона.

По умолчанию работает в режиме «показать, что будет сделано» (dry-run).
Чтобы реально удалить записи и папки — запускать с `--apply`.

Примеры:
    python scripts/cleanup_duplicates.py                      # только отчёт
    python scripts/cleanup_duplicates.py --apply              # удалить дубли
    python scripts/cleanup_duplicates.py --apply --keep-active # оставить аккаунт с сессией

Пути по умолчанию берутся из переменных окружения CACHE_DIR / MEDIA_DIR /
SESSIONS_DIR (как в docker-compose), их можно переопределить флагами.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from pathlib import Path
from typing import Any

# Таблицы, где account_id — внешний ключ на accounts.id.
RELATED_TABLES = (
    "account_devices",
    "account_preferences",
    "channel_settings",
    "archived_chats",
    "chat_folders",
    "chat_folder_chats",
    "antispam_stopwords",
    "antispam_word_history",
    "channel_integrations",
    "bots",
    "push_subscriptions",
    "custom_themes",
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Поиск и удаление дубликатов аккаунтов по phone")
    parser.add_argument("--db", type=Path, default=None, help="путь к _meta.db (по умолчанию CACHE_DIR/_meta.db)")
    parser.add_argument("--cache-dir", type=Path, default=None, help="каталог кэша (по умолчанию CACHE_DIR)")
    parser.add_argument("--media-dir", type=Path, default=None, help="каталог медиа (по умолчанию MEDIA_DIR)")
    parser.add_argument("--sessions-dir", type=Path, default=None, help="каталог сессий (по умолчанию SESSIONS_DIR)")
    parser.add_argument("--apply", action="store_true", help="реально удалить дубликаты")
    parser.add_argument(
        "--keep-active",
        action="store_true",
        help="оставлять запись с живой сессией (auth_state='ok'), иначе — минимальный id",
    )
    return parser.parse_args(argv)


def resolve_paths(args: argparse.Namespace) -> dict[str, Path]:
    cache_dir = args.cache_dir or Path(os.environ.get("CACHE_DIR", "/app/cache_data"))
    media_dir = args.media_dir or Path(os.environ.get("MEDIA_DIR", "/app/media_data"))
    sessions_dir = args.sessions_dir or Path(os.environ.get("SESSIONS_DIR", "/app/sessions"))
    db_path = args.db or (cache_dir / "_meta.db")
    return {
        "db": db_path,
        "cache": cache_dir,
        "media": media_dir,
        "sessions": sessions_dir,
    }


def has_session(account_id: str, sessions_dir: Path) -> bool:
    if not sessions_dir.exists():
        return False
    return any(sessions_dir.glob(f"session_user_{account_id}_*.session")) or any(
        sessions_dir.glob(f"{account_id}.session")
    )


def pick_keeper(rows: list[sqlite3.Row], keep_active: bool, sessions_dir: Path) -> sqlite3.Row:
    if keep_active:
        active = [row for row in rows if row["auth_state"] == "ok"]
        if active:
            with_session = [row for row in active if has_session(row["id"], sessions_dir)]
            pool = with_session or active
            return sorted(pool, key=lambda row: row["id"])[0]
    return sorted(rows, key=lambda row: row["id"])[0]


def safe_rmtree(path: Path, root: Path, label: str, apply: bool) -> bool:
    """Удаляет каталог, только если он внутри ожидаемого корня."""
    try:
        resolved = path.resolve()
        root_resolved = root.resolve()
    except OSError:
        return False
    if resolved == root_resolved or root_resolved not in resolved.parents:
        print(f"    ! пропущено ({label}): путь вне {root_resolved}: {resolved}")
        return False
    if not resolved.exists():
        return False
    if not apply:
        print(f"    · будет удалено ({label}): {resolved}")
        return True
    shutil.rmtree(resolved, ignore_errors=True)
    print(f"    − удалено ({label}): {resolved}")
    return True


def delete_session_files(account_id: str, sessions_dir: Path, apply: bool) -> list[Path]:
    found: list[Path] = []
    if not sessions_dir.exists():
        return found
    for pattern in (f"session_user_{account_id}_*.session", f"{account_id}.session"):
        for path in sessions_dir.glob(pattern):
            found.append(path)
            for suffix in ("", "-journal", "-wal", "-shm"):
                candidate = Path(str(path) + suffix)
                if not candidate.exists():
                    continue
                if apply:
                    candidate.unlink(missing_ok=True)
                else:
                    print(f"    · будет удалён файл сессии: {candidate}")
    return found


def delete_account(conn: sqlite3.Connection, account_id: str, apply: bool) -> None:
    for table in RELATED_TABLES:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        if not exists:
            continue
        if apply:
            conn.execute(f"DELETE FROM {table} WHERE account_id = ?", (account_id,))
        else:
            count = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE account_id = ?", (account_id,)).fetchone()[0]
            if count:
                print(f"    · {table}: {count} строк")
    if apply:
        conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))


def main(argv: list[str] | None = None) -> int:
    # Windows-консоль по умолчанию cp1251 — переключаем вывод на UTF-8,
    # чтобы отчёт читался одинаково и локально, и в контейнере.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args(argv)
    paths = resolve_paths(args)
    db_path = paths["db"]

    if not db_path.exists():
        print(f"База не найдена: {db_path}")
        return 2

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"Режим: {mode} · база: {db_path}")
    print(f"Каталоги: cache={paths['cache']} media={paths['media']} sessions={paths['sessions']}\n")

    duplicates = conn.execute(
        "SELECT phone, COUNT(*) AS c FROM accounts WHERE phone <> '' GROUP BY phone HAVING c > 1 ORDER BY c DESC"
    ).fetchall()

    if not duplicates:
        print("Дубликатов по номеру телефона нет.")
        empty_pending = conn.execute(
            "SELECT COUNT(*) FROM accounts WHERE phone = '' AND auth_state = 'pending'"
        ).fetchone()[0]
        if empty_pending:
            print(f"Замечание: {empty_pending} записей без номера (QR-заглушки) — их не трогаем.")
        return 0

    removed_total = 0
    for duplicate in duplicates:
        phone = duplicate["phone"]
        rows = conn.execute(
            "SELECT id, phone, name, auth_state, created_at FROM accounts WHERE phone = ? ORDER BY id",
            (phone,),
        ).fetchall()
        keeper = pick_keeper(rows, args.keep_active, paths["sessions"])
        extras = [row for row in rows if row["id"] != keeper["id"]]
        print(f"Номер {phone}: {len(rows)} записей → оставляем {keeper['id']} ({keeper['auth_state']})")
        for row in extras:
            print(f"  - дубль {row['id']} ({row['auth_state']}, создан {row['created_at']})")
            delete_account(conn, row["id"], args.apply)
            safe_rmtree(paths["cache"] / row["id"], paths["cache"], "cache", args.apply)
            safe_rmtree(paths["media"] / row["id"], paths["media"], "media", args.apply)
            delete_session_files(row["id"], paths["sessions"], args.apply)
            removed_total += 1
        print()

    if args.apply:
        conn.commit()
        conn.execute("VACUUM")
        print(f"Готово: удалено {removed_total} дубликатов.")
        print("Индекс уникальности phone создастся при следующем старте бэкенда (init_db).")
    else:
        conn.rollback()
        print(f"Dry-run: удалено было бы {removed_total} дубликатов. Повторите с --apply.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
