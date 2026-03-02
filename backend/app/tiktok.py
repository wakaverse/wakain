"""TikTok API (tiktok-api23 via RapidAPI) integration module.

API: https://rapidapi.com/Suspended/api/tiktok-api23
Verified endpoints:
  GET /api/user/info?uniqueId={username}         → User profile + stats
  GET /api/user/posts?secUid={secUid}&count=&cursor= → User posts (needs secUid from user/info)
"""

from typing import Any

import httpx

from app.config import RAPIDAPI_KEY

RAPIDAPI_HOST = "tiktok-api23.p.rapidapi.com"


class TikTokLooter:
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

    async def get_user_info(self, username: str) -> dict:
        """사용자 프로필 정보.

        Response: { userInfo: { user: { id, uniqueId, nickname, secUid, avatarMedium },
                                stats: { followerCount, videoCount, heart } } }
        """
        data = await self._get("/api/user/info", {"uniqueId": username})
        user = data.get("userInfo", {}).get("user", {})
        stats = data.get("userInfo", {}).get("stats", {})
        return {
            "user_id": user.get("id", ""),
            "sec_uid": user.get("secUid", ""),
            "display_name": user.get("nickname", username),
            "profile_pic_url": user.get("avatarMedium", ""),
            "follower_count": stats.get("followerCount", 0),
            "video_count": stats.get("videoCount", 0),
        }

    async def get_user_posts(self, sec_uid: str, count: int = 20) -> list[dict]:
        """사용자 포스트 목록.

        Requires secUid (from get_user_info).
        Response: { data: { itemList: [{ id, desc, createTime, stats, video }] } }
        stats: { playCount, diggCount, commentCount, shareCount, collectCount }
        video: { cover, dynamicCover }
        """
        data = await self._get("/api/user/posts", {
            "secUid": sec_uid,
            "count": str(count),
            "cursor": "0",
        })
        items = data.get("data", {}).get("itemList", [])

        posts = []
        for item in items[:count]:
            stats = item.get("stats", {})
            video = item.get("video", {})
            posts.append({
                "video_id": str(item.get("id", "")),
                "caption": item.get("desc", ""),
                "thumbnail_url": video.get("cover", video.get("dynamicCover", "")),
                "view_count": stats.get("playCount", 0),
                "like_count": stats.get("diggCount", 0),
                "comment_count": stats.get("commentCount", 0),
                "share_count": stats.get("shareCount", 0),
                "posted_at": item.get("createTime"),  # unix timestamp
            })
        return posts

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

    @staticmethod
    def calc_comment_ratio(comments: int, likes: int) -> float:
        if likes <= 0:
            return 0
        return round(comments / likes, 2)
