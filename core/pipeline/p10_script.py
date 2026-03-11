"""P10: SCRIPT — 대본 블록(10종) + 화법(α기법 21종) 분석.

P1 STT 전체 텍스트(타임스탬프 포함) + P7 claims를
gemini-2.5-flash에 보내 대본 블록 구조 + 화법을 분석한다.
utterance 태깅은 하지 않음 (P12에서 STT 매칭).
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client, upload_video
from core.schemas.pipeline import (
    ProductOutput,
    ScanOutput,
    ScriptOutput,
    STTOutput,
)

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3

PROMPT_TEMPLATE = """You are a script structure analyst for shortform marketing videos.

## Video Context
- Product: {product_name} ({product_brand})
- Category: {category} > {sub_category}

## STT Transcript:
{full_transcript_with_timestamps}

## Product Claims (reference — link blocks to these):
{claims_json}

{language_rules}

## Task: Break script into persuasion blocks.

Block types (뼈대 10종):
- hook: 첫 3초 시청자 주의 포착
- authority: 권위/신뢰 부여
- benefit: 핵심 베네핏 (sub: sensory/functional/emotional/process)
- proof: 증거/입증
- differentiation: 차별화
- social_proof: 사회적 증거
- cta: 행동 유도
- pain_point: 문제 제기, 공감 유도 ('이런 거 불편하셨죠?')
- demo: 사용법/시연 ('이렇게 바르시면 됩니다')
- promotion: 할인/혜택/한정 ('오늘만 50% 할인')

Alpha techniques (화법) — for EACH block:
  emotion: empathy/fomo/anticipation/relief/curiosity/pride/nostalgia/frustration/null
  structure: reversal/contrast/repetition/info_density/escalation/before_after/problem_solution/story_arc/null
  connection: bridge_sentence/rhythm_shift/callback/question_answer/pause_emphasis/null

Rules:
- block alpha = representative technique for the block
- alpha_summary = count ALL technique instances across ALL utterances in the video
  (a block with 3 sentences may contribute 3 emotion counts)
- product_claim_ref = exact claim text from claims list, null if not linked

