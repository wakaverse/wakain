"""비교 분석 API — POST /compare."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.services.quota import check_quota, increment_quota
from app.services.compare import (
    fetch_content_dna_rows,
    fetch_recipe_claims,
    build_structure_comparison,
    match_claims_via_gemini,
    generate_coaching_via_gemini,
    save_comparison_report,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class CompareRequest(BaseModel):
    result_ids: list[str]
    scenario: str = "B"  # "A" or "B"
    base_result_id: str | None = None


@router.post("/compare")
async def compare_videos(
    body: CompareRequest,
    user: dict = Depends(get_current_user),
):
    """비교 분석 실행: 구조 비교 + 소구점 매칭 + AI 코칭."""
    # Validation
    if len(body.result_ids) < 2 or len(body.result_ids) > 3:
        raise HTTPException(status_code=400, detail="2~3개의 영상을 선택해주세요.")

    if body.scenario not in ("A", "B"):
        raise HTTPException(status_code=400, detail="시나리오는 A 또는 B만 가능합니다.")

    if body.scenario == "A" and not body.base_result_id:
        raise HTTPException(status_code=400, detail="시나리오 A에서는 기준 영상을 선택해주세요.")

    if body.base_result_id and body.base_result_id not in body.result_ids:
        raise HTTPException(status_code=400, detail="기준 영상은 비교 대상에 포함되어야 합니다.")

    # Quota check
    exceeded = check_quota(user["id"], "compare")
    if exceeded:
        raise HTTPException(status_code=403, detail=exceeded)

    # 0. job_ids → result_ids 변환
    from app.services.compare import resolve_result_ids
    resolved_ids = resolve_result_ids(body.result_ids)

    # 1. content_dna 조회 (파트1: 구조 비교)
    dna_rows = fetch_content_dna_rows(resolved_ids)
    if not dna_rows:
        raise HTTPException(status_code=404, detail="분석 데이터를 찾을 수 없습니다.")

    video_labels = [chr(65 + i) for i in range(len(body.result_ids))]  # A, B, C

    structure = build_structure_comparison(dna_rows, body.result_ids)

    # 2. 소구점 매칭 (파트2: Gemini 콜 1)
    claims_by_video = fetch_recipe_claims(body.result_ids)
    claim_matching = match_claims_via_gemini(claims_by_video, video_labels)

    # 3. AI 코칭 (파트3: Gemini 콜 2)
    coaching = generate_coaching_via_gemini(
        scenario=body.scenario,
        base_result_id=body.base_result_id,
        dna_rows=dna_rows,
        claim_matching=claim_matching,
        video_labels=video_labels,
        result_ids=body.result_ids,
    )

    # Increment quota after success
    increment_quota(user["id"], "compare")

    # 4. 저장
    report = save_comparison_report(
        user_id=user["id"],
        scenario=body.scenario,
        base_result_id=body.base_result_id,
        result_ids=body.result_ids,
        claim_matching=claim_matching,
        coaching=coaching,
    )

    return {
        "report_id": report.get("id"),
        "scenario": body.scenario,
        "base_result_id": body.base_result_id,
        "result_ids": body.result_ids,
        "video_labels": video_labels,
        "structure": structure,
        "claim_matching": claim_matching,
        "coaching": coaching,
    }
