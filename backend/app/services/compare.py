"""Compare service — 비교 분석 (소구점 매칭 + AI 코칭)."""

import json
import logging
from typing import Any

from google import genai

from app.config import GEMINI_API_KEY, GEMINI_API_KEY_PRO
from app.services.storage import _supabase

logger = logging.getLogger(__name__)


def _get_gemini() -> genai.Client:
    """Gemini 클라이언트 반환."""
    api_key = GEMINI_API_KEY_PRO or GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    return genai.Client(api_key=api_key)


def resolve_result_ids(job_ids: list[str]) -> list[str]:
    """job_ids → result_ids 변환. content_dna는 result_id 기반이므로."""
    sb = _supabase()
    resp = (
        sb.table("results")
        .select("id, job_id")
        .in_("job_id", job_ids)
        .execute()
    )
    if not resp.data:
        return job_ids  # fallback: 그대로 사용
    job_to_result = {r["job_id"]: r["id"] for r in resp.data}
    return [job_to_result.get(jid, jid) for jid in job_ids]


def fetch_content_dna_rows(result_ids: list[str]) -> list[dict]:
    """content_dna 테이블에서 result_ids에 해당하는 행 조회."""
    sb = _supabase()
    resp = (
        sb.table("content_dna")
        .select("*")
        .in_("result_id", result_ids)
        .execute()
    )
    return resp.data or []


def fetch_recipe_claims(result_ids: list[str]) -> dict[str, list[dict]]:
    """results 테이블에서 recipe_json의 claims 추출. {result_id: claims[]}."""
    sb = _supabase()
    out: dict[str, list[dict]] = {}
    for rid in result_ids:
        try:
            resp = (
                sb.table("results")
                .select("recipe_json")
                .eq("job_id", rid)
                .single()
                .execute()
            )
            if resp.data and resp.data.get("recipe_json"):
                recipe = resp.data["recipe_json"]
                claims = recipe.get("product", {}).get("claims", [])
                out[rid] = claims
            else:
                out[rid] = []
        except Exception:
            out[rid] = []
    return out


def build_structure_comparison(dna_rows: list[dict], result_ids: list[str]) -> list[dict]:
    """content_dna 행들로부터 구조 비교 데이터 생성 (파트1)."""
    # result_id 순서 보존
    id_to_row = {r["result_id"]: r for r in dna_rows}
    rows_ordered = [id_to_row.get(rid, {}) for rid in result_ids]

    fields = [
        ("duration", "길이(초)"),
        ("platform", "플랫폼"),
        ("cut_count", "컷 수"),
        ("hook_type", "훅 타입"),
        ("hook_strength", "훅 강도"),
        ("first_3s_dynamics", "첫 3초 변화량"),
        ("block_sequence", "블록 순서"),
        ("appeal_distribution", "소구 분포"),
        ("cut_avg_duration", "컷 평균 길이"),
        ("dynamics_avg", "변화량 평균"),
        ("dynamics_std", "변화량 표준편차"),
        ("has_person", "인물 등장"),
        ("voice_type", "음성 타입"),
        ("has_text_overlay", "텍스트 오버레이"),
    ]

    comparison: list[dict] = []
    for field_key, field_label in fields:
        values = []
        for row in rows_ordered:
            val = row.get(field_key)
            # appeal_distribution은 JSON 문자열일 수 있음
            if field_key == "appeal_distribution" and isinstance(val, str):
                try:
                    val = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
            values.append(val)
        comparison.append({"key": field_key, "label": field_label, "values": values})

    return comparison


def match_claims_via_gemini(
    claims_by_video: dict[str, list[dict]],
    video_labels: list[str],
) -> dict:
    """Gemini로 소구점 매칭. claims_by_video: {result_id: claims[]}."""
    # 프롬프트용 데이터 준비
    claims_prompt_parts = []
    for label, (rid, claims) in zip(video_labels, claims_by_video.items()):
        claims_text = json.dumps(
            [{"claim": c.get("claim", ""), "type": c.get("type", ""), "time_range": c.get("time_range"), "strategy": c.get("strategy", "")} for c in claims],
            ensure_ascii=False,
        )
        claims_prompt_parts.append(f"영상 {label} (id: {rid}):\n{claims_text}")

    prompt = f"""아래는 {len(video_labels)}개 영상의 소구점(claims) 목록입니다.
비슷한 주제/의도를 가진 소구점끼리 그룹으로 묶어주세요.
매칭이 안 되는 소구점은 "고유 소구"로 분류하세요.

{chr(10).join(claims_prompt_parts)}

출력 형식 (JSON만, 설명 없이):
{{
  "matched_groups": [
    {{
      "theme": "그룹 주제 (한국어)",
      "claims": [
        {{"video": "A", "result_id": "...", "claim": "...", "type": "...", "time_range": [0,0], "strategy": "..."}}
      ]
    }}
  ],
  "unique_claims": [
    {{"video": "A", "result_id": "...", "claim": "...", "type": "...", "time_range": [0,0]}}
  ]
}}"""

    client = _get_gemini()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = (response.text or "").strip()

    # JSON 파싱 (```json 래핑 제거)
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("claim_matching JSON parse failed: %s", text[:200])
        return {"matched_groups": [], "unique_claims": [], "raw": text}


