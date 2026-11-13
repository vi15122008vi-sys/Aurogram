from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_id: int = Field(default=0, alias="API_ID")
    api_hash: str = Field(default="", alias="API_HASH")
    secret_key: str = Field(default="", alias="SECRET_KEY")
    allow_per_account_keys: bool = Field(default=False, alias="ALLOW_PER_ACCOUNT_KEYS")

    cors_origins: str = Field(
        default="http://localhost:5173",
        alias="CORS_ORIGINS",
    )

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    sessions_dir: str = Field(default="/app/sessions", alias="SESSIONS_DIR")
    cache_dir: str = Field(default="/app/cache_data", alias="CACHE_DIR")
    media_dir: str = Field(default="/app/media_data", alias="MEDIA_DIR")

    cache_ttl_days: int = Field(default=0, alias="CACHE_TTL_DAYS")
    cache_media_ttl_days: int = Field(default=0, alias="CACHE_MEDIA_TTL_DAYS")
    cache_max_size_gb: float = Field(default=50.0, alias="CACHE_MAX_SIZE_GB")
    cache_cleanup_interval_min: int = Field(default=60, alias="CACHE_CLEANUP_INTERVAL_MIN")
    cache_target_ratio: float = Field(default=0.9, alias="CACHE_TARGET_RATIO")
    cache_min_keep_days: int = Field(default=7, alias="CACHE_MIN_KEEP_DAYS")
    # При превышении лимита по умолчанию вытесняем только медиа (LRU):
    # сообщения — это история пользователя, их удаление включается явно.
    cache_evict_messages: bool = Field(default=False, alias="CACHE_EVICT_MESSAGES")
    # Сколько последних сообщений хранить на каждый чат (защита диска).
    cache_max_messages_per_chat: int = Field(default=1000, alias="CACHE_MAX_MESSAGES_PER_CHAT")
    # Мастер-код приглашения: работает всегда, даже если база пуста.
    invite_code: str = Field(default="", alias="INVITE_CODE")
    # Публичный адрес, по которому открываются сгенерированные виджеты.
    widget_public_base_url: str = Field(default="https://aurogram.dpdns.org", alias="WIDGET_PUBLIC_BASE_URL")

    admin_user: str = Field(default="admin", alias="ADMIN_USER")
    admin_password: str = Field(default="change-me", alias="ADMIN_PASSWORD")
    admin_action_token: str = Field(default="", alias="ADMIN_ACTION_TOKEN")
    admin_accent: str = Field(default="#6366F1", alias="ADMIN_ACCENT")

    vapid_public_key: str = Field(default="", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field(default="", alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field(default="mailto:admin@example.com", alias="VAPID_SUBJECT")

    # --- Aurogram Studio bot ---
    bot_token: str = Field(default="", alias="BOT_TOKEN")
    bot_allowed_user_ids: str = Field(default="", alias="BOT_ALLOWED_USER_IDS")
    bot_internal_secret: str = Field(default="", alias="BOT_INTERNAL_SECRET")
    bot_widget_base_url: str = Field(default="", alias="BOT_WIDGET_BASE_URL")

    # --- AI (суммаризация постов через бесплатную LLM) ---
    deepseek_api_key: str = Field(default="", alias="DEEPSEEK_API_KEY")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://api.deepseek.com", alias="AI_BASE_URL")
    ai_model: str = Field(default="deepseek-chat", alias="AI_MODEL")
    ai_timeout_seconds: float = Field(default=25.0, alias="AI_TIMEOUT_SECONDS")

    def bot_allowed_ids(self) -> List[int]:
        """BOT_ALLOWED_USER_IDS=111,222 — белый список Telegram user id."""
        result: List[int] = []
        for part in self.bot_allowed_user_ids.replace(" ", "").split(","):
            if part.isdigit():
                result.append(int(part))
        return result

    @field_validator("allow_per_account_keys", mode="before")
    @classmethod
    def _parse_bool(cls, v: object) -> bool:
        if isinstance(v, bool):
            return v
        if v is None:
            return False
        return str(v).strip().lower() in {"1", "true", "yes", "on"}

    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
