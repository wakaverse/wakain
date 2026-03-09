"""P2: SCAN — 제품 식별 + 메타 + 오디오 분석.

영상 전체를 gemini-2.5-flash-lite에 보내 첫인상 수준의
제품/메타/오디오 정보를 한 번에 식별한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client, upload_video
from core.schemas.pipeline import ScanOutput

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash-lite"

PROMPT_TEMPLATE = """Watch this video and identify:

1. Product: category (food/beauty/fashion/electronics/home/health/kids/pet/fnb/travel/education/finance/other),
   sub_category, name, brand, multi_product, is_marketing_video

2. Meta: platform (tiktok/reels/shorts/ad), duration, aspect_ratio,
   target_audience (1 sentence),
   product_exposure_pct (% of time product visible),
   product_first_appear (seconds),
   human_presence: {{has_face, type (presenter/model/narrator/none), face_exposure}}

3. Audio: music {{present, genre, energy_profile}},
   voice {{type (narration/dialogue/voiceover/tts/none), tone}},
   sfx {{used, types}}

## Language Rules
- Enum/key values: ALWAYS English (e.g., "food", "hook", "fomo")
- Product name & brand: Keep ORIGINAL as spoken/shown in video
- STT transcript references: Keep ORIGINAL language
- All descriptions, reasons, analyses, explanations: Write in {output_language}

Response (JSON only):"""

MAX_RETRIES = 3


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
    api_key: str | None = None,
    output_language: str = "ko",
) -> tuple[ScanOutput, dict]:
    """P2 SCAN 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 결과 저장 디렉토리
        api_key: Gemini API 키 (None이면 .env에서 로드)

    Returns:
        (ScanOutput, usage_dict)
    """
    client = make_client(api_key)

    # 영상 업로드 (동기 — File API는 async 미지원)
    uploaded = upload_video(video_path, client=client)

    # 프롬프트 생성
    prompt = PROMPT_TEMPLATE.format(output_language=output_language)

    # Gemini 호출 (async)
    result, usage = await _call_gemini(client, uploaded, prompt)

    # 결과 저장
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "p02_scan.json"
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("P2 결과 저장: %s", out_path)

    return result, usage


async def _call_gemini(client, uploaded_file: types.File, prompt: str) -> tuple[ScanOutput, dict]:
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
                    response_schema=ScanOutput,
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            return ScanOutput.model_validate(data), _extract_usage(response)
        except Exception as e:
            wait = 2**attempt * 5
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "P2 SCAN 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"P2 SCAN 실패 ({MAX_RETRIES}회 시도): {e}"
                ) from e
    # unreachable
    raise RuntimeError("P2 SCAN 실패")
