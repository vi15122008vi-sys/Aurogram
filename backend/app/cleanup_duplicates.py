"""Чистка дублей аккаунтов по номеру телефона.

Запуск внутри контейнера:
    docker compose exec backend python -m app.cleanup_duplicates            # dry-run
    docker compose exec backend python -m app.cleanup_duplicates --apply    # удалить

Оставляет одну запись на номер (приоритет: auth_state='ok', затем минимальный id),
удаляет остальные строки из accounts и связанных таблиц, а также папки
cache_data/{id} и media_data/{id} и файлы сессий удалённых записей.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from pathlib import Path

RELATED_TABLES = (
    "account_devices",
    "account_preferences",
    "channel_settings",
    "channel_welcome",
    "channel_integrations",
    "account_profiles",
    "archived_chats",
    "chat_folders",
    "chat_folder_chats",
    "antispam_stopwords",
    "antispam_word_history",
    "bots",
    "push_subscriptions",
    "custom_themes",
)


def _paths() -> dict[str, Path]:
    cache = Path(os.environ.get("CACHE_DIR", "/app/cache_data"))
    return {
        "db": cache / "_meta.db",
        "cache": cache,
        "media": Path(os.environ.get("MEDIA_DIR", "/app/media_data")),
        "sessions": Path(os.environ.get("SESSIONS_DIR", "/app/sessions")),
    }


def _pick_keeper(rows: list[sqlite3.Row], sessions: Path) -> sqlite3.Row:
    """Приоритет: рабочая сессия → наличие файла сессии → самая старая запись."""

    def has_session(row: sqlite3.Row) -> int:
        return int(any(sessions.glob(f"session_user_{row['id']}_*.session")))

    return sorted(
        rows,
        key=lambda row: (
            0 if row["auth_state"] == "ok" else 1,
            0 if has_session(row) else 1,
            str(row["created_at"] or ""),
            row["id"],
        ),
    )[0]


def _rm(path: Path, root: Path, apply: bool) -> bool:
    try:
        resolved, base = path.resolve(), root.resolve()
    except OSError:
        return False
    if resolved == base or base not in resolved.parents or not resolved.exists():
        return False
    if apply:
        shutil.rmtree(resolved, ignore_errors=True)
    return True


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Удаление дублей аккаунтов по phone")
    parser.add_argument("--apply", action="store_true", help="реально удалить (по умолчанию dry-run)")
    args = parser.parse_args(argv)

    paths = _paths()
    if not paths["db"].exists():
        print(f"База не найдена: {paths['db']}")
        return 2

    conn = sqlite3.connect(str(paths["db"]))
    conn.row_factory = sqlite3.Row
    duplicates = conn.execute(
        "SELECT phone, COUNT(*) AS c FROM accounts WHERE phone <> '' GROUP BY phone HAVING c > 1"
    ).fetchall()
    if not duplicates:
        print("Дубликатов нет.")
        conn.close()
        return 0

    removed = 0
    for duplicate in duplicates:
        phone = duplicate["phone"]
        rows = conn.execute(
            "SELECT id, phone, auth_state, created_at FROM accounts WHERE phone = ?", (phone,)
        ).fetchall()
        keeper = _pick_keeper(rows, paths["sessions"])
        print(f"{phone}: {len(rows)} записей → оставляем {keeper['id']} ({keeper['auth_state']})")
        for row in rows:
            if row["id"] == keeper["id"]:
                continue
            print(f"  − дубль {row['id']} ({row['auth_state']})")
            for table in RELATED_TABLES:
                exists = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
                ).fetchone()
                if exists and args.apply:
                    conn.execute(f"DELETE FROM {table} WHERE account_id = ?", (row["id"],))
            if args.apply:
                conn.execute("DELETE FROM accounts WHERE id = ?", (row["id"],))
            _rm(paths["cache"] / row["id"], paths["cache"], args.apply)
            _rm(paths["media"] / row["id"], paths["media"], args.apply)
            for pattern in (f"session_user_{row['id']}_*.session", f"{row['id']}.session"):
                for path in paths["sessions"].glob(pattern) if paths["sessions"].exists() else []:
                    if args.apply:
                        path.unlink(missing_ok=True)
            removed += 1

    if args.apply:
        conn.commit()
        conn.execute("VACUUM")
        print(f"Готово: удалено {removed} дублей.")
        print("Перезапустите бэкенд — init_db создаст UNIQUE-индекс по phone.")
    else:
        conn.rollback()
        print(f"Dry-run: удалено было бы {removed}. Повторите с --apply.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
