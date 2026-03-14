"""Quota service — Free/Pro 회수 제한 관리."""

import logging
from datetime import datetime, timezone

from app.services.storage import _supabase

logger = logging.getLogger(__name__)

# Free 기본값
FREE_DEFAULTS: dict = {
    "analyze": {"limit": 5, "used": 0},
    "compare": {"limit": 2, "used": 0},
    "library": {"limit": 20, "used": 0},
    "radar": {"limit": 1, "used": 0},
    "guide": {"limit": 3, "used": 0},
    "script": {"limit": 1, "used": 0},
}


def _next_reset_at() -> str:
    """다음 월초 리셋 시점 (UTC) ISO 문자열."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        reset = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        reset = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return reset.isoformat()


def get_or_create_quota(user_id: str) -> dict:
    """사용자 quota 조회. 없으면 free 기본값으로 생성."""
    sb = _supabase()
    resp = (
        sb.table("user_quotas")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if resp.data:
        row = resp.data
        # 월초 리셋 체크
        reset_at = datetime.fromisoformat(row["reset_at"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if now >= reset_at:
            # used를 모두 0으로 리셋
            quotas = row["quotas"]
            for feature in quotas:
                quotas[feature]["used"] = 0
            new_reset = _next_reset_at()
            sb.table("user_quotas").update({
                "quotas": quotas,
                "reset_at": new_reset,
                "updated_at": now.isoformat(),
            }).eq("user_id", user_id).execute()
            row["quotas"] = quotas
            row["reset_at"] = new_reset
            logger.info("quota_monthly_reset user_id=%s", user_id)
        return row

    # 신규 생성
    new_row = {
        "user_id": user_id,
        "plan": "free",
        "quotas": FREE_DEFAULTS,
        "reset_at": _next_reset_at(),
    }
    insert_resp = sb.table("user_quotas").insert(new_row).execute()
    return insert_resp.data[0] if insert_resp.data else new_row


def check_quota(user_id: str, feature: str) -> dict:
    """quota 체크. 초과 시 상세 dict 반환, 여유 있으면 None."""
    row = get_or_create_quota(user_id)
    quotas = row["quotas"]
    feat = quotas.get(feature)
    if not feat:
        return None  # 미정의 feature는 제한 없음

    if feat["used"] >= feat["limit"]:
        return {
            "error": "quota_exceeded",
            "feature": feature,
            "used": feat["used"],
            "limit": feat["limit"],
            "plan": row["plan"],
            "reset_at": row["reset_at"],
        }
    return None


def increment_quota(user_id: str, feature: str) -> None:
    """사용 횟수 +1."""
    row = get_or_create_quota(user_id)
    quotas = row["quotas"]
    if feature not in quotas:
        return
    quotas[feature]["used"] += 1
    sb = _supabase()
    sb.table("user_quotas").update({
        "quotas": quotas,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user_id).execute()
