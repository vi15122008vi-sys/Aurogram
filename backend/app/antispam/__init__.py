"""Per-channel antispam for linked discussions."""

from app.antispam.checker import check_message
from app.antispam.settings import PRESETS, default_settings, reset_to_preset

__all__ = ["check_message", "PRESETS", "default_settings", "reset_to_preset"]
