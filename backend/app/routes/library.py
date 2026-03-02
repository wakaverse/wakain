"""Library feature — save, manage, and search collected/analyzed videos."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import create_client

from app.auth import get_current_user
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter(prefix="/library")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class LibraryItemCreate(BaseModel):
    platform: str | None = None
    source: str = "manual"  # radar/hack/manual
    original_url: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    title: str | None = None
    channel_name: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    comment_count: int | None = None
    spike_multiplier: float | None = None
    job_id: str | None = None
    tags: list[str] = []
    memo: str | None = None


class LibraryItemUpdate(BaseModel):
    tags: list[str] | None = None
    memo: str | None = None
    is_starred: bool | None = None
    title: str | None = None


@router.post("/items")
async def add_item(body: LibraryItemCreate, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    row = {"user_id": user["id"], **body.model_dump(exclude_none=True)}
    resp = sb.table("library_items").insert(row).execute()
    if not resp.data:
        raise HTTPException(status_code=400, detail="라이브러리에 추가할 수 없습니다")
    return resp.data[0]


@router.get("/items")
async def list_items(
    source: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    starred: Optional[bool] = Query(None),
    sort: str = Query("recent"),  # recent/starred/views/spike
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("library_items").select("*", count="exact").eq("user_id", user["id"])

    if source:
        query = query.eq("source", source)
    if platform:
        query = query.eq("platform", platform)
    if starred is True:
        query = query.eq("is_starred", True)
    if tag:
        query = query.contains("tags", [tag])
    if keyword:
        query = query.or_(f"title.ilike.%{keyword}%,channel_name.ilike.%{keyword}%,memo.ilike.%{keyword}%")

    sort_map = {
        "recent": ("created_at", True),
        "starred": ("is_starred", True),
        "views": ("view_count", True),
        "spike": ("spike_multiplier", True),
    }
    col, desc = sort_map.get(sort, ("created_at", True))
    query = query.order(col, desc=desc)

    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)
    resp = query.execute()
    return {"items": resp.data, "total": resp.count or 0}


@router.patch("/items/{item_id}")
async def update_item(item_id: str, body: LibraryItemUpdate, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("library_items").select("id").eq("id", item_id).eq("user_id", user["id"]).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing.data
    resp = sb.table("library_items").update(updates).eq("id", item_id).execute()
    return resp.data[0] if resp.data else existing.data


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("library_items").select("id").eq("id", item_id).eq("user_id", user["id"]).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다")
    sb.table("library_items").delete().eq("id", item_id).execute()
    return {"ok": True}
