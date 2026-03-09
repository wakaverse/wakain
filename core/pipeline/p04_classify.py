"""P4: CLASSIFY — 프레임 정성 분류.

P3에서 추출한 프레임 JPEG를 8장씩 배치로 Gemini Flash-Lite에 전송하여
7필드 정성 분류를 수행한다.

필드: shot_type, color_tone, text_usage, has_text, has_product, has_person
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client
from core.schemas.pipeline import ClassifyFrame, ClassifyOutput

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash-lite"
BATCH_SIZE = 8
BATCH_DELAY = 1.0  # 배치 간 딜레이 (초)
MAX_RETRIES = 2

PROMPT = """\
Classify each frame. Return JSON array.

Per frame:
- timestamp: float
- shot_type: closeup(>60%) / medium(30-60%) / wide(<30%) / overhead / pov
- color_tone: warm / cool / neutral / high_contrast / pastel
- text_usage: heavy / moderate / minimal / none
- has_text: true/false
- has_product: true/false
- has_person: true/false
"""

# response_schema용 배열 스키마
_RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "timestamp": {"type": "NUMBER"},
            "shot_type": {
                "type": "STRING",
                "enum": ["closeup", "medium", "wide", "overhead", "pov"],
            },
            "color_tone": {
                "type": "STRING",
                "enum": ["warm", "cool", "neutral", "high_contrast", "pastel"],
            },
            "text_usage": {
                "type": "STRING",
                "enum": ["heavy", "moderate", "minimal", "none"],
            },
            "has_text": {"type": "BOOLEAN"},
            "has_product": {"type": "BOOLEAN"},
            "has_person": {"type": "BOOLEAN"},
        },
        "required": [
            "timestamp",
            "shot_type",
            "color_tone",
            "text_usage",
            "has_text",
            "has_product",
            "has_person",
        ],
    },
}


def _extract_usage(response) -> dict:
    """Gemini response에서 usage_metadata 추출."""
    usage = {"input_tokens": 0, "output_tokens": 0, "model": MODEL}
    meta = getattr(response, "usage_metadata", None)
    if meta:
        usage["input_tokens"] = getattr(meta, "prompt_token_count", 0) or 0
        usage["output_tokens"] = getattr(meta, "candidates_token_count", 0) or 0
    return usage


async def _classify_batch(
    client,
    batch: list[tuple[float, bytes]],
) -> tuple[list[ClassifyFrame], dict]:
    """단일 배치 (최대 8장) 분류."""
    # 이미지 파트 + 프롬프트 구성
    contents: list[types.Part] = []
    for _ts, jpeg_bytes in batch:
        contents.append(types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"))
    contents.append(types.Part.from_text(text=PROMPT))

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_RESPONSE_SCHEMA,
                    temperature=0.1,
                ),
            )
            items = json.loads(response.text)

            # timestamp를 실제 값으로 덮어쓰기
            frames = []
            for i, item in enumerate(items):
                if i < len(batch):
                    item["timestamp"] = batch[i][0]
                frames.append(ClassifyFrame.model_validate(item))
            return frames, _extract_usage(response)

        except Exception as e:
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt * 3
                logger.warning(
                    "배치 분류 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"배치 분류 실패 (timestamps={[t for t, _ in batch]}): {e}"
                ) from e


async def run(
    frames_dir: str,
    timestamps: list[float],
    api_key: str | None = None,
) -> tuple[ClassifyOutput, dict]:
    """P4 CLASSIFY 실행.

    Args:
        frames_dir: P3이 저장한 프레임 디렉토리 (output/{name}/frames/)
        timestamps: 프레임 타임스탬프 리스트 (P3 ExtractOutput.frames에서 추출)
        api_key: Gemini API 키

    Returns:
        (ClassifyOutput, usage_dict)
    """
    frames_path = Path(frames_dir)
    client = make_client(api_key)

    # 프레임 로드: (timestamp, jpeg_bytes)
    frame_data: list[tuple[float, bytes]] = []
    for ts in timestamps:
        filename = f"frame_{ts:.1f}.jpg"
        filepath = frames_path / filename
        if not filepath.exists():
            logger.warning("프레임 파일 없음: %s", filepath)
            continue
        frame_data.append((ts, filepath.read_bytes()))

    logger.info("P4 CLASSIFY: %d 프레임 로드, %d 배치", len(frame_data), -(-len(frame_data) // BATCH_SIZE))

    # 배치 분할 및 순차 처리 (usage 누적)
    all_frames: list[ClassifyFrame] = []
    total_input = 0
    total_output = 0
    for i in range(0, len(frame_data), BATCH_SIZE):
        batch = frame_data[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = -(-len(frame_data) // BATCH_SIZE)
        logger.info("  배치 %d/%d (%d장)...", batch_num, total_batches, len(batch))

        result, batch_usage = await _classify_batch(client, batch)
        all_frames.extend(result)
        total_input += batch_usage.get("input_tokens", 0)
        total_output += batch_usage.get("output_tokens", 0)

        # 마지막 배치가 아니면 딜레이
        if i + BATCH_SIZE < len(frame_data):
            await asyncio.sleep(BATCH_DELAY)

    # timestamp 순 정렬
    all_frames.sort(key=lambda f: f.timestamp)
    logger.info("P4 CLASSIFY 완료: %d 프레임 분류", len(all_frames))

    usage = {"input_tokens": total_input, "output_tokens": total_output, "model": MODEL}
    return ClassifyOutput(frames=all_frames), usage
