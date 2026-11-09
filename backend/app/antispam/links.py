from __future__ import annotations

import ipaddress
import json
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from app.models import AntiSpamSettings, LinksPolicy

BUILTIN = Path(__file__).parent / "builtin"
URL_RE = re.compile(
    r"(?i)\b((?:https?://|www\.)[^\s<>\"']+|(?:t\.me|telegram\.me)/[^\s<>\"']+|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:/[^\s]*)?)"
)
IPV6_RE = re.compile(r"(?<![0-9a-f:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![0-9a-f:])", re.IGNORECASE)


def _load_list(name: str) -> set[str]:
    with open(BUILTIN / name, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        items = data.get("domains") or data.get("items") or []
    else:
        items = data
    return {str(x).lower().lstrip(".") for x in items}


ALLOW = _load_list("domains_allow.json")
DENY = _load_list("domains_deny.json")
SHORT = _load_list("shortlinks.json")


def extract_urls(text: str) -> list[str]:
    if not text:
        return []
    found = [m.group(0) for m in URL_RE.finditer(text)]
    for match in IPV6_RE.finditer(text):
        candidate = match.group(0).strip("[](){}<>,.;!?\"'")
        try:
            if isinstance(ipaddress.ip_address(candidate), ipaddress.IPv6Address):
                found.append(candidate)
        except ValueError:
            continue
    return found


def _host(url: str) -> str:
    candidate = url.strip("[]")
    try:
        return str(ipaddress.ip_address(candidate)).lower()
    except ValueError:
        pass
    u = url if "://" in url else "http://" + url
    try:
        host = urlparse(u).hostname or ""
    except Exception:
        return ""
    return host.lower().rstrip(".")


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _domain_match(host: str, domain: str, allow_subdomains: bool) -> bool:
    host = host.lower()
    domain = domain.lower().lstrip(".")
    if host == domain:
        return True
    if allow_subdomains and host.endswith("." + domain):
        return True
    return False


def check_links(
    text: str,
    settings: AntiSpamSettings,
    own_username: Optional[str] = None,
) -> Optional[str]:
    """Return matched reason or None if allowed."""
    urls = extract_urls(text)
    if not urls:
        return None

    disabled_global = {d.lower() for d in settings.allowlist_global_disabled}
    custom_allow = {d.lower().lstrip(".") for d in settings.allowlist_custom}

    for url in urls:
        host = _host(url)
        if not host:
            continue

        # Always allow t.me / telegram links to own channel
        if own_username and host in {"t.me", "telegram.me"}:
            path = urlparse("http://" + url if "://" not in url else url).path.lower()
            if f"/{own_username.lower()}" in path:
                continue

        if _is_ip(host):
            if not settings.allow_raw_ip:
                return f"raw_ip:{host}"
            continue

        if any(_domain_match(host, s, True) for s in SHORT):
            if not settings.allow_shortlinks:
                return f"shortlink:{host}"

        if any(_domain_match(host, d, settings.allow_subdomains) for d in custom_allow):
            continue

        global_allow = ALLOW - disabled_global
        if any(_domain_match(host, d, settings.allow_subdomains) for d in global_allow):
            if settings.links_policy != LinksPolicy.block_all:
                continue
            # hard block_all still blocks global unless custom — already checked custom
            return f"link_blocked:{host}"

        if settings.links_policy == LinksPolicy.block_all:
            return f"link_blocked:{host}"
        if settings.links_policy == LinksPolicy.allowlist_only:
            return f"not_in_allowlist:{host}"
        # blacklist_only
        if any(_domain_match(host, d, settings.allow_subdomains) for d in DENY):
            return f"deny_list:{host}"

    return None
