"""Radar feature — channel management, reel feed, and collection triggers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import create_client

from app.auth import get_current_user
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from app.instagram import InstagramLooter
from app.youtube import YouTubeLooter
from app.tiktok import TikTokLooter

router = APIRouter(prefix="/radar")

ig_looter = InstagramLooter()
yt_looter = YouTubeLooter()
tt_looter = TikTokLooter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ─── Request / Response Models ───


class ChannelCreate(BaseModel):
    ig_username: str
    category: str = "beauty"
    platform: str = "instagram"  # 'instagram' | 'youtube' | 'tiktok'


class ChannelResponse(BaseModel):
    id: str
    ig_username: str
    ig_user_id: str | None = None
    display_name: str | None = None
    profile_pic_url: str | None = None
    follower_count: int | None = None
    category: str | None = None
    platform: str = "instagram"
    avg_views_30d: float = 0
    is_active: bool = True
    last_error: str | None = None
    last_error_at: str | None = None


# ─── Channel Management ───


PLATFORM_RESOLVERS = {
    "instagram": "_resolve_instagram_channel",
    "youtube": "_resolve_youtube_channel",
    "tiktok": "_resolve_tiktok_channel",
}


@router.post("/channels", response_model=ChannelResponse)
async def add_channel(body: ChannelCreate, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    username = body.ig_username.lower().strip().lstrip("@")

    if body.platform == "youtube":
        info = await _resolve_youtube_channel(username)
    elif body.platform == "tiktok":
        info = await _resolve_tiktok_channel(username)
    else:
        info = await _resolve_instagram_channel(username)

    row = {
        "user_id": user["id"],
        "ig_username": username,
        "ig_user_id": info.get("channel_id", ""),
        "display_name": info.get("display_name", username),
        "profile_pic_url": info.get("profile_pic_url"),
        "follower_count": info.get("follower_count", info.get("subscriber_count")),
        "category": body.category,
        "platform": body.platform,
        "is_active": True,
    }

    try:
        resp = sb.table("radar_channels").insert(row).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "23505" in str(e):
            # Already exists but maybe inactive — reactivate
            existing = sb.table("radar_channels").select("*").eq("user_id", user["id"]).eq("ig_username", username).single().execute()
            if existing.data:
                sb.table("radar_channels").update({"is_active": True}).eq("id", existing.data["id"]).execute()
                return existing.data
            raise HTTPException(status_code=400, detail="이미 등록된 채널입니다.")
        raise HTTPException(status_code=400, detail=f"채널 등록에 실패했습니다: {str(e)[:100]}")
    if not resp.data:
        raise HTTPException(status_code=400, detail="채널 등록에 실패했습니다.")
    return resp.data[0]


async def _resolve_instagram_channel(username: str) -> dict:
    try:
        info = await ig_looter.get_user_info(username)
        channel_id = info.get("ig_user_id", "")
        if not channel_id:
            channel_id = await ig_looter.get_user_id(username)
        return {
            "channel_id": channel_id,
            "display_name": info.get("display_name", username),
            "profile_pic_url": info.get("profile_pic_url"),
            "follower_count": info.get("follower_count"),
        }
    except Exception:
        return {"channel_id": "", "display_name": username}


async def _resolve_youtube_channel(query: str) -> dict:
    try:
        result = await yt_looter.search_channel(query)
        if result:
            info = await yt_looter.get_channel_info(result["channel_id"])
            return {
                "channel_id": info.get("channel_id", result["channel_id"]),
                "display_name": info.get("display_name", query),
                "profile_pic_url": info.get("profile_pic_url"),
                "subscriber_count": info.get("subscriber_count", 0),
            }
        return {"channel_id": "", "display_name": query}
    except Exception:
        return {"channel_id": "", "display_name": query}


async def _resolve_tiktok_channel(username: str) -> dict:
    """Resolve TikTok channel. ig_user_id stores secUid (needed for posts API)."""
    try:
        info = await tt_looter.get_user_info(username)
        return {
            "channel_id": info.get("sec_uid", ""),  # secUid stored as ig_user_id
            "display_name": info.get("display_name", username),
            "profile_pic_url": info.get("profile_pic_url"),
            "follower_count": info.get("follower_count"),
        }
    except Exception:
        return {"channel_id": "", "display_name": username}


@router.get("/channels", response_model=list[ChannelResponse])
async def list_channels(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    resp = (
        sb.table("radar_channels")
        .select("*")
        .eq("user_id", user["id"])
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    ch = (
        sb.table("radar_channels")
        .select("id")
        .eq("id", channel_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not ch.data:
        raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")
    sb.table("radar_channels").update({"is_active": False}).eq("id", channel_id).execute()
    return {"ok": True}


# ─── Reel Feed ───

PERIOD_MAP = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}

SORT_MAP = {
    "spike": ("spike_multiplier", True),
    "engagement": ("engagement_rate", True),
    "views": ("view_count", True),
    "recent": ("posted_at", True),
}


@router.get("/feed")
async def get_feed(
    channel_id: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    period: str = Query("30d"),
    min_spike: float = Query(1.0),
    min_views: int = Query(0),
    min_engagement: float = Query(0),
    keyword: Optional[str] = Query(None),
    sort: str = Query("spike"),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()

    ch_resp = (
        sb.table("radar_channels")
        .select("id")
        .eq("user_id", user["id"])
        .eq("is_active", True)
        .execute()
    )
    user_channel_ids = [c["id"] for c in ch_resp.data]
    if not user_channel_ids:
        return {"reels": [], "total": 0}

    query = sb.table("radar_reels").select(
        "*, radar_channels!inner(id, ig_username, display_name, profile_pic_url, follower_count, category, avg_views_30d, platform)",
        count="exact",
    )

    if channel_id and channel_id in user_channel_ids:
        query = query.eq("channel_id", channel_id)
    else:
        query = query.in_("channel_id", user_channel_ids)

    if platform:
        query = query.eq("platform", platform)

    delta = PERIOD_MAP.get(period, timedelta(days=30))
    cutoff = (datetime.now(timezone.utc) - delta).isoformat()
    query = query.gte("posted_at", cutoff)

    if min_spike > 1.0:
        query = query.gte("spike_multiplier", min_spike)
    if min_views > 0:
        query = query.gte("view_count", min_views)
    if min_engagement > 0:
        query = query.gte("engagement_rate", min_engagement)
    if keyword:
        query = query.ilike("caption", f"%{keyword}%")

    sort_col, sort_desc = SORT_MAP.get(sort, ("spike_multiplier", True))
    query = query.order(sort_col, desc=sort_desc)

    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    resp = query.execute()

    reels = []
    for row in resp.data:
        channel_data = row.pop("radar_channels", {})
        row["channel"] = channel_data
        reels.append(row)

    return {"reels": reels, "total": resp.count or 0}


# ─── Collection Triggers ───

COLLECTORS = {
    "instagram": "_collect_reels_for_channel",
    "youtube": "_collect_shorts_for_channel",
    "tiktok": "_collect_tiktoks_for_channel",
}


@router.post("/collect/{channel_id}")
async def collect_channel(channel_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    ch = (
        sb.table("radar_channels")
        .select("*")
        .eq("id", channel_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not ch.data:
        raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")

    channel = ch.data
    try:
        collected = await _dispatch_collect(sb, channel)
        # Clear error on success
        sb.table("radar_channels").update({
            "last_error": None,
            "last_error_at": None,
        }).eq("id", channel_id).execute()
        return {"ok": True, "collected": collected}
    except Exception as e:
        # Record error but keep existing data
        sb.table("radar_channels").update({
            "last_error": str(e)[:200],
            "last_error_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", channel_id).execute()
        raise HTTPException(status_code=502, detail=f"수집에 실패했습니다: {str(e)[:100]}")


@router.post("/collect-all")
async def collect_all(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    channels = (
        sb.table("radar_channels")
        .select("*")
        .eq("user_id", user["id"])
        .eq("is_active", True)
        .execute()
    )

    total = 0
    for channel in channels.data:
        try:
            total += await _dispatch_collect(sb, channel)
            sb.table("radar_channels").update({
                "last_error": None,
                "last_error_at": None,
            }).eq("id", channel["id"]).execute()
        except Exception as e:
            sb.table("radar_channels").update({
                "last_error": str(e)[:200],
                "last_error_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", channel["id"]).execute()
            continue

    return {"ok": True, "collected": total}


class AnalyzeReelResponse(BaseModel):
    job_id: str
    reel_id: str


@router.put("/reels/{reel_id}/analyze")
async def analyze_reel(reel_id: str, user: dict = Depends(get_current_user)):
    """Link a radar reel to the analysis pipeline — creates a job and updates reel record."""
    from fastapi import BackgroundTasks, Request
    sb = get_supabase()

    # Verify reel belongs to user's channel
    reel_resp = (
        sb.table("radar_reels")
        .select("*, radar_channels!inner(user_id)")
        .eq("id", reel_id)
        .single()
        .execute()
    )
    if not reel_resp.data:
        raise HTTPException(status_code=404, detail="릴을 찾을 수 없습니다")
    reel = reel_resp.data
    if reel.get("radar_channels", {}).get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # If already analyzed, return existing job_id
    if reel.get("job_id"):
        return {"job_id": reel["job_id"], "reel_id": reel_id}

    # Build video URL
    platform = reel.get("platform", "instagram")
    shortcode = reel.get("shortcode", "")
    if platform == "youtube":
        video_url = f"https://www.youtube.com/shorts/{shortcode}"
    elif platform == "tiktok":
        video_url = reel.get("video_url") or f"https://www.tiktok.com/video/{shortcode}"
    else:
        video_url = reel.get("video_url") or f"https://www.instagram.com/reel/{shortcode}/"

    # Call the analyze-url logic inline (avoid circular import of BackgroundTasks)
    import uuid as _uuid
    import httpx
    import boto3
    from botocore.config import Config as BotoConfig
    from app.config import (
        R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT,
    )
    from app.worker import run_analysis
    from pathlib import Path
    import asyncio

    # Download video
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            resp = await client.get(video_url)
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"영상 다운로드 실패: {str(e)[:100]}")

    video_bytes = resp.content
    file_size_mb = len(video_bytes) / (1024 * 1024)
    filename = video_url.split("?")[0].split("/")[-1] or "video.mp4"
    if not Path(filename).suffix:
        filename += ".mp4"

    # Upload to R2
    r2_key = f"uploads/{_uuid.uuid4()}/{filename}"
    s3 = boto3.client(
        "s3", endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )
    s3.put_object(Bucket=R2_BUCKET_NAME, Key=r2_key, Body=video_bytes,
                  ContentType=resp.headers.get("content-type", "video/mp4"))

    # Create job
    job_id = str(_uuid.uuid4())
    sb.table("jobs").insert({
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "video_name": filename,
        "video_size_mb": round(file_size_mb, 2),
        "video_url": r2_key,
        "title": (reel.get("caption") or "")[:80] or shortcode or "Untitled",
        "thumbnail_url": reel.get("thumbnail_url", ""),
        "channel_name": reel.get("radar_channels", {}).get("ig_username", ""),
        "source_url": video_url,
        "posted_at": reel.get("posted_at"),
    }).execute()

    # Update reel record
    sb.table("radar_reels").update({
        "job_id": job_id,
        "is_analyzed": True,
    }).eq("id", reel_id).execute()

    # Run analysis in background thread
    asyncio.get_event_loop().run_in_executor(
        None, run_analysis, job_id, r2_key, None, None,
    )

    return {"job_id": job_id, "reel_id": reel_id}


async def _dispatch_collect(sb, channel: dict) -> int:
    platform = channel.get("platform", "instagram")
    if platform == "youtube":
        return await _collect_shorts_for_channel(sb, channel)
    elif platform == "tiktok":
        return await _collect_tiktoks_for_channel(sb, channel)
    else:
        return await _collect_reels_for_channel(sb, channel)


# ─── Instagram Collection ───


async def _collect_reels_for_channel(sb, channel: dict) -> int:
    ig_user_id = channel.get("ig_user_id")
    if not ig_user_id:
        try:
            ig_user_id = await ig_looter.get_user_id(channel["ig_username"])
            sb.table("radar_channels").update({"ig_user_id": ig_user_id}).eq("id", channel["id"]).execute()
        except Exception:
            return 0

    try:
        raw_reels = await ig_looter.get_user_reels(ig_user_id, count=12)
    except Exception:
        return 0

    avg_views = channel.get("avg_views_30d", 0)
    if avg_views <= 0 and raw_reels:
        views_list = [r.get("view_count", 0) for r in raw_reels if r.get("view_count", 0) > 0]
        if views_list:
            avg_views = sum(views_list) / len(views_list)
            sb.table("radar_channels").update({"avg_views_30d": avg_views}).eq("id", channel["id"]).execute()

    count = 0
    for reel in raw_reels:
        views = reel.get("view_count", 0)
        likes = reel.get("like_count", 0)
        comments = reel.get("comment_count", 0)

        posted_at = reel.get("posted_at")
        if isinstance(posted_at, (int, float)):
            posted_at = datetime.fromtimestamp(posted_at, tz=timezone.utc).isoformat()

        row = {
            "channel_id": channel["id"],
            "ig_media_id": reel["ig_media_id"],
            "shortcode": reel.get("shortcode", ""),
            "thumbnail_url": reel.get("thumbnail_url", ""),
            "video_url": reel.get("video_url", ""),
            "caption": reel.get("caption", ""),
            "view_count": views,
            "like_count": likes,
            "comment_count": comments,
            "spike_multiplier": ig_looter.calc_spike(views, avg_views),
            "engagement_rate": ig_looter.calc_engagement(likes, comments, views),
            "comment_ratio": ig_looter.calc_comment_ratio(comments, likes),
            "platform": "instagram",
            "posted_at": posted_at,
        }

        try:
            sb.table("radar_reels").upsert(row, on_conflict="ig_media_id").execute()
            count += 1
        except Exception:
            continue

    return count


# ─── YouTube Collection ───


async def _collect_shorts_for_channel(sb, channel: dict) -> int:
    channel_id_yt = channel.get("ig_user_id")
    if not channel_id_yt:
        return 0

    try:
        raw_shorts = await yt_looter.get_channel_shorts(channel_id_yt, count=30)
    except Exception:
        return 0

    detailed_shorts = []
    for short in raw_shorts:
        vid = short.get("video_id", "")
        if not vid:
            continue
        try:
            detail = await yt_looter.get_video_detail(vid)
            detail["thumbnail_url"] = short.get("thumbnail_url") or detail.get("thumbnail_url", "")
            detailed_shorts.append(detail)
        except Exception:
            detailed_shorts.append({
                "video_id": vid,
                "title": short.get("title", ""),
                "thumbnail_url": short.get("thumbnail_url", ""),
                "view_count": short.get("view_count", 0),
                "like_count": 0,
                "comment_count": 0,
                "published_at": "",
            })

    avg_views = channel.get("avg_views_30d", 0)
    if avg_views <= 0 and detailed_shorts:
        views_list = [s.get("view_count", 0) for s in detailed_shorts if s.get("view_count", 0) > 0]
        if views_list:
            avg_views = sum(views_list) / len(views_list)
            sb.table("radar_channels").update({"avg_views_30d": avg_views}).eq("id", channel["id"]).execute()

    count = 0
    for short in detailed_shorts:
        vid = short.get("video_id", "")
        views = short.get("view_count", 0)
        likes = short.get("like_count", 0)
        comments = short.get("comment_count", 0)

        row = {
            "channel_id": channel["id"],
            "ig_media_id": f"yt_{vid}",
            "shortcode": vid,
            "thumbnail_url": short.get("thumbnail_url", ""),
            "video_url": f"https://www.youtube.com/shorts/{vid}",
            "caption": short.get("title", ""),
            "view_count": views,
            "like_count": likes,
            "comment_count": comments,
            "spike_multiplier": yt_looter.calc_spike(views, avg_views),
            "engagement_rate": yt_looter.calc_engagement(likes, comments, views),
            "comment_ratio": ig_looter.calc_comment_ratio(comments, likes),
            "platform": "youtube",
            "posted_at": short.get("published_at") or None,
        }

        try:
            sb.table("radar_reels").upsert(row, on_conflict="ig_media_id").execute()
            count += 1
        except Exception:
            continue

    return count


# ─── TikTok Collection ───


async def _collect_tiktoks_for_channel(sb, channel: dict) -> int:
    sec_uid = channel.get("ig_user_id")  # secUid stored here
    if not sec_uid:
        # Try to fetch secUid
        try:
            info = await tt_looter.get_user_info(channel["ig_username"])
            sec_uid = info.get("sec_uid", "")
            if sec_uid:
                sb.table("radar_channels").update({"ig_user_id": sec_uid}).eq("id", channel["id"]).execute()
        except Exception:
            return 0
    if not sec_uid:
        return 0

    try:
        raw_posts = await tt_looter.get_user_posts(sec_uid, count=20)
    except Exception:
        return 0

    avg_views = channel.get("avg_views_30d", 0)
    if avg_views <= 0 and raw_posts:
        views_list = [p.get("view_count", 0) for p in raw_posts if p.get("view_count", 0) > 0]
        if views_list:
            avg_views = sum(views_list) / len(views_list)
            sb.table("radar_channels").update({"avg_views_30d": avg_views}).eq("id", channel["id"]).execute()

    count = 0
    for post in raw_posts:
        vid = post.get("video_id", "")
        views = post.get("view_count", 0)
        likes = post.get("like_count", 0)
        comments = post.get("comment_count", 0)

        posted_at = post.get("posted_at")
        if isinstance(posted_at, (int, float)):
            posted_at = datetime.fromtimestamp(posted_at, tz=timezone.utc).isoformat()

        row = {
            "channel_id": channel["id"],
            "ig_media_id": f"tt_{vid}",
            "shortcode": vid,
            "thumbnail_url": post.get("thumbnail_url", ""),
            "video_url": f"https://www.tiktok.com/@{channel['ig_username']}/video/{vid}",
            "caption": post.get("caption", ""),
            "view_count": views,
            "like_count": likes,
            "comment_count": comments,
            "spike_multiplier": tt_looter.calc_spike(views, avg_views),
            "engagement_rate": tt_looter.calc_engagement(likes, comments, views),
            "comment_ratio": tt_looter.calc_comment_ratio(comments, likes),
            "platform": "tiktok",
            "posted_at": posted_at,
        }

        try:
            sb.table("radar_reels").upsert(row, on_conflict="ig_media_id").execute()
            count += 1
        except Exception:
            continue

    return count
