"""P7: PRODUCT — 제품 특징(claims) 추출.

영상 전체 + P1 STT 결과를 gemini-2.5-flash에 보내
제품 특징만 추출한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client, upload_video
from core.schemas.pipeline import ProductOutput, ScanOutput, STTOutput

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3

PROMPT_TEMPLATE = """You are a product feature analyst for shortform marketing videos.

## Video Context
- Product: {product_name} ({product_brand})
- Category: {category} > {sub_category}
- Narration type: {narration_type}

{stt_transcript}

## Task: Extract ALL product features/claims mentioned or shown.

Classify each by consumer question:
- composition: "뭐가 들었어?" (스펙, 성분, 소재)
- function: "뭘 해주는데?" (기능, 효능, 편의성)
- experience: "써보면 어때?" (감각, 사용감, 결과)
- trust: "믿을 수 있어?" (인증, 수상, 보증)
- value: "얼마야?" (가격, 할인, 혜택)

{language_rules}

Tag objectivity layer:
- fact: 객관적 사실, 검증 가능
- function: 제품이 하는 것
- experience: 사용자가 느끼는 것

Response (JSON only):"""


LANGUAGE_RULES_TEMPLATE = """## Language Rules
- Enum/key values: ALWAYS English (e.g., "food", "hook", "fomo")
- Product name & brand: Keep ORIGINAL as spoken/shown in video
- STT transcript references: Keep ORIGINAL language
- All descriptions, reasons, analyses, explanations: Write in {output_language}"""


def _build_prompt(
    stt_output: STTOutput | None,
    scan_output: ScanOutput | None,
    output_language: str = "ko",
) -> str:
    """P1/P2 결과를 프롬프트에 동적 삽입."""
    product_name = "unknown"
    product_brand = "unknown"
    category = "other"
    sub_category = "other"
    narration_type = "none"
    stt_transcript = ""

    if scan_output:
        product_name = scan_output.product.name or "unknown"
        product_brand = scan_output.product.brand or "unknown"
        category = scan_output.product.category
        sub_category = scan_output.product.sub_category

    if stt_output:
        narration_type = stt_output.narration_type
        stt_transcript = stt_output.full_text

    language_rules = LANGUAGE_RULES_TEMPLATE.format(output_language=output_language)
    return PROMPT_TEMPLATE.format(
        product_name=product_name,
        product_brand=product_brand,
        category=category,
        sub_category=sub_category,
        narration_type=narration_type,
        stt_transcript=stt_transcript,
        language_rules=language_rules,
    )


async def run(
    video_path: str,
    output_dir: str,
    stt_output: STTOutput | None = None,
    scan_output: ScanOutput | None = None,
    api_key: str | None = None,
    output_language: str = "ko",
) -> ProductOutput:
    """P7 PRODUCT 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 결과 저장 디렉토리
        stt_output: P1 STT 결과 (프롬프트 삽입용)
        scan_output: P2 SCAN 결과 (프롬프트 삽입용)
        api_key: Gemini API 키

    Returns:
        ProductOutput
    """
    client = make_client(api_key)

    # 영상 업로드 (캐시 재사용)
    uploaded = upload_video(video_path, client=client)

    # 프롬프트 생성
    prompt = _build_prompt(stt_output, scan_output, output_language)

    # Gemini 호출
    result = await _call_gemini(client, uploaded, prompt)

    # 결과 저장
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "p07_product.json"
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("P7 결과 저장: %s", out_path)

    return result


async def _call_gemini(
    client, uploaded_file: types.File, prompt: str
) -> ProductOutput:
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
                    response_schema=ProductOutput,
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            return ProductOutput.model_validate(data)
        except Exception as e:
            wait = 2**attempt * 5
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "P7 PRODUCT 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"P7 PRODUCT 실패 ({MAX_RETRIES}회 시도): {e}"
                ) from e
    # unreachable
    raise RuntimeError("P7 PRODUCT 실패")
