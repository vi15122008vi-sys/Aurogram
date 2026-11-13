from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class AuthState(str, Enum):
    ok = "ok"
    pending = "pending"
    dead = "dead"


class ForceMethod(str, Enum):
    telegram = "telegram"
    sms = "sms"
    call = "call"


class LinksPolicy(str, Enum):
    block_all = "block_all"
    allowlist_only = "allowlist_only"
    blacklist_only = "blacklist_only"


class AntispamLevel(str, Enum):
    soft = "soft"
    medium = "medium"
    hard = "hard"


class Country(BaseModel):
    iso: str
    name: str
    dial_code: str
    flag: str


class RegisterKeyRequest(BaseModel):
    api_id: int = Field(ge=10000, le=9_999_999_999)
    api_hash: str = Field(min_length=32, max_length=32)
    remember: bool = True


class SendCodeRequest(BaseModel):
    phone: str
    force_method: Optional[ForceMethod] = None
    api_id: Optional[int] = None
    api_hash: Optional[str] = None


class SignInRequest(BaseModel):
    phone: str
    phone_code_hash: str
    code: str
    password: Optional[str] = None


class RecoverPasswordRequest(BaseModel):
    phone: str
    phone_code_hash: Optional[str] = None


class LogoutRequest(BaseModel):
    purge_cache: bool = False


class AccountOut(BaseModel):
    id: str
    name: str
    phone: str
    username: Optional[str] = None
    auth_state: AuthState = AuthState.ok
    last_sync: Optional[datetime] = None
    chats_count: int = 0
    cache_bytes: int = 0


class ChatOut(BaseModel):
    id: int
    title: str
    username: Optional[str] = None
    type: Literal["user", "group", "channel", "bot"]
    archived: bool = False
    unread: int = 0
    last_message: Optional[str] = None
    last_message_date: Optional[datetime] = None
    ghost: bool = False
    members_count: Optional[int] = None
    avatar_color: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    chat_id: int
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    text: Optional[str] = None
    date: datetime
    out: bool = False
    status: Literal["sending", "sent", "delivered", "read", "failed", "deleted"] = "sent"
    edited: bool = False
    deleted: bool = False
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    duration: Optional[int] = None
    waveform_data: Optional[List[int]] = None
    reactions: List[Dict[str, Any]] = Field(default_factory=list)
    pinned: bool = False


class MemberOut(BaseModel):
    id: int
    name: str
    username: Optional[str] = None
    tag: Optional[str] = None
    is_bot: bool = False


class ChannelOut(BaseModel):
    id: int
    title: str
    username: Optional[str] = None
    subscribers: int = 0
    posts_count: int = 0
    scheduled_count: int = 0
    last_post_at: Optional[datetime] = None
    # Просмотры последнего поста: 0, если Telegram не отдал метрику
    # (например, для приватных каналов или сервисных сообщений).
    views: int = 0


class BotOut(BaseModel):
    id: int
    username: str
    name: str
    webhook_set: bool = False
    token_hint: Optional[str] = None


class BotTokenIn(BaseModel):
    token: str


class AntiSpamSettings(BaseModel):
    enabled: bool = False
    level: AntispamLevel = AntispamLevel.soft
    stop_words_builtin_disabled: List[str] = Field(default_factory=list)
    stop_words_custom: List[str] = Field(default_factory=list)
    stem: bool = True
    case_sensitive: bool = False
    exact_match: bool = False
    links_policy: LinksPolicy = LinksPolicy.blacklist_only
    allowlist_custom: List[str] = Field(default_factory=list)
    allowlist_global_disabled: List[str] = Field(default_factory=list)
    allow_subdomains: bool = True
    allow_raw_ip: bool = False
    allow_shortlinks: bool = False
    flood_enabled: bool = False
    flood_threshold: int = 5
    flood_window_sec: int = 10
    caps_enabled: bool = False
    caps_ratio: float = 0.7
    caps_min_len: int = 20
    emoji_enabled: bool = False
    emoji_max: int = 10
    new_user_probation_hours: int = 0
    duplicate_window_min: int = 0
    notify_author_dm: bool = True
    mute_on_repeat: bool = False
    mute_minutes: int = 5
    ban_on_third: bool = False
    check_in_media_captions: bool = True


class StopWord(BaseModel):
    id: Optional[int] = None
    word: str
    category: Literal[
        "ads", "profanity", "crypto", "casino", "bets", "politics", "custom"
    ] = "custom"
    enabled: bool = True
    is_regex: bool = False
    is_builtin: bool = False
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None


class StopWordsSettings(BaseModel):
    words: List[StopWord] = Field(default_factory=list)
    stem: bool = True
    case_sensitive: bool = False
    exact_match: bool = False
    check_in_media_captions: bool = True


class Verdict(BaseModel):
    action: Literal["allow", "delete", "mute", "ban", "warn"] = "allow"
    reason: Optional[str] = None
    matched: List[str] = Field(default_factory=list)


class AntispamTestRequest(BaseModel):
    text: str
    is_caption: bool = False


class WordCreate(BaseModel):
    word: str
    category: str = "custom"
    is_regex: bool = False


class WordPatch(BaseModel):
    word: Optional[str] = None
    category: Optional[str] = None
    enabled: Optional[bool] = None


class WordImport(BaseModel):
    format: Literal["json", "txt", "csv"] = "json"
    data: str
    category: str = "custom"


class ToggleCategory(BaseModel):
    category: str
    enabled: bool


class DomainIn(BaseModel):
    domain: str


class PostCreate(BaseModel):
    text: str
    parse_mode: Literal["html", "md"] = "html"
    schedule_at: Optional[datetime] = None
    silent: bool = False


class EditorPreviewRequest(BaseModel):
    markdown: str
    premium: bool = False


class TextStyleConvert(BaseModel):
    text: str
    style: str


class ThemeCustom(BaseModel):
    name: str
    accent: str
    dark: bool = True
    tokens: Optional[Dict[str, str]] = None


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: Dict[str, str]
    account_id: Optional[str] = None


class CachePurgeRequest(BaseModel):
    confirm: str
    account_id: Optional[str] = None


class HealthOut(BaseModel):
    status: str
    listener: Literal["ok", "reconnecting", "dead"]
    accounts_alive: int
    disk_pct: float


class ConfigOut(BaseModel):
    allow_per_account_keys: bool
    capabilities: Dict[str, Any]
    vapid_public_key: str = ""
