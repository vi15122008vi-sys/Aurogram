from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable, Optional

from app.antispam.stemmer import stem_text
from app.database import execute, executemany, fetchall, fetchone
from app.models import AntiSpamSettings, StopWord

BUILTIN_PATH = Path(__file__).parent / "builtin" / "stopwords_ru.json"


def load_builtin() -> dict[str, Any]:
    with open(BUILTIN_PATH, encoding="utf-8") as f:
        return json.load(f)


def builtin_words_for_level(level: str) -> list[StopWord]:
    data = load_builtin()
    cats = data.get("categories", {})
    selected: list[str]
    if level == "soft":
        selected = ["ads", "profanity"]
    elif level == "medium":
        selected = ["ads", "profanity", "crypto", "casino", "bets"]
    else:
        selected = ["ads", "profanity", "crypto", "casino", "bets", "politics"]

    out: list[StopWord] = []
    for cat in selected:
        block = cats.get(cat) or {}
        words = block.get("words") or []
        # soft: take first ~30 from ads+profanity combined already limited in JSON subsets
        if level == "soft" and cat == "ads":
            words = words[:20]
        if level == "soft" and cat == "profanity":
            words = words[:15]
        for w in words:
            out.append(
                StopWord(
                    word=w,
                    category=cat,  # type: ignore[arg-type]
                    enabled=True,
                    is_regex=w.startswith("re:"),
                    is_builtin=True,
                )
            )
    return out


async def ensure_seeded(account_id: str, channel_id: int, level: str = "soft") -> None:
    words = builtin_words_for_level(level)
    await executemany(
        """
        INSERT OR IGNORE INTO antispam_stopwords
        (account_id, channel_id, word, category, enabled, is_regex, is_builtin, created_by)
        VALUES (?, ?, ?, ?, 1, ?, 1, 'system')
        """,
        [
            (account_id, channel_id, word.word, word.category, int(word.is_regex))
            for word in words
        ],
    )


async def list_words(
    account_id: str,
    channel_id: int,
    category: Optional[str] = None,
    q: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[StopWord]:
    sql = "SELECT * FROM antispam_stopwords WHERE account_id = ? AND channel_id = ?"
    params: list[Any] = [account_id, channel_id]
    if category:
        sql += " AND category = ?"
        params.append(category)
    if enabled is not None:
        sql += " AND enabled = ?"
        params.append(1 if enabled else 0)
    if q:
        sql += " AND word LIKE ?"
        params.append(f"%{q}%")
    sql += " ORDER BY category, word"
    rows = await fetchall(sql, tuple(params))
    return [
        StopWord(
            id=r["id"],
            word=r["word"],
            category=r["category"],
            enabled=bool(r["enabled"]),
            is_regex=bool(r["is_regex"]),
            is_builtin=bool(r["is_builtin"]),
            created_at=r["created_at"],
            created_by=r["created_by"],
        )
        for r in rows
    ]


def match_stopwords(
    text: str,
    words: Iterable[StopWord],
    settings: AntiSpamSettings,
) -> list[str]:
    if not text:
        return []
    src = text if settings.case_sensitive else text.lower()
    stemmed_src = stem_text(src, case_sensitive=settings.case_sensitive) if settings.stem else src
    matched: list[str] = []
    for w in words:
        if not w.enabled:
            continue
        raw = w.word
        is_regex = w.is_regex or raw.startswith("re:")
        pattern = raw[3:] if raw.startswith("re:") else raw
        if is_regex:
            flags = 0 if settings.case_sensitive else re.IGNORECASE
            try:
                if re.search(pattern, text, flags):
                    matched.append(w.word)
            except re.error:
                continue
            continue
        needle = pattern if settings.case_sensitive else pattern.lower()
        if settings.stem:
            needle = stem_text(needle, case_sensitive=settings.case_sensitive)
            hay = stemmed_src
        else:
            hay = src
        if settings.exact_match:
            tokens = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", hay)
            needle_tokens = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", needle)
            if needle_tokens and any(
                tokens[index : index + len(needle_tokens)] == needle_tokens
                for index in range(len(tokens) - len(needle_tokens) + 1)
            ):
                matched.append(w.word)
        else:
            if needle and needle in hay:
                matched.append(w.word)
    return matched


async def add_history(account_id: str, channel_id: int, action: str, detail: str, actor: str | None) -> None:
    await execute(
        """
        INSERT INTO antispam_word_history (account_id, channel_id, action, detail, actor)
        VALUES (?, ?, ?, ?, ?)
        """,
        (account_id, channel_id, action, detail, actor),
    )
    # keep 30 days
    await execute(
        """
        DELETE FROM antispam_word_history
        WHERE account_id = ? AND channel_id = ?
          AND created_at < datetime('now', '-30 days')
        """,
        (account_id, channel_id),
    )
