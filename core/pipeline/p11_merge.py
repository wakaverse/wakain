"""P11: MERGE — 씬 병합 + 스타일 산출 (로컬 전용, API 호출 없음).

P6(씬 집계) + P8(영상 분석) + P10(대본 블록)을 병합.
R1에서는 P8/P10이 없으므로 Optional 처리.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from core.schemas.pipeline import (
    BlockSceneMapping,
    MergedScene,
    MergeOutput,
    P6Output,
    ScriptOutput,
    VisualOutput,
)

logger = logging.getLogger(__name__)


def _overlaps(a_range: list[float], b_range: list[float]) -> bool:
    """두 시간 구간이 겹치는지 판정."""
    return a_range[0] < b_range[1] and b_range[0] < a_range[1]


async def run(
    p6_output: P6Output,
    visual_output: VisualOutput | None = None,
    script_output: ScriptOutput | None = None,
) -> MergeOutput:
    """P11 실행: P6 + P8(optional) + P10(optional) → MergeOutput.

    Args:
        p6_output: P6 씬 집계 결과
        visual_output: P8 영상 분석 결과 (R1에서는 None)
        script_output: P10 대본 블록 결과 (R1에서는 None)

    Returns:
        MergeOutput
    """
    logger.info("P11 MERGE 시작: %d scenes", len(p6_output.scenes))

    # P8 씬 분석을 scene_index 기반으로 매핑
    visual_map: dict[int, object] = {}
    if visual_output:
        for vs in visual_output.scenes:
            visual_map[vs.scene_index] = vs

    # 병합된 씬 생성
    merged_scenes: list[MergedScene] = []
    for scene in p6_output.scenes:
        # P8 데이터 병합
        style = scene.style
        style_sub = scene.style_sub
        role = scene.role
        visual_forms = scene.visual_forms
        description = scene.description

        vs = visual_map.get(scene.scene_id)
        if vs:
            style = vs.style.value if hasattr(vs.style, "value") else str(vs.style)
            style_sub = vs.style_sub
            role = vs.role
            visual_forms = [vf.model_dump() for vf in vs.visual_forms] if vs.visual_forms else []
            description = vs.description

        # P10 블록-씬 매핑 (씬 → matched_blocks)
        matched_blocks: list[str] = []
        if script_output:
            for block in script_output.blocks:
                if _overlaps(scene.time_range, block.time_range):
                    matched_blocks.append(block.block.value if hasattr(block.block, "value") else str(block.block))

        merged_scenes.append(
            MergedScene(
                scene_id=scene.scene_id,
                time_range=scene.time_range,
                duration=scene.duration,
                frame_count=scene.frame_count,
                production=scene.production,
                style=style,
                style_sub=style_sub,
                role=role,
                visual_forms=visual_forms,
                description=description,
                matched_blocks=matched_blocks,
            )
        )

    # style_distribution 산출
    style_distribution: dict[str, float] = {}
    style_primary: str | None = None
    style_secondary: str | None = None

    total_duration = sum(s.duration for s in merged_scenes)
    if total_duration > 0:
        style_durations: dict[str, float] = {}
        for s in merged_scenes:
            if s.style:
                style_durations[s.style] = style_durations.get(s.style, 0.0) + s.duration

        if style_durations:
            style_distribution = {
                k: round(v / total_duration, 4) for k, v in style_durations.items()
            }
            sorted_styles = sorted(style_distribution.items(), key=lambda x: x[1], reverse=True)
            style_primary = sorted_styles[0][0]
            if len(sorted_styles) > 1:
                style_secondary = sorted_styles[1][0]

    # block_scene_mapping (블록 → matched_scenes)
    block_scene_mapping: list[BlockSceneMapping] = []
    if script_output:
        for idx, block in enumerate(script_output.blocks):
            matched_scene_ids = [
                s.scene_id for s in merged_scenes
                if _overlaps(block.time_range, s.time_range)
            ]
            block_scene_mapping.append(
                BlockSceneMapping(
                    block_index=idx,
                    block_type=block.block,
                    matched_scenes=matched_scene_ids,
                )
            )

    result = MergeOutput(
        scenes=merged_scenes,
        style_distribution=style_distribution,
        style_primary=style_primary,
        style_secondary=style_secondary,
        block_scene_mapping=block_scene_mapping,
    )

    logger.info(
        "P11 MERGE 완료: %d scenes, style_primary=%s",
        len(merged_scenes),
        style_primary,
    )
    return result


async def run_and_save(
    p6_output: P6Output,
    visual_output: VisualOutput | None = None,
    script_output: ScriptOutput | None = None,
    output_dir: Path | str | None = None,
) -> MergeOutput:
    """run() 실행 후 결과를 JSON 파일로 저장."""
    result = await run(p6_output, visual_output, script_output)
    if output_dir:
        out_path = Path(output_dir) / "p11_merge.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(result.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("P11 saved to %s", out_path)
    return result
