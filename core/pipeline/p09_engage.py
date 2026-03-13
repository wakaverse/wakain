"""P9: ENGAGE — 리텐션 + 이탈 위험 분석.

영상 전체 + P1 STT 결과를 gemini-2.5-flash에 보내
리텐션/이탈 위험만 분석한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client, upload_video
from core.schemas.pipeline import EngageOutput, ScanOutput, STTOutput

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3

PROMPT_TEMPLATE = """You are a viewer retention analyst for shortform marketing videos.

## Video Context
- Category: {category}
- Duration: {duration}s

{stt_transcript}

## Task: Analyse retention, hook elements, and drop-off risk.

1. retention_analysis:
   - hook_strength: strong/moderate/weak
   - hook_reason: 1 sentence
   - hook_scan: Decompose hooking elements in 2 time windows:
     - first_3s (0~3s) and first_8s (0~8s), each containing:
       - appeal_type: appeal type shown (price/experience/information/emotion/null)
       - text_banner: whether text banner/overlay appears (true/false)
       - text_banner_content: banner text content if present (string/null)
       - person_appear: whether a person appears (true/false)
       - product_appear: whether the product is directly shown (true/false)
       - sound_change: whether there is a sound effect/BGM change (true/false)
       - cut_count: number of scene transitions in the window (int)
       - dominant_element: the single most dominant element in 1 line
     - hook_type: hooking strategy type (question/shock/curiosity/benefit/story/etc.)
     - summary: 1-line summary of the hooking strategy
   - rewatch_triggers: [{{time: float, trigger: string}}]
   - share_triggers: [{{time: float, trigger: string}}]
   - comment_triggers: [{{time: float, trigger: string}}]

2. dropoff_analysis:
   - risk_zones: [{{time_range: [start, end], risk_level: high/medium/low, reason: string}}]
   - safe_zones: [{{time_range: [start, end], reason: string}}]

## Language Rules
- Enum/key values: ALWAYS English (e.g., "food", "hook", "fomo")
- Product name & brand: Keep ORIGINAL as spoken/shown in video
- STT transcript references: Keep ORIGINAL language
- All descriptions, reasons, analyses, explanations: Write in {output_language}

Response (JSON only):"""


def _build_prompt(
    stt_output: STTOutput | None,
    scan_output: ScanOutput | None,
    output_language: str = "ko",
) -> str:
    """P1/P2 결과를 프롬프트에 동적 삽입."""
    category = "other"
    duration = 0.0
    stt_transcript = ""

    if scan_output:
        category = scan_output.product.category
        duration = scan_output.meta.duration

    if stt_output:
        stt_transcript = stt_output.full_text

    return PROMPT_TEMPLATE.format(
        category=category,
        duration=duration,
        stt_transcript=stt_transcript,
        output_language=output_language,
    )


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
    api_key: str | None = None,
    output_language: str = "ko",
) -> tuple[EngageOutput, dict]:
    """P9 ENGAGE 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 결과 저장 디렉토리
        stt_output: P1 STT 결과 (프롬프트 삽입용)
        scan_output: P2 SCAN 결과 (프롬프트 삽입용)
        api_key: Gemini API 키

    Returns:
        (EngageOutput, usage_dict)
    """
    client = make_client(api_key)

    # 영상 업로드 (캐시 재사용)
    uploaded = upload_video(video_path, client=client)

    # 프롬프트 생성
    prompt = _build_prompt(stt_output, scan_output, output_language)

    # Gemini 호출
    result, usage = await _call_gemini(client, uploaded, prompt)

    # 결과 저장
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "p09_engage.json"
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("P9 결과 저장: %s", out_path)

    return result, usage


async def _call_gemini(
    client, uploaded_file: types.File, prompt: str
) -> tuple[EngageOutput, dict]:
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
                    response_schema=EngageOutput,
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            return EngageOutput.model_validate(data), _extract_usage(response)
        except Exception as e:
            wait = 2**attempt * 5
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "P9 ENGAGE 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"P9 ENGAGE 실패 ({MAX_RETRIES}회 시도): {e}"
                ) from e
    # unreachable
    raise RuntimeError("P9 ENGAGE 실패")
