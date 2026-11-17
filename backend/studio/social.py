"""Free browser-return OAuth and a short-lived signed-media relay for a private local engine."""
import json
import re
import time
from urllib.parse import urlsplit
from . import config


def callback_origin() -> str:
    value = str(config.env("PEAKCUT_SOCIAL_CALLBACK_ORIGIN") or "").rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        return ""
    return value


def media_origin() -> str:
    try:
        data = json.loads((config.DATA_DIR / "social-network.json").read_text(encoding="utf-8"))
        value = str(data.get("url") or "")
        if float(data.get("expires", 0)) <= time.time():
            return ""
        if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com", value):
            return ""
        return value
    except (OSError, ValueError, TypeError):
        return ""
