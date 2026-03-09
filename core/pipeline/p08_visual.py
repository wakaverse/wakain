"""P8: VISUAL — 씬별 영상 분석 (전체 맥락 유지).

영상 전체 + P3 씬 경계를 gemini-2.5-flash에 보내
씬별 style, style_sub, role, visual_forms, description을 분석한다.
전체 씬을 1콜로 분석.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from google.genai import types

from core.gemini_utils import make_client, upload_video
from core.schemas.pipeline import VisualOutput, VisualSceneAnalysis

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3


def _fmt_time(seconds: float) -> str:
    """초 → 'M:SS' 형식."""
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


def _build_scene_list(boundaries: list[list[float]]) -> str:
    """씬 경계를 프롬프트용 텍스트로 변환."""
    lines = []
    for i, (start, end) in enumerate(boundaries):
        lines.append(f"Scene {i}: {_fmt_time(start)}-{_fmt_time(end)}")
    return "\n".join(lines)


def _build_prompt(scene_text: str, output_language: str = "ko") -> str:
    """설계 문서 §4 P8 프롬프트 생성."""
    return f"""You are a visual analyst for shortform marketing videos.
Watch the FULL video for context.

## Scene Boundaries (from SceneDetect — use THESE, do NOT create your own):
{scene_text}

## IMPORTANT: "style" = the visual presentation technique of EACH scene, NOT the video's overall purpose.
Even in a promotional video, individual scenes use different techniques:
- Showing product features/specs → demo
- Closeup of texture, taste, ASMR → sensory
- Unboxing or comparing products → review
- Showing transformation or results → before_after
- Price, discount, limited offer → promotion
- Telling a narrative/story → story
A video can have 5+ different styles across its scenes. Do NOT assign the same style to all scenes.

## For EACH scene above, analyse:

1. style: demo / review / problem_solution / before_after / story / listicle / trend_ride / promotion / sensory

2. style_sub: (see subtypes per style)
   demo: spec_showcase / feature_demo / tutorial / other
   review: unboxing / comparison / user_review / expert_review / other
   problem_solution: pain_point / tip / other
   before_after: transformation / result_proof / other
   story: brand_film / vlog / mini_drama / other
   listicle: ranking / curated_picks / other
   trend_ride: challenge / meme / sound_ride / other
   promotion: time_deal / group_buy / coupon / other
   sensory: asmr / mukbang / texture / tasting / other

3. role: what this scene does in the video's narrative flow
   (hook / bridge / demo / proof / cta / summary / transition / etc)

4. visual_forms: what is being SHOWN (can be multiple)
   - product_shot: {{method: hero_shot/closeup/package/multi_angle/rotate, target: "..."}}
   - in_use: {{method: self_use/lifestyle/situation/gaming/typing, target: "..."}}
   - evidence: {{method: certification_badge/data_display/before_after/reaction, target: "..."}}
   - explanation: {{method: tech_visualization/text_overlay/infographic/comparison, target: "..."}}
   - mood: {{method: color_mood/sensory_stimulus/brand_world, target: "..."}}

5. description: 1 sentence in {output_language}

## Language Rules
- Enum/key values: ALWAYS English (e.g., "food", "hook", "fomo")
- Product name & brand: Keep ORIGINAL as spoken/shown in video
- STT transcript references: Keep ORIGINAL language
- All descriptions, reasons, analyses, explanations: Write in {output_language}

Response (JSON only):
{{
  "scenes": [
    {{"scene_index": 0, "time_range": [0, 4], "style": "...", "style_sub": "...", "role": "...", "visual_forms": [...], "description": "..."}}
  ]
}}"""


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
    scene_boundaries: list[list[float]],
    api_key: str | None = None,
    output_language: str = "ko",
) -> tuple[VisualOutput, dict]:
    """P8 VISUAL 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 결과 저장 디렉토리
        scene_boundaries: P3에서 추출한 씬 경계 [[start, end], ...]
        api_key: Gemini API 키 (None이면 .env에서 로드)

    Returns:
        (VisualOutput, usage_dict)
    """
    client = make_client(api_key)
    uploaded = upload_video(video_path, client=client)

    # 1콜로 전체 씬 분석 (Gemini 2.5 Flash 응답 길이 충분)
    all_scenes, usage = await _call_gemini(client, uploaded, scene_boundaries, output_language)

    result = VisualOutput(scenes=all_scenes)

    # 결과 저장
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "p08_visual.json"
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("P8 결과 저장: %s", out_path)

    return result, usage


async def _call_gemini(
    client,
    uploaded_file: types.File,
    boundaries: list[list[float]],
    output_language: str = "ko",
) -> tuple[list[VisualSceneAnalysis], dict]:
    """Gemini API 호출 + 재시도."""
    scene_text = _build_scene_list(boundaries)
    prompt = _build_prompt(scene_text, output_language)

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
                    response_schema=VisualOutput,
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            parsed = VisualOutput.model_validate(data)
            return parsed.scenes, _extract_usage(response)
        except Exception as e:
            wait = 2**attempt * 5
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "P8 VISUAL 재시도 %d/%d (%s), %ds 대기...",
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"P8 VISUAL 실패 ({MAX_RETRIES}회 시도): {e}"
                ) from e
    # unreachable
    raise RuntimeError("P8 VISUAL 실패")
