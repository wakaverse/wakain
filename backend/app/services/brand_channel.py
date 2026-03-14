"""Brand matching/creation and Channel extraction/upsert."""

import logging
import re
from urllib.parse import urlparse

from app.services.storage import _supabase

logger = logging.getLogger(__name__)

_PLATFORM_PATTERNS = {
    "instagram": re.compile(
        r"instagram\.com/(?:reel|reels|p)/[^/?]+",
        re.IGNORECASE,
    ),
    "tiktok": re.compile(
        r"tiktok\.com/@([^/]+)/video/",
        re.IGNORECASE,
    ),
    "youtube": re.compile(
        r"(?:youtube\.com|youtu\.be)/",
        re.IGNORECASE,
    ),
}


def _match_or_create_brand(brand_name: str | None, category_id: str | None) -> str | None:
    """brands 테이블에서 name/aliases 매칭 시도, 실패 시 신규 INSERT. brand_id 반환."""
    if not brand_name or not brand_name.strip():
        return None

    brand_name = brand_name.strip()
    sb = _supabase()

    # 1) name 정확 매칭 (case-insensitive)
    try:
        resp = sb.table("brands").select("id").ilike("name", brand_name).limit(1).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 2) aliases 배열에 포함 여부 (PostgreSQL ANY)
    try:
        resp = (
            sb.table("brands")
            .select("id")
            .filter("aliases", "cs", f'{{{brand_name}}}')
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 3) 매칭 실패 → 신규 brand INSERT
    try:
        row = {"name": brand_name, "category_id": category_id}
        resp = sb.table("brands").insert(row).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception as e:
        logger.warning(f"[brand] insert failed: {e}")

    return None


def _extract_channel_from_url(source_url: str | None) -> tuple[str | None, str | None, str | None]:
    """source_url에서 (platform, channel_url, channel_name) 추출.

    Returns (None, None, None) if not parseable.
    """
    if not source_url:
        return None, None, None

    url = source_url.strip()

    # Instagram: instagram.com/reel/xxx → instagram.com/{username}
    if "instagram.com" in url:
        parsed = urlparse(url)
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(parts) >= 2 and parts[1] in ("reel", "reels", "p"):
            username = parts[0]
            channel_url = f"instagram.com/{username}"
            return "instagram", channel_url, username
        return "instagram", None, None

    # TikTok: tiktok.com/@user/video/xxx → tiktok.com/@user
    if "tiktok.com" in url:
        m = _PLATFORM_PATTERNS["tiktok"].search(url)
        if m:
            username = m.group(1)
            channel_url = f"tiktok.com/@{username}"
            return "tiktok", channel_url, f"@{username}"
        return "tiktok", None, None

    # YouTube: channel 추출 어려움 → null 허용
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube", None, None

    return None, None, None


def _upsert_channel(
    platform: str | None,
    channel_url: str | None,
    channel_name: str | None,
    brand_id: str | None = None,
) -> str | None:
    """channels 테이블에 UPSERT (channel_url 기준). channel_id 반환."""
    if not channel_url:
        return None

    sb = _supabase()

    # 기존 채널 조회
    try:
        resp = sb.table("channels").select("id").eq("channel_url", channel_url).limit(1).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 신규 INSERT
    try:
        row = {
            "platform": platform or "unknown",
            "channel_url": channel_url,
            "channel_name": channel_name,
            "brand_id": brand_id,
        }
        resp = sb.table("channels").insert(row).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception as e:
        logger.warning(f"[channel] insert failed: {e}")

    return None
