"""YouTube Shorts API (yt-api via RapidAPI) integration module.

API: https://rapidapi.com/ytjar/api/yt-api
Verified endpoints:
  GET /search?query={q}&type=channel     → Channel search
  GET /channel/about?id={channelId}      → Channel info (title, avatar, subscriberCount)
  GET /channel/shorts?id={channelId}     → Channel shorts list (48 per page)
  GET /video/info?id={videoId}           → Video detail (viewCount, likeCount)
"""

import re
from typing import Any

import httpx

from app.config import RAPIDAPI_KEY

RAPIDAPI_HOST = "yt-api.p.rapidapi.com"


def _parse_view_count(text: str) -> int:
    """Parse '4.2K views' / '1.3M views' → int."""
    if not text:
        return 0
    text = text.lower().replace(",", "").replace("views", "").strip()
    m = re.match(r"([\d.]+)\s*([kmb])?", text)
    if not m:
        return 0
    num = float(m.group(1))
    suffix = m.group(2)
    if suffix == "k":
        num *= 1_000
    elif suffix == "m":
        num *= 1_000_000
    elif suffix == "b":
        num *= 1_000_000_000
    return int(num)


class YouTubeLooter:
    def __init__(self):
        self.headers = {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
        }
        self.base_url = f"https://{RAPIDAPI_HOST}"

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                params=params or {},
            )
            resp.raise_for_status()
            return resp.json()

    async def search_channel(self, query: str) -> dict | None:
        """Search for a YouTube channel by name, return first match.

        Response: { data: [{ channelId, title, subscriberCount, thumbnail, videoCount }] }
        """
        data = await self._get("/search", {"query": query, "type": "channel"})
        items = data.get("data", [])
        for item in items:
            if item.get("type") == "channel":
                thumbs = item.get("thumbnail", [])
                thumb_url = thumbs[-1]["url"] if thumbs else ""
                if thumb_url.startswith("//"):
                    thumb_url = "https:" + thumb_url
                return {
                    "channel_id": item.get("channelId", ""),
                    "display_name": item.get("title", ""),
                    "profile_pic_url": thumb_url,
                    "subscriber_count": _parse_view_count(
                        item.get("subscriberCount", "0")
                    ),
                }
        return None

    async def get_channel_info(self, channel_id: str) -> dict:
        """Channel detail info.

        Response: { channelId, title, avatar[], subscriberCountText, subscriberCount, videosCount }
        """
        data = await self._get("/channel/about", {"id": channel_id})
        avatars = data.get("avatar", [])
        avatar_url = avatars[-1]["url"] if avatars else ""
        sub_count = data.get("subscriberCount", 0)
        if isinstance(sub_count, str):
            sub_count = _parse_view_count(sub_count)
        return {
            "channel_id": data.get("channelId", channel_id),
            "display_name": data.get("title", ""),
            "profile_pic_url": avatar_url,
            "subscriber_count": sub_count,
        }

    async def get_channel_shorts(self, channel_id: str, count: int = 30) -> list[dict]:
        """Get channel's shorts list.

        Response: { data: [{ videoId, title, viewCountText, thumbnail[] }], continuation }
        """
        data = await self._get("/channel/shorts", {"id": channel_id})
        items = data.get("data", [])

        shorts = []
        for item in items[:count]:
            thumbs = item.get("thumbnail", [])
            thumb_url = thumbs[0]["url"] if thumbs else ""
            shorts.append({
                "video_id": item.get("videoId", ""),
                "title": item.get("title", ""),
                "thumbnail_url": thumb_url,
                "view_count": _parse_view_count(item.get("viewCountText", "0")),
            })
        return shorts

    async def get_video_detail(self, video_id: str) -> dict:
        """Get detailed stats for a single video/short.

        Response: { id, title, viewCount, likeCount, publishDate, thumbnail[], lengthSeconds }
        """
        data = await self._get("/video/info", {"id": video_id})
        thumbs = data.get("thumbnail", [])
        thumb_url = thumbs[0]["url"] if thumbs else ""
        return {
            "video_id": data.get("id", video_id),
            "title": data.get("title", ""),
            "thumbnail_url": thumb_url,
            "view_count": int(data.get("viewCount", 0)),
            "like_count": int(data.get("likeCount", 0)),
            "comment_count": 0,  # Not available from this endpoint
            "published_at": data.get("publishDate", ""),
            "duration": int(data.get("lengthSeconds", 0)),
        }

    @staticmethod
    def calc_spike(views: int, avg_views: float) -> float:
        if avg_views <= 0:
            return 1.0
        return round(views / avg_views, 1)

    @staticmethod
    def calc_engagement(likes: int, comments: int, views: int) -> float:
        if views <= 0:
            return 0
        return round((likes + comments) / views * 100, 2)
