"""Instagram Looter API (RapidAPI) integration module.

API: https://rapidapi.com/irrors-apis/api/instagram-looter2
Verified endpoints:
  GET /profile?username={username}  → User profile info
  GET /user-id?username={username}  → Username → numeric user ID
  GET /reels?id={user_id}           → User's reels (12 per page)
"""

from typing import Any

import httpx

from app.config import RAPIDAPI_KEY  # noqa: E402
RAPIDAPI_HOST = "instagram-looter2.p.rapidapi.com"


class InstagramLooter:
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

        Response structure (verified):
          id, full_name, profile_pic_url_hd,
          edge_followed_by.count, edge_owner_to_timeline_media.count
        """
        data = await self._get("/profile", {"username": username})
        return {
            "ig_user_id": str(data.get("id", "")),
            "display_name": data.get("full_name", username),
            "profile_pic_url": data.get("profile_pic_url_hd", data.get("profile_pic_url", "")),
            "follower_count": (data.get("edge_followed_by") or {}).get("count", 0),
        }

    async def get_user_id(self, username: str) -> str:
        """username → numeric user ID."""
        data = await self._get("/user-id", {"username": username})
        return str(data.get("id", data.get("user_id", "")))

    async def get_user_reels(self, user_id: str, count: int = 12) -> list[dict]:
        """사용자 최근 릴스 목록.

        Response structure (verified):
          { items: [ { media: { pk, code, play_count, like_count, comment_count,
            taken_at, caption.text, image_versions2.candidates[0].url,
            video_versions[0].url } } ], paging_info, status }
        """
        data = await self._get("/reels", {"id": user_id})
        items = data.get("items", [])

        reels = []
        for item in items[:count]:
            m = item.get("media", item)

            # Thumbnail
            thumb = ""
            img = m.get("image_versions2")
            if isinstance(img, dict):
                cands = img.get("candidates", [])
                if cands:
                    thumb = cands[0].get("url", "")

            # Video URL
            video_url = ""
            vv = m.get("video_versions", [])
            if vv:
                video_url = vv[0].get("url", "")

            # Caption
            cap = m.get("caption")
            caption_text = ""
            if isinstance(cap, dict):
                caption_text = cap.get("text", "")
            elif isinstance(cap, str):
                caption_text = cap

            reels.append({
                "ig_media_id": str(m.get("pk", "")),
                "shortcode": m.get("code", ""),
                "thumbnail_url": thumb,
                "video_url": video_url,
                "caption": caption_text,
                "view_count": m.get("play_count", m.get("ig_play_count", 0)),
                "like_count": m.get("like_count", 0),
                "comment_count": m.get("comment_count", 0),
                "posted_at": m.get("taken_at"),  # unix timestamp
            })
        return reels

    async def search_reels(self, query: str, count: int = 20) -> list[dict]:
        """해시태그/키워드 기반 릴 검색.

        Instagram Looter2 API에는 공식 검색 엔드포인트가 없으므로
        해시태그 기반 검색을 시도합니다.
        TODO: RapidAPI에 검색 엔드포인트 추가 시 교체
        """
        # 해시태그로 변환 (공백 제거, 한글 유지)
        hashtag = query.replace(" ", "").replace("#", "")
        try:
            data = await self._get("/hashtag", {"name": hashtag})
            items = data.get("items", data.get("edge_hashtag_to_media", {}).get("edges", []))
            reels = []
            for item in items[:count]:
                node = item.get("node", item) if isinstance(item, dict) else item
                m = node.get("media", node) if isinstance(node, dict) else {}
                thumb = ""
                img = m.get("image_versions2", {})
                if isinstance(img, dict):
                    cands = img.get("candidates", [])
                    if cands:
                        thumb = cands[0].get("url", "")
                if not thumb:
                    thumb = m.get("thumbnail_url", m.get("display_url", ""))
                video_url = ""
                vv = m.get("video_versions", [])
                if vv:
                    video_url = vv[0].get("url", "")
                cap = m.get("caption", m.get("edge_media_to_caption", {}).get("edges", [{}])[0].get("node", {}).get("text", ""))
                if isinstance(cap, dict):
                    cap = cap.get("text", "")
                owner = m.get("owner", {})
                reels.append({
                    "ig_media_id": str(m.get("pk", m.get("id", ""))),
                    "shortcode": m.get("code", m.get("shortcode", "")),
                    "thumbnail_url": thumb,
                    "video_url": video_url,
                    "caption": cap if isinstance(cap, str) else "",
                    "view_count": m.get("play_count", m.get("video_view_count", 0)),
                    "like_count": m.get("like_count", m.get("edge_liked_by", {}).get("count", 0)),
                    "comment_count": m.get("comment_count", m.get("edge_media_to_comment", {}).get("count", 0)),
                    "posted_at": m.get("taken_at", m.get("taken_at_timestamp")),
                    "channel_name": owner.get("username", ""),
                    "channel_followers": owner.get("edge_followed_by", {}).get("count", 0),
                })
            return reels
        except Exception:
            # API 미지원 시 빈 결과 반환
            return []

    @staticmethod
    def calc_spike(reel_views: int, avg_views: float) -> float:
        if avg_views <= 0:
            return 1.0
        return round(reel_views / avg_views, 1)

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
