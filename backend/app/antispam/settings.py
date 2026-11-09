from __future__ import annotations

import json
from typing import Any

from app.models import AntiSpamSettings, AntispamLevel, LinksPolicy


def default_settings() -> AntiSpamSettings:
    return reset_to_preset(AntispamLevel.soft)


def reset_to_preset(level: AntispamLevel | str) -> AntiSpamSettings:
    level = AntispamLevel(level)
    if level == AntispamLevel.soft:
        return AntiSpamSettings(
            enabled=True,
            level=level,
            links_policy=LinksPolicy.blacklist_only,
            flood_enabled=False,
            caps_enabled=False,
            emoji_enabled=False,
            notify_author_dm=True,
            mute_on_repeat=False,
            ban_on_third=False,
            new_user_probation_hours=0,
            duplicate_window_min=0,
        )
    if level == AntispamLevel.medium:
        return AntiSpamSettings(
            enabled=True,
            level=level,
            links_policy=LinksPolicy.allowlist_only,
            flood_enabled=True,
            flood_threshold=5,
            flood_window_sec=10,
            caps_enabled=True,
            caps_ratio=0.7,
            caps_min_len=20,
            emoji_enabled=True,
            emoji_max=10,
            notify_author_dm=True,
            mute_on_repeat=True,
            mute_minutes=5,
            ban_on_third=False,
            new_user_probation_hours=0,
            duplicate_window_min=0,
        )
    return AntiSpamSettings(
        enabled=True,
        level=AntispamLevel.hard,
        links_policy=LinksPolicy.block_all,
        flood_enabled=True,
        flood_threshold=3,
        flood_window_sec=10,
        caps_enabled=True,
        caps_ratio=0.5,
        caps_min_len=15,
        emoji_enabled=True,
        emoji_max=5,
        notify_author_dm=True,
        mute_on_repeat=True,
        mute_minutes=10,
        ban_on_third=True,
        new_user_probation_hours=24,
        duplicate_window_min=5,
    )


PRESETS = {
    "soft": reset_to_preset(AntispamLevel.soft),
    "medium": reset_to_preset(AntispamLevel.medium),
    "hard": reset_to_preset(AntispamLevel.hard),
}


def load_channel_settings(raw: str | None) -> AntiSpamSettings:
    if not raw:
        return AntiSpamSettings()
    try:
        data = json.loads(raw)
        return AntiSpamSettings.model_validate(data)
    except Exception:
        return AntiSpamSettings()


def dump_settings(settings: AntiSpamSettings) -> str:
    return settings.model_dump_json()


def merge_settings(base: AntiSpamSettings, patch: dict[str, Any]) -> AntiSpamSettings:
    data = base.model_dump()
    data.update(patch)
    return AntiSpamSettings.model_validate(data)
