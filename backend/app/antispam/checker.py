from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Optional, Tuple

from app.antispam.links import check_links
from app.antispam.stopwords import ensure_seeded, list_words, match_stopwords
from app.models import AntiSpamSettings, Verdict

# in-memory flood / duplicate trackers: (account, channel, user) -> timestamps / texts
_flood: Dict[Tuple[str, int, int], Deque[float]] = defaultdict(deque)
_dupes: Dict[Tuple[str, int, int], Deque[Tuple[float, str]]] = defaultdict(deque)
_strikes: Dict[Tuple[str, int, int], int] = defaultdict(int)
_seeded_levels: set[Tuple[str, int, str]] = set()

EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F6FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U0001F1E6-\U0001F1FF"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "]+",
    flags=re.UNICODE,
)


def _caps_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters)


def _emoji_count(text: str) -> int:
    return sum(len(match.group(0)) for match in EMOJI_RE.finditer(text or ""))


async def check_message(
    msg: Any,
    settings: AntiSpamSettings,
    account_id: str,
    channel_id: int,
    own_username: Optional[str] = None,
) -> Verdict:
    if not settings.enabled:
        return Verdict(action="allow")

    text = msg.message or ""
    if not text and settings.check_in_media_captions:
        text = getattr(msg, "raw_text", None) or ""

    sender_id = int(getattr(msg, "sender_id", 0) or 0)
    key = (account_id, channel_id, sender_id)
    now = time.monotonic()

    # Flood
    if settings.flood_enabled and sender_id:
        q = _flood[key]
        q.append(now)
        while q and now - q[0] > settings.flood_window_sec:
            q.popleft()
        if len(q) > settings.flood_threshold:
            return Verdict(action="mute" if settings.mute_on_repeat else "delete", reason="flood", matched=[f">{settings.flood_threshold}/{settings.flood_window_sec}s"])

    # Caps
    if settings.caps_enabled and len(text) >= settings.caps_min_len:
        if _caps_ratio(text) >= settings.caps_ratio:
            return Verdict(action="delete", reason="caps", matched=[f"{int(_caps_ratio(text)*100)}%"])

    # Emoji spam
    emoji_count = _emoji_count(text)
    if settings.emoji_enabled and emoji_count > settings.emoji_max:
        return Verdict(action="delete", reason="emoji", matched=[str(emoji_count)])

    # Duplicates
    if settings.duplicate_window_min > 0 and text.strip():
        dq = _dupes[key]
        dq.append((now, text.strip().lower()))
        window = settings.duplicate_window_min * 60
        while dq and now - dq[0][0] > window:
            dq.popleft()
        same = sum(1 for _, t in dq if t == text.strip().lower())
        if same >= 2:
            return Verdict(action="delete", reason="duplicate", matched=["repeat"])

    # Links
    link_hit = check_links(text, settings, own_username=own_username)
    if link_hit:
        return Verdict(action="delete", reason="link", matched=[link_hit])

    # Stop words
    seed_key = (account_id, channel_id, settings.level.value)
    if seed_key not in _seeded_levels:
        await ensure_seeded(account_id, channel_id, settings.level.value)
        _seeded_levels.add(seed_key)
    words = await list_words(account_id, channel_id, enabled=True)
    # honor builtin disabled list from settings
    disabled = set(settings.stop_words_builtin_disabled)
    active = [w for w in words if not (w.is_builtin and w.word in disabled)]
    hits = match_stopwords(text, active, settings)
    if hits:
        action = "delete"
        _strikes[key] += 1
        if settings.ban_on_third and _strikes[key] >= 3:
            action = "ban"
        elif settings.mute_on_repeat and _strikes[key] >= 2:
            action = "mute"
        return Verdict(action=action, reason="stopword", matched=hits[:10])  # type: ignore[arg-type]

    return Verdict(action="allow")
