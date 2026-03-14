"""Quota API — 사용자 회수 제한 조회."""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.services.quota import get_or_create_quota

router = APIRouter()


@router.get("/quota")
async def get_quota(user: dict = Depends(get_current_user)):
    """현재 사용자의 quota 상태 반환."""
    row = get_or_create_quota(user["id"])
    return {
        "plan": row["plan"],
        "quotas": row["quotas"],
        "reset_at": row["reset_at"],
    }
