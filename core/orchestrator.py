"""WakaLab V2 Orchestrator — 12 Phase 실행 관리.

의존 관계에 따라 병렬/순차 실행:
병렬①: P1(STT) + P2(SCAN) + P3(EXTRACT)
병렬②: P4(CLASSIFY) + P7(PRODUCT) + P8(VISUAL) + P9(ENGAGE)
순차: P5(TEMPORAL) ← P3
순차: P6(SCENE) ← P3 + P4
순차: P10(SCRIPT) ← P1 + P2 + P7
순차: P11(MERGE) ← P6 + P8 + P10
순차: P12(BUILD) ← 전체
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from core.pipeline import (
    p01_stt,
    p02_scan,
    p03_extract,
    p04_classify,
    p05_temporal,
    p06_scene,
    p07_product,
    p08_visual,
    p09_engage,
    p10_script,
    p11_merge,
    p12_build,
)
from core.schemas.recipe import RecipeJSON

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    video_path: str
    output_dir: str
    fps: int = 1
    gemini_api_key: str | None = None
    gemini_api_key_pro: str | None = None
    soniox_api_key: str | None = None
    output_language: str = "ko"


@dataclass
class PipelineResult:
    recipe: RecipeJSON
    phase_results: dict[str, Any] = field(default_factory=dict)
    phase_times: dict[str, float] = field(default_factory=dict)
    total_time: float = 0.0


async def _run_phase(name: str, coro, phase_results: dict, phase_times: dict) -> Any:
    """Phase 실행 래퍼: 타이밍 기록 + 에러 핸들링."""
    logger.info("▶ %s 시작", name)
    t0 = time.perf_counter()
    try:
        result = await coro
        elapsed = round(time.perf_counter() - t0, 2)
        phase_results[name] = result
        phase_times[name] = elapsed
        logger.info("✔ %s 완료 (%.2fs)", name, elapsed)
        return result
    except Exception:
        elapsed = round(time.perf_counter() - t0, 2)
        phase_times[name] = elapsed
        phase_results[name] = None
        logger.exception("✘ %s 실패 (%.2fs)", name, elapsed)
        return None


def _save_phase_output(output_dir: str, filename: str, data) -> None:
    """Phase 산출물 JSON 저장."""
    if data is None:
        return
    path = Path(output_dir) / filename
    if hasattr(data, "model_dump_json"):
        path.write_text(data.model_dump_json(indent=2), encoding="utf-8")
    elif hasattr(data, "model_dump"):
        path.write_text(
            json.dumps(data.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    logger.info("  💾 %s saved", filename)


# ── Pipeline 실행 ─────────────────────────────────────────────────────────


async def run_pipeline(config: PipelineConfig) -> PipelineResult:
    """전체 파이프라인 실행."""
    # dotenv 로드
    load_dotenv()

    logger.info("=" * 60)
    logger.info("Pipeline 시작: %s", config.video_path)
    logger.info("=" * 60)

    t_start = time.perf_counter()
    output_dir = config.output_dir
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    phase_results: dict[str, Any] = {}
    phase_times: dict[str, float] = {}

    video_path = config.video_path

    # ── 병렬① : P1(STT) + P2(SCAN) + P3(EXTRACT) ──────────────────────────
    p1_result, p2_result, p3_result = await asyncio.gather(
        _run_phase(
            "P1_STT",
            p01_stt.run(video_path, output_dir, api_key=config.soniox_api_key),
            phase_results, phase_times,
        ),
        _run_phase(
            "P2_SCAN",
            p02_scan.run(video_path, output_dir, api_key=config.gemini_api_key, output_language=config.output_language),
            phase_results, phase_times,
        ),
        _run_phase(
            "P3_EXTRACT",
            p03_extract.run(video_path, output_dir, config.fps),
            phase_results, phase_times,
        ),
    )

    # ── 병렬② : P4 + P7 + P8 + P9 (P1,P3 완료 후) ─────────────────────────
    # P4: frames_dir + timestamps from P3
    # P7: video + P1 STT + P2 SCAN
    # P8: video + P3 scene_boundaries
    # P9: video + P1 STT + P2 SCAN
    frames_dir = str(Path(output_dir) / "frames")
    timestamps = [f.timestamp for f in p3_result.frames] if p3_result else []
    scene_boundaries = p3_result.scene_boundaries if p3_result else []

    p4_result, p7_result, p8_result, p9_result = await asyncio.gather(
        _run_phase(
            "P4_CLASSIFY",
            p04_classify.run(frames_dir, timestamps, api_key=config.gemini_api_key),
            phase_results, phase_times,
        ),
        _run_phase(
            "P7_PRODUCT",
            p07_product.run(
                video_path, output_dir,
                stt_output=p1_result, scan_output=p2_result,
                api_key=config.gemini_api_key,
                output_language=config.output_language,
            ),
            phase_results, phase_times,
        ),
        _run_phase(
            "P8_VISUAL",
            p08_visual.run(
                video_path, output_dir,
                scene_boundaries=scene_boundaries,
                api_key=config.gemini_api_key,
                output_language=config.output_language,
            ),
            phase_results, phase_times,
        ),
        _run_phase(
            "P9_ENGAGE",
            p09_engage.run(
                video_path, output_dir,
                stt_output=p1_result, scan_output=p2_result,
                api_key=config.gemini_api_key,
                output_language=config.output_language,
            ),
            phase_results, phase_times,
        ),
    )

    # ── 순차 : P5(TEMPORAL) ← P3 ──────────────────────────────────────────
    p5_result = None
    if p3_result:
        p5_result = await _run_phase(
            "P5_TEMPORAL",
            p05_temporal.run(p3_result),
            phase_results, phase_times,
        )
    else:
        logger.warning("P3 실패 → P5 건너뜀")
        phase_results["P5_TEMPORAL"] = None

    # ── 순차 : P6(SCENE) ← P3 + P4 ────────────────────────────────────────
    p6_result = None
    if p3_result:
        p6_result = await _run_phase(
            "P6_SCENE",
            p06_scene.run(p3_result, p4_result),
            phase_results, phase_times,
        )
    else:
        logger.warning("P3 실패 → P6 건너뜀")
        phase_results["P6_SCENE"] = None

    # ── 순차 : P10(SCRIPT) ← P1 + P2 + P7 ─────────────────────────────────
    p10_result = await _run_phase(
        "P10_SCRIPT",
        p10_script.run(
            video_path, output_dir,
            stt_output=p1_result, scan_output=p2_result,
            product_output=p7_result,
            api_key=config.gemini_api_key,
            output_language=config.output_language,
        ),
        phase_results, phase_times,
    )

    # ── 순차 : P11(MERGE) ← P6 + P8 + P10 ─────────────────────────────────
    p11_result = None
    if p6_result:
        p11_result = await _run_phase(
            "P11_MERGE",
            p11_merge.run(p6_result, p8_result, p10_result),
            phase_results, phase_times,
        )
        _save_phase_output(output_dir, "p11_merge.json", p11_result)
    else:
        logger.warning("P6 없음 → P11 건너뜀")
        phase_results["P11_MERGE"] = None

    # ── 순차 : P12(BUILD) → RecipeJSON ─────────────────────────────────────
    recipe = await _run_phase(
        "P12_BUILD",
        p12_build.run(
            p5_output=p5_result,
            p6_output=p6_result,
            p11_output=p11_result,
            p1_output=p1_result,
            p2_output=p2_result,
            p7_output=p7_result,
            p9_output=p9_result,
            p10_output=p10_result,
            output_language=config.output_language,
        ),
        phase_results, phase_times,
    )

    # RecipeJSON 저장
    if recipe:
        recipe_path = Path(output_dir) / "recipe.json"
        recipe_path.write_text(recipe.model_dump_json(indent=2), encoding="utf-8")
        logger.info("Recipe saved → %s", recipe_path)

    total_time = round(time.perf_counter() - t_start, 2)

    logger.info("=" * 60)
    logger.info("Pipeline 완료: %.2fs", total_time)
    for name, elapsed in phase_times.items():
        logger.info("  %s: %.2fs", name, elapsed)
    logger.info("=" * 60)

    return PipelineResult(
        recipe=recipe,
        phase_results=phase_results,
        phase_times=phase_times,
        total_time=total_time,
    )