Response (JSON only, use EXACTLY these field names: "blocks", "flow_order", "alpha_summary"):"""

RESPONSE_EXAMPLE = """
Example response format:
{
  "blocks": [{"block": "hook", "text": "...", "time_range": [0, 4], "benefit_sub": null, "product_claim_ref": "claim text or null", "alpha": {"emotion": "anticipation", "structure": "info_density", "connection": null}}],
  "flow_order": ["hook", "benefit", "proof", "cta"],
  "alpha_summary": {"emotion": {"anticipation": 1}, "structure": {"info_density": 2}, "connection": {"bridge_sentence": 1}}
}"""


def _format_transcript(stt_output: STTOutput) -> str:
    """P1 STT segments를 "[start-end] text" 형식으로 변환."""
    lines = []
    for seg in stt_output.segments:
        lines.append(f"[{seg.start}-{seg.end}] {seg.text}")
    return "\n".join(lines)


LANGUAGE_RULES_TEMPLATE = """## Language Rules
- Enum/key values: ALWAYS English (e.g., "food", "hook", "fomo")
- Product name & brand: Keep ORIGINAL as spoken/shown in video
- STT transcript references: Keep ORIGINAL language
- All descriptions, reasons, analyses, explanations: Write in {output_language}"""


def _build_prompt(
    stt_output: STTOutput | None,
    scan_output: ScanOutput | None,
    product_output: ProductOutput | None,
    output_language: str = "ko",
) -> str:
    """P1/P2/P7 결과를 프롬프트에 동적 삽입."""
    product_name = "unknown"
    product_brand = "unknown"
    category = "other"
    sub_category = "other"
    full_transcript = ""
    claims_json = "[]"

    if scan_output:
        product_name = scan_output.product.name or "unknown"
        product_brand = scan_output.product.brand or "unknown"
        category = scan_output.product.category
        sub_category = scan_output.product.sub_category

    if stt_output:
        full_transcript = _format_transcript(stt_output)

    if product_output:
        claims_json = json.dumps(
            [c.model_dump(mode="json") for c in product_output.claims],
            ensure_ascii=False,
            indent=2,
        )

    language_rules = LANGUAGE_RULES_TEMPLATE.format(output_language=output_language)
    prompt = PROMPT_TEMPLATE.format(
        product_name=product_name,
        product_brand=product_brand,
        category=category,
        sub_category=sub_category,
        full_transcript_with_timestamps=full_transcript,
        claims_json=claims_json,
        language_rules=language_rules,
    )
    return prompt + "\n" + RESPONSE_EXAMPLE


def _extract_usage(response) -> dict:
    """Gemini response에서 usage_metadata 추출."""
    usage = {"input_tokens": 0, "output_tokens": 0, "model": MODEL}
    meta = getattr(response, "usage_metadata", None)
    if meta:
        usage["input_tokens"] = getattr(meta, "prompt_token_count", 0) or 0
        usage["output_tokens"] = getattr(meta, "candidates_token_count", 0) or 0
    return usage


async def run(
    video_path: str,
    output_dir: str,
    stt_output: STTOutput | None = None,
    scan_output: ScanOutput | None = None,
    product_output: ProductOutput | None = None,
    api_key: str | None = None,
    output_language: str = "ko",
) -> tuple[ScriptOutput, dict]:
    """P10 SCRIPT 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 결과 저장 디렉토리
        stt_output: P1 STT 결과
        scan_output: P2 SCAN 결과
        product_output: P7 PRODUCT 결과 (claims 참조)
        api_key: Gemini API 키

    Returns:
        (ScriptOutput, usage_dict)
    """
    client = make_client(api_key)

    # 영상 업로드 (캐시 재사용)
    uploaded = upload_video(video_path, client=client)

    # 프롬프트 생성
    prompt = _build_prompt(stt_output, scan_output, product_output, output_language)

    # Gemini 호출
    result, usage = await _call_gemini(client, uploaded, prompt)

    # 결과 저장
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "p10_script.json"
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("P10 결과 저장: %s", out_path)

    return result, usage


_VALID_BENEFIT_SUBS = {"sensory", "functional", "emotional", "process"}
_VALID_BLOCK_TYPES = {
    "hook", "authority", "benefit", "proof", "differentiation",
    "social_proof", "cta", "pain_point", "demo", "promotion",
}


def _normalize_response(data: dict) -> None:
    """Gemini 응답을 ScriptOutput 스키마에 맞게 정규화."""
    # 키 이름 정규화
    if "persuasion_blocks" in data and "blocks" not in data:
        data["blocks"] = data.pop("persuasion_blocks")

    for block in data.get("blocks", []):
        # block type: 유효하지 않은 값 → benefit 폴백
        btype = block.get("block")
        if btype and btype not in _VALID_BLOCK_TYPES:
            block["block"] = "benefit"

        # product_claim_ref: list → 첫 번째 문자열로
        ref = block.get("product_claim_ref")
        if isinstance(ref, list):
            block["product_claim_ref"] = ref[0] if ref else None

        # benefit_sub: 유효하지 않은 값 → null
        bsub = block.get("benefit_sub")
        if bsub and bsub not in _VALID_BENEFIT_SUBS:
            block["benefit_sub"] = None


async def _call_gemini(
    client, uploaded_file: types.File, prompt: str
) -> tuple[ScriptOutput, dict]:
    """Gemini API 호출 + 재시도."""
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=[
                    types.Part.from_uri(
                        file_uri=uploaded_file.uri,
                        mime_type=uploaded_file.mime_type,
                    ),
                    types.Part.from_text(text=prompt),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            _normalize_response(data)
            return ScriptOutput.model_validate(data), _extract_usage(response)
        except Exception as e:
            wait = 2**attempt * 5
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "P10 SCRIPT 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"P10 SCRIPT 실패 ({MAX_RETRIES}회 시도): {e}"
                ) from e
    # unreachable
    raise RuntimeError("P10 SCRIPT 실패")
