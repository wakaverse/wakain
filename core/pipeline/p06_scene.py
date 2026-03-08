"""P6: SCENE — 씬별 집계 (로컬 전용, API 호출 없음).

P3(EXTRACT)의 씬 경계 + P4(CLASSIFY)의 프레임 정성 데이터를 씬별로 집계.
P4 없이도 동작 (기본값 폴백).
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path

from core.schemas.enums import ColorTone, ShotType, TextUsage
from core.schemas.pipeline import (
    ClassifyOutput,
    ExtractOutput,
    P6Output,
    SceneOutput,
    SceneProduction,
)

logger = logging.getLogger(__name__)

# P4 없을 때 기본값
_DEFAULT_PRODUCTION = SceneProduction(
    dominant_shot_type=ShotType.MEDIUM,
    dominant_color_tone=ColorTone.NEUTRAL,
    text_usage=TextUsage.NONE,
)


def _majority(values: list[str]) -> str:
    """리스트에서 최빈값 반환."""
    return Counter(values).most_common(1)[0][0]


def _frame_in_scene(timestamp: float, start: float, end: float) -> bool:
    """프레임이 씬 구간 [start, end)에 속하는지 확인."""
    return start <= timestamp < end


async def run(
    extract_output: ExtractOutput,
    classify_output: ClassifyOutput | None = None,
) -> P6Output:
    """P3 씬 경계 + P4 정성 데이터 → 씬별 집계.

    Args:
        extract_output: P3 결과
        classify_output: P4 결과 (Optional, R1에서는 None)

    Returns:
        P6Output (scenes 리스트)
    """
    boundaries = extract_output.scene_boundaries
    p3_frames = extract_output.frames

    # P4 프레임을 timestamp 기반으로 빠르게 조회하기 위해 dict 구성
    p4_frame_map: dict[float, object] = {}
    if classify_output:
        for f in classify_output.frames:
            p4_frame_map[f.timestamp] = f

    scenes: list[SceneOutput] = []

    for idx, boundary in enumerate(boundaries):
        start, end = boundary[0], boundary[1]
        duration = round(end - start, 3)

        # P3 프레임 중 이 씬에 속하는 것들
        scene_frames = [
            f for f in p3_frames if _frame_in_scene(f.timestamp, start, end)
        ]
        frame_count = len(scene_frames)

        # P4 정성 집계
        if classify_output and p4_frame_map:
            scene_p4 = [
                p4_frame_map[f.timestamp]
                for f in scene_frames
                if f.timestamp in p4_frame_map
            ]
            if scene_p4:
                production = SceneProduction(
                    dominant_shot_type=ShotType(_majority([f.shot_type for f in scene_p4])),
                    dominant_color_tone=ColorTone(_majority([f.color_tone for f in scene_p4])),
                    text_usage=TextUsage(_majority([f.text_usage for f in scene_p4])),
                )
            else:
                production = _DEFAULT_PRODUCTION
        else:
            production = _DEFAULT_PRODUCTION

        scenes.append(
            SceneOutput(
                scene_id=idx,
                time_range=[start, end],
                duration=duration,
                frame_count=frame_count,
                production=production,
            )
        )

    logger.info("P6 SCENE: %d scenes aggregated", len(scenes))
    return P6Output(scenes=scenes)


async def run_and_save(
    extract_output: ExtractOutput,
    classify_output: ClassifyOutput | None = None,
    output_dir: Path | str | None = None,
) -> P6Output:
    """run() 실행 후 결과를 JSON 파일로 저장."""
    result = await run(extract_output, classify_output)
    if output_dir:
        out_path = Path(output_dir) / "p06_scene.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(result.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("P6 saved to %s", out_path)
    return result