def generate_coaching_via_gemini(
    scenario: str,
    base_result_id: str | None,
    dna_rows: list[dict],
    claim_matching: dict,
    video_labels: list[str],
    result_ids: list[str],
) -> dict:
    """Gemini로 AI 코칭 생성."""
    # DNA 요약
    id_to_row = {r["result_id"]: r for r in dna_rows}
    summaries = []
    for label, rid in zip(video_labels, result_ids):
        row = id_to_row.get(rid, {})
        appeal = row.get("appeal_distribution")
        if isinstance(appeal, str):
            try:
                appeal = json.loads(appeal)
            except (json.JSONDecodeError, TypeError):
                pass
        summary = {
            "label": label,
            "result_id": rid,
            "category": row.get("category"),
            "platform": row.get("platform"),
            "duration": row.get("duration"),
            "block_sequence": row.get("block_sequence"),
            "appeal_distribution": appeal,
            "hook_type": row.get("hook_type"),
            "hook_strength": row.get("hook_strength"),
            "first_3s_dynamics": row.get("first_3s_dynamics"),
            "dynamics_avg": row.get("dynamics_avg"),
            "cut_count": row.get("cut_count"),
            "cut_avg_duration": row.get("cut_avg_duration"),
        }
        summaries.append(summary)

    base_label = None
    if scenario == "A" and base_result_id:
        for label, rid in zip(video_labels, result_ids):
            if rid == base_result_id:
                base_label = label
                break

    scenario_desc = (
        f'시나리오 A: 기준 영상 "{base_label}" 개선. "이 영상을 나머지처럼 만들려면 이걸 바꿔라" 방향.'
        if scenario == "A"
        else '시나리오 B: 패턴 추출. "이 영상들의 공통 패턴은 무엇이고, 왜 효과적인지" 방향.'
    )

    prompt = f"""당신은 숏폼 영상 구조 전문가입니다.

[시나리오 정보]
{scenario_desc}

[분석 데이터]
{json.dumps(summaries, ensure_ascii=False, indent=2)}

[소구점 매칭 결과]
{json.dumps(claim_matching, ensure_ascii=False, indent=2)}

[코칭 규칙]
1. 일반론 금지. 이 영상들의 데이터에서만 발견되는 사실만.
2. 모든 제안에 정량 근거 포함 (수치, 비율, 차이).
3. 구간 지정이 가능하면 포함.
4. 최대 3개 핵심 제안. 양보다 질.

출력 형식 (JSON만, 설명 없이):
{{
  "title": "코칭 제목",
  "items": [
    {{
      "topic": "항목 제목",
      "current": "현재 상태 (데이터 기반)",
      "suggestion": "제안",
      "evidence": "정량 근거"
    }}
  ],
  "pattern_summary": "공통 패턴 요약 (시나리오 B일 때만)"
}}"""

    client = _get_gemini()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = (response.text or "").strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("coaching JSON parse failed: %s", text[:200])
        return {"title": "AI 코칭", "items": [], "raw": text}


def save_comparison_report(
    user_id: str,
    scenario: str,
    base_result_id: str | None,
    result_ids: list[str],
    claim_matching: dict,
    coaching: dict,
) -> dict:
    """comparison_reports 테이블에 저장 후 반환."""
    sb = _supabase()
    row = {
        "user_id": user_id,
        "scenario": scenario,
        "base_result_id": base_result_id,
        "result_ids": result_ids,
        "claim_matching": claim_matching,
        "coaching": coaching,
    }
    resp = sb.table("comparison_reports").insert(row).execute()
    return resp.data[0] if resp.data else row
