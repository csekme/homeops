"""Derive a human-friendly default device name from the User-Agent (feature plan §Device).

Best-effort only: a short "<Browser> on <OS>" label for the session list, which the user can
rename. Native clients send an explicit ``platform`` so they get a clean label even though
their UA is non-standard. Never raises — an unknown UA falls back to the platform.
"""

from __future__ import annotations

_PLATFORM_LABELS = {"ios": "iOS device", "android": "Android device", "web": "Web browser"}

_BROWSERS = (
    ("Edg", "Edge"),
    ("OPR", "Opera"),
    ("Chrome", "Chrome"),
    ("Firefox", "Firefox"),
    ("Safari", "Safari"),
)

_OPERATING_SYSTEMS = (
    ("Windows", "Windows"),
    ("Mac OS X", "macOS"),
    ("Macintosh", "macOS"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Android", "Android"),
    ("Linux", "Linux"),
)


def device_name(user_agent: str | None, platform: str) -> str:
    fallback = _PLATFORM_LABELS.get(platform, "Device")
    ua = user_agent or ""
    if not ua:
        return fallback

    # Native apps: trust the platform label over a non-standard UA.
    if platform in ("ios", "android"):
        return fallback

    browser = next((label for token, label in _BROWSERS if token in ua), None)
    os_name = next((label for token, label in _OPERATING_SYSTEMS if token in ua), None)

    if browser and os_name:
        return f"{browser} on {os_name}"[:80]
    if browser:
        return browser
    if os_name:
        return os_name
    return fallback
