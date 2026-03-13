"""Entity overlap — find entities sharing a time range in recipe_json."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter(prefix="/entities")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@router.get("/overlap")
async def entity_overlap(
    result_id: str = Query(..., description="분석 결과 UUID"),
    start: float = Query(..., description="시작 시간(초)"),
    end: float = Query(..., description="종료 시간(초)"),
):
    if start < 0 or end < 0 or start > end:
        raise HTTPException(status_code=400, detail="유효하지 않은 시간 범위")

    sb = get_supabase()
    resp = sb.rpc("find_overlapping_entities", {
        "p_result_id": result_id,
        "p_start": start,
        "p_end": end,
    }).execute()
    return resp.data
