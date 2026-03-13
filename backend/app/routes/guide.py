"""제작가이드 — 대본 초안 생성 API."""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google import genai
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, GEMINI_API_KEY_PRO
from app.auth import get_current_user

router = APIRouter()


def _get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _get_gemini_client() -> genai.Client:
    api_key = GEMINI_API_KEY_PRO or GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    return genai.Client(api_key=api_key)


class GenerateScriptRequest(BaseModel):
    result_id: str


@router.post("/generate-script")
async def generate_script(
    body: GenerateScriptRequest,
    user: dict = Depends(get_current_user),
):
    """분석 결과 기반 대본 초안 생성 (Gemini 1콜)."""
    supabase = _get_supabase()

    # 1. result에서 recipe_json 조회
    resp = (
        supabase.table("results")
        .select("recipe_json")
        .eq("job_id", body.result_id)
        .single()
        .execute()
    )
    if not resp.data or not resp.data.get("recipe_json"):
        raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다")

    recipe = resp.data["recipe_json"]

    # 2. 필요한 데이터 추출
    identity = recipe.get("identity", {})
    product = recipe.get("product", {})
    script = recipe.get("script", {})
    evaluation = recipe.get("evaluation", {})

    # blocks 요약
    blocks_text = ""
    for i, block in enumerate(script.get("blocks", []), 1):
        tr = block.get("time_range", [0, 0])
        blocks_text += f"{i}. [{tr[0]}-{tr[1]}초] {block.get('block', '')}: {block.get('text', '')[:80]}\n"

    # claims 나열
    claims_text = ""
    for claim in product.get("claims", []):
        claims_text += f"- {claim.get('claim', '')} ({claim.get('type', '')})\n"

    # improvements 나열
    improvements_text = ""
    for imp in evaluation.get("improvements", []):
        improvements_text += f"- 현재: {imp.get('fact', '')}\n  제안: {imp.get('suggestion', '')}\n"

    # 3. 프롬프트 구성
    prompt = f"""아래 영상 분석 데이터를 기반으로, 비슷한 구조의 숏폼 대본 초안을 작성해주세요.

## 영상 정보
- 카테고리: {identity.get('category_ko', identity.get('category', ''))}
- 제품: {identity.get('name', '')}
- 브랜드: {identity.get('brand', '')}

## 현재 대본 구조 (block 순서)
{blocks_text}

## 소구점
{claims_text}

## 코칭 개선 사항
{improvements_text}

## 요청
1. 위 구조를 유지하되 코칭 개선 사항을 반영한 개선된 대본을 작성
2. 각 블록(hook, benefit, proof, cta 등)별로 나누어 작성
3. 시간 배분도 표시 (예: [0-3초] Hook)
4. 자연스러운 한국어 구어체로 작성"""

    # 4. Gemini 호출
    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        script_text = response.text or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대본 생성에 실패했습니다: {str(e)}")

    return {"script": script_text}
