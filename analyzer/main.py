"""CLI entry point — runs the full video analysis pipeline.

Usage:
    python main.py analyze <video_path> [--output <dir>] [--phase <N>]
    python main.py compare <output_dir1> <output_dir2> ... [--labels success failure ...]
    python main.py report <recipe_path> [--format markdown|telegram|summary]

    # analyze 서브커맨드 생략 가능 (하위 호환성 유지)
    python main.py <video_path> [--output <dir>] [--phase <N>]

Full pipeline: Phase 1 (quant) → Phase 2 (qual) → Phase 2.5 (temporal) →
               Phase 3 (scene aggregate, local) → Phase 4 (video analysis) →
               Phase 5 (scene merge, local) → Phase 6 (recipe build)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from src.stt_extractor import run_stt_extraction, STTResult
from src.product_scanner import scan_product, ProductScanResult
from src.caption_mapper import build_caption_map, caption_map_to_dict
from src.integrated_analyzer import run_integrated_analysis
from src.prescription_engine import generate_prescriptions
from src.marketer_judge import run_marketer_judge
from src.frame_extractor import extract_frames
from src.frame_quant import analyse_frame as analyse_frame_quant
from src.frame_qual import analyse_frames_qual
from src.temporal_analyzer import run_temporal_analysis
from src.scene_aggregator import aggregate_scenes
from src.scene_merger import merge_analysis
from src.video_analyzer import run_video_analysis
from src.recipe_builder import build_recipe
from src.schemas import FrameAnalysis, FrameQual, FrameQuant, Scene, TemporalAnalysis


def _resolve_output_dir(output_base: str, video_path: str) -> Path:
    """Resolve output directory: output/<video_name>/

    Guards against double-nesting: if output_base already ends with video_name,
    don't append it again (e.g. output/sample2 + sample2 → output/sample2, not output/sample2/sample2).
    """
    video_name = Path(video_path).stem
    base = Path(output_base)
    if base.name == video_name:
        out = base
    else:
        out = base / video_name
    out.mkdir(parents=True, exist_ok=True)
    return out, video_name


def run_phase_1_2(video_path: str, output_dir: str, quant_only: bool, resolution: int = 720) -> None:
    """Run Phase 1 (frame_quant) + Phase 2 (frame_qual)."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # ── Phase 0: Frame extraction ────────────────────────────────────────
    print(f"[Phase 0] Extracting frames at 2fps from {video_path} ({resolution}p) ...")
    t0 = time.perf_counter()
    frames = extract_frames(video_path, max_dimension=resolution)
    print(f"          → {len(frames)} frames extracted ({time.perf_counter() - t0:.1f}s)")

    if not frames:
        print("No frames extracted. Check the video file.")
        sys.exit(1)

    # ── Phase 1: frame_quant (OpenCV) ────────────────────────────────────
    print(f"[Phase 1] Running frame_quant (OpenCV) ...")
    t0 = time.perf_counter()
    quants = []
    for i, frame in enumerate(frames):
        prev_bgr = frames[i - 1].image if i > 0 else None
        q = analyse_frame_quant(frame.image, frame.timestamp, prev_bgr)
        quants.append(q)
    print(f"          → done ({time.perf_counter() - t0:.1f}s)")

    # Save quant results
    quant_path = out / f"{video_name}_frame_quant.json"
    quant_data = [q.model_dump() for q in quants]
    quant_path.write_text(json.dumps(quant_data, indent=2, ensure_ascii=False))
    print(f"          → saved to {quant_path}")

    if quant_only:
        print("Quant-only mode. Skipping Phase 2.")
        return

    # ── Phase 2: frame_qual (Gemini Flash) ───────────────────────────────
    print(f"[Phase 2] Running frame_qual (Gemini 2.0 Flash) ...")
    t0 = time.perf_counter()
    jpeg_frames = [(f.timestamp, f.jpeg_bytes) for f in frames]

    quals = asyncio.run(analyse_frames_qual(jpeg_frames, quants))
    print(f"          → done ({time.perf_counter() - t0:.1f}s)")

    # Save qual results
    qual_path = out / f"{video_name}_frame_qual.json"
    qual_data = [q.model_dump() for q in quals]
    qual_path.write_text(json.dumps(qual_data, indent=2, ensure_ascii=False))
    print(f"          → saved to {qual_path}")

    # Save combined results
    combined = [
        FrameAnalysis(quant=q, qual=ql).model_dump()
        for q, ql in zip(quants, quals)
    ]
    combined_path = out / f"{video_name}_frames.json"
    combined_path.write_text(json.dumps(combined, indent=2, ensure_ascii=False))
    print(f"          → combined saved to {combined_path}")


def run_phase_2_5(output_dir: str, video_path: str) -> TemporalAnalysis:
    """Run Phase 2.5: temporal analysis on existing frame data (no API calls)."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    quant_path = out / f"{video_name}_frame_quant.json"
    qual_path = out / f"{video_name}_frame_qual.json"

    quants = [FrameQuant.model_validate(d) for d in json.loads(quant_path.read_text())]
    quals = [FrameQual.model_validate(d) for d in json.loads(qual_path.read_text())]

    # Load SceneDetect cut_timestamps if available
    sd_cut_timestamps = None
    sd_path = out / f"{video_name}_scene_detect.json"
    if sd_path.exists():
        sd_data = json.loads(sd_path.read_text())
        sd_cut_timestamps = sd_data.get("cut_timestamps")
        if sd_cut_timestamps:
            print(f"[Phase 2.5] Using SceneDetect cuts: {len(sd_cut_timestamps)} cuts")

    print(f"[Phase 2.5] Running temporal analysis (local, no API) ...")
    t0 = time.perf_counter()
    temporal = run_temporal_analysis(quants, quals, cut_timestamps=sd_cut_timestamps)
    elapsed = time.perf_counter() - t0
    print(f"            → done ({elapsed:.1f}s)")
    print(f"            → attention: {temporal.attention_curve.attention_arc}, "
          f"cuts: {temporal.cut_rhythm.total_cuts}, "
          f"transitions: {temporal.transition_texture.dominant_type}")

    # Save temporal analysis
    temporal_path = out / f"{video_name}_temporal.json"
    temporal_path.write_text(
        json.dumps(temporal.model_dump(), indent=2, ensure_ascii=False)
    )
    print(f"            → saved to {temporal_path}")

    return temporal


def run_phase_3(
    output_dir: str,
    video_path: str,
    temporal: TemporalAnalysis | None = None,
) -> list[Scene]:
    """Run Phase 3: scene aggregator — pure local, no API calls."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # Load frame data
    quant_path = out / f"{video_name}_frame_quant.json"
    qual_path = out / f"{video_name}_frame_qual.json"
    quants = [FrameQuant.model_validate(d) for d in json.loads(quant_path.read_text())]
    quals = [FrameQual.model_validate(d) for d in json.loads(qual_path.read_text())]

    # Load temporal if not provided but exists on disk
    if temporal is None:
        temporal_path = out / f"{video_name}_temporal.json"
        if temporal_path.exists():
            temporal = TemporalAnalysis.model_validate(
                json.loads(temporal_path.read_text())
            )

    # Load PySceneDetect boundaries if available
    scene_boundaries = None
    sd_path = out / f"{video_name}_scene_detect.json"
    if sd_path.exists():
        sd_data = json.loads(sd_path.read_text())
        scene_boundaries = [tuple(b) for b in sd_data.get("boundaries", [])]

    print(f"[Phase 3] Running scene aggregator (local, no API) ...")
    t0 = time.perf_counter()
    scenes = aggregate_scenes(quants, quals, temporal=temporal, scene_boundaries=scene_boundaries)
    print(f"          → {len(scenes)} scenes aggregated ({time.perf_counter() - t0:.1f}s)")

    # Save aggregated scenes
    scenes_path = out / f"{video_name}_scenes.json"
    scenes_data = [s.model_dump() for s in scenes]
    scenes_path.write_text(json.dumps(scenes_data, indent=2, ensure_ascii=False))
    print(f"          → saved to {scenes_path}")

    return scenes


def run_phase_4(
    video_path: str,
    output_dir: str,
    resolution: int = 720,
    frame_quals: list[dict] | None = None,
    narration_type: str | None = None,
    stt_transcript: str | None = None,
    product_scan: dict | None = None,
) -> dict:
    """Run Phase 4: full video analysis via Gemini."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    track_label = f", track={narration_type}" if narration_type else ""
    cat_label = ""
    if product_scan:
        cat_label = f", category={product_scan.get('category', '?')}"
    print(f"[Phase 4] Running video analysis (Gemini, full video upload, {resolution}p{track_label}{cat_label}) ...")
    if frame_quals:
        text_count = sum(1 for fq in frame_quals if fq.get("text_overlay") or fq.get("text_overlays"))
        print(f"          (OCR context: {text_count}/{len(frame_quals)} frames with text)")
    t0 = time.perf_counter()
    analysis = run_video_analysis(
        video_path, resolution=resolution, frame_quals=frame_quals,
        narration_type=narration_type, stt_transcript=stt_transcript,
        product_scan=product_scan,
    )
    print(f"          → done ({time.perf_counter() - t0:.1f}s)")

    # Save analysis
    analysis_path = out / f"{video_name}_video_analysis.json"
    analysis_path.write_text(json.dumps(analysis, indent=2, ensure_ascii=False))
    print(f"          → saved to {analysis_path}")

    return analysis


def run_phase_5(
    output_dir: str,
    video_path: str,
    scenes: list[Scene] | None = None,
    video_analysis: dict | None = None,
) -> list[Scene]:
    """Run Phase 5: merge Phase 3 aggregated scenes + Phase 4 video analysis (local)."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # Load aggregated scenes if not provided
    if scenes is None:
        scenes_path = out / f"{video_name}_scenes.json"
        scenes_data = json.loads(scenes_path.read_text())
        scenes = [Scene.model_validate(s) for s in scenes_data]

    # Load video analysis if not provided
    if video_analysis is None:
        analysis_path = out / f"{video_name}_video_analysis.json"
        video_analysis = json.loads(analysis_path.read_text())

    # Load PySceneDetect boundaries if available
    scene_boundaries = None
    sd_path = out / f"{video_name}_scene_detect.json"
    if sd_path.exists():
        sd_data = json.loads(sd_path.read_text())
        scene_boundaries = [tuple(b) for b in sd_data.get("boundaries", [])]

    print(f"[Phase 5] Merging scene data + video analysis (local, no API) ...")
    t0 = time.perf_counter()
    merged_scenes = merge_analysis(scenes, video_analysis, scene_boundaries=scene_boundaries)
    print(f"          → {len(merged_scenes)} scenes merged ({time.perf_counter() - t0:.1f}s)")

    # Save merged scenes (overwrites Phase 3 output with enriched data)
    scenes_path = out / f"{video_name}_scenes.json"
    scenes_data = [s.model_dump() for s in merged_scenes]
    scenes_path.write_text(json.dumps(scenes_data, indent=2, ensure_ascii=False))
    print(f"          → saved to {scenes_path}")

    return merged_scenes


def run_phase_6(
    output_dir: str,
    video_path: str,
    scenes: list[Scene] | None = None,
    video_analysis: dict | None = None,
    temporal: TemporalAnalysis | None = None,
    product_data: dict | None = None,
) -> None:
    """Run Phase 6: recipe builder — merge Track 1 + Track 2 + temporal."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # Load scenes if not provided
    if scenes is None:
        scenes_path = out / f"{video_name}_scenes.json"
        scenes_data = json.loads(scenes_path.read_text())
        scenes = [Scene.model_validate(s) for s in scenes_data]

    # Load video analysis if not provided
    if video_analysis is None:
        analysis_path = out / f"{video_name}_video_analysis.json"
        video_analysis = json.loads(analysis_path.read_text())

    # Load frame_quant and frame_qual for accurate aggregation
    quants = None
    quals = None
    quant_path = out / f"{video_name}_frame_quant.json"
    qual_path = out / f"{video_name}_frame_qual.json"
    if quant_path.exists():
        quants = [FrameQuant.model_validate(d) for d in json.loads(quant_path.read_text())]
    if qual_path.exists():
        quals = [FrameQual.model_validate(d) for d in json.loads(qual_path.read_text())]

    # Load temporal analysis if not provided
    if temporal is None:
        temporal_path = out / f"{video_name}_temporal.json"
        if temporal_path.exists():
            temporal = TemporalAnalysis.model_validate(
                json.loads(temporal_path.read_text())
            )

    # Load product_info if not provided
    if product_data is None:
        product_path = out / f"{video_name}_product.json"
        if product_path.exists():
            product_data = json.loads(product_path.read_text())

    print(f"[Phase 6] Building video recipe ...")
    t0 = time.perf_counter()
    recipe = build_recipe(scenes, video_analysis, quants=quants, quals=quals, temporal=temporal, product_info=product_data)
    print(f"          → done ({time.perf_counter() - t0:.1f}s)")

    # Save recipe (inject engagement data from Phase 4c + script analysis from Phase 4d)
    recipe_dict = recipe.model_dump()
    for key in ("empathy_triggers", "narrative_analysis", "retention_analysis", "script_analysis", "script_alpha"):
        if key in video_analysis:
            recipe_dict[key] = video_analysis[key]
    recipe_path = out / f"{video_name}_video_recipe.json"
    recipe_path.write_text(
        json.dumps({"video_recipe": recipe_dict}, indent=2, ensure_ascii=False)
    )
    print(f"          → saved to {recipe_path}")
    print(f"\n✅ Full pipeline complete! Recipe: {recipe_path}")


def run_phase_0(video_path: str, output_dir: str) -> STTResult:
    """Run Phase 0: STT extraction via Soniox + narration type detection."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    print(f"[Phase 0] Running STT extraction (Soniox) ...")
    t0 = time.perf_counter()
    stt_result = run_stt_extraction(video_path)
    elapsed = time.perf_counter() - t0
    print(f"          → narration_type: {stt_result.narration_type}")
    print(f"          → {len(stt_result.segments)} segments, {stt_result.total_speech_sec:.1f}s speech ({elapsed:.1f}s)")

    # Save STT result
    stt_path = out / f"{video_name}_stt.json"
    stt_path.write_text(json.dumps(stt_result.to_dict(), indent=2, ensure_ascii=False))
    print(f"          → saved to {stt_path}")

    return stt_result


def run_phase_0_1(video_path: str, output_dir: str) -> ProductScanResult:
    """Run Phase 0.1: Product scanning."""
    out, video_name = _resolve_output_dir(output_dir, video_path)
    print(f"[Phase 0.1] Scanning product & category ...")
    t0 = time.perf_counter()
    result = scan_product(video_path)
    elapsed = time.perf_counter() - t0
    print(f"            → category: {result.category} ({result.category_ko})")
    if result.product_name:
        print(f"            → product: {result.product_name}")
    print(f"            → is_marketing: {result.is_marketing_video}")
    print(f"            → ({elapsed:.1f}s)")

    product_path = out / f"{video_name}_product.json"
    product_path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    print(f"            → saved to {product_path}")
    return result


def run_phase_7(
    output_dir: str,
    video_path: str,
    stt_data: dict | None = None,
    product_data: dict | None = None,
    product_name: str = "",
    product_category: str = "",
    product_key_factors: str = "",
) -> None:
    """Run Phase 7: Caption mapping + Integrated analysis + Prescriptions + Marketer Judge."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # Load recipe
    recipe_path = out / f"{video_name}_video_recipe.json"
    if not recipe_path.exists():
        print(f"[Phase 7] ⚠️  Recipe 없음 ({recipe_path.name}). Phase 6을 먼저 실행하세요.")
        return
    recipe_data = json.loads(recipe_path.read_text())
    recipe = recipe_data.get("video_recipe", recipe_data)

    # Load STT/Style from disk if not provided
    if stt_data is None:
        stt_path = out / f"{video_name}_stt.json"
        if stt_path.exists():
            stt_data = json.loads(stt_path.read_text())
    if product_data is None:
        product_path = out / f"{video_name}_product.json"
        if product_path.exists():
            product_data = json.loads(product_path.read_text())
        else:
            # Backward compat: try old style.json
            style_path = out / f"{video_name}_style.json"
            if style_path.exists():
                product_data = json.loads(style_path.read_text())

    t0 = time.perf_counter()

    # C-8: Caption mapping
    print(f"[Phase 7] Building caption map ...")
    qual_path = out / f"{video_name}_frame_qual.json"
    cap_map = None
    if qual_path.exists():
        frame_quals = json.loads(qual_path.read_text())
        events = build_caption_map(frame_quals)
        cap_map = caption_map_to_dict(events)
        cap_path = out / f"{video_name}_caption_map.json"
        cap_path.write_text(json.dumps(cap_map, indent=2, ensure_ascii=False))
        print(f"           → {cap_map['caption_count']} caption events → {cap_path.name}")
    else:
        print(f"           → frame_qual 없음, 캡션 매핑 스킵")

    # Load raw temporal for dimension calculations
    temporal_path = out / f"{video_name}_temporal.json"
    raw_temporal = None
    if temporal_path.exists():
        raw_temporal = json.loads(temporal_path.read_text())

    # C-9: 3-axis diagnosis (replaces integrated_analyzer)
    print(f"[Phase 7] Running 3-axis diagnosis ...")
    from src.diagnosis_engine import run_diagnosis

    # Load appeal structure
    appeal_struct_path = out / f"{video_name}_appeal_structure.json"
    appeal_structure = {}
    if appeal_struct_path.exists():
        appeal_structure = json.loads(appeal_struct_path.read_text())

    diagnosis_result = run_diagnosis(
        appeal_structure=appeal_structure,
        product_info=product_data or {},
        recipe=recipe,
        stt_data=stt_data,
        caption_map=cap_map,
    )
    diag_path = out / f"{video_name}_diagnosis.json"
    diag_path.write_text(json.dumps(diagnosis_result, indent=2, ensure_ascii=False))
    print(f"           → overall_score={diagnosis_result['overall_score']}, {len(diagnosis_result['axes'])} axes")
    print(f"           → {diag_path.name}")

    # C-10: Prescriptions
    print(f"[Phase 7] Generating prescriptions ...")
    from src.style_profiles import get_category_profile
    category_key = (product_data or {}).get("category", "general")
    profile = get_category_profile(category_key)

    rx_report = generate_prescriptions(
        recipe_data, profile, diagnosis=diagnosis_result,
        appeal_structure=appeal_structure, stt_data=stt_data,
        caption_map=cap_map, video_name=video_name,
    )
    rx_path = out / f"{video_name}_prescriptions.json"
    rx_path.write_text(json.dumps(rx_report.to_dict(), indent=2, ensure_ascii=False))
    elapsed = time.perf_counter() - t0
    print(f"           → {rx_report.total_prescriptions} prescriptions "
          f"(🔴{rx_report.danger_count} ⚠️{rx_report.warning_count})")
    if rx_report.top_3_actions:
        print(f"           → Top 3:")
        for i, action in enumerate(rx_report.top_3_actions, 1):
            print(f"             {i}. {action[:80]}")
    print(f"           → {rx_path.name} ({elapsed:.1f}s)")

    # Phase 7b: Marketer Judge (Gemini-powered verdict)
    print(f"\n[Phase 7b] Running Marketer Judge (Gemini) ...")
    frame_quals = None
    if qual_path.exists():
        frame_quals = json.loads(qual_path.read_text())

    verdict = run_marketer_judge(
        recipe=recipe_data,
        diagnosis=diagnosis_result,
        frame_quals=frame_quals,
        stt_data=stt_data,
        style_data=product_data,
        caption_map=cap_map,
        raw_temporal=raw_temporal,
        product_name=product_name,
        product_category=product_category,
        product_key_factors=product_key_factors,
    )
    verdict_path = out / f"{video_name}_verdict.json"
    verdict_path.write_text(json.dumps(verdict.to_dict(), indent=2, ensure_ascii=False))
    verdict_md_path = out / f"{video_name}_verdict.md"
    verdict_md_path.write_text(verdict.full_markdown)
    print(f"           → Verdict: {verdict.verdict}")
    print(f"           → {verdict_path.name}, {verdict_md_path.name}")


def run_full_pipeline(video_path: str, output_dir: str, resolution: int = 720, product_name: str = "", product_category: str = "") -> None:
    """Run all phases end-to-end."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from src.scene_detect import detect_scenes

    out, video_name = _resolve_output_dir(output_dir, video_path)

    # ── Parallel Phase 0 + 0.1 + 0.5 + frame extraction ──────────────────
    print(f"\n{'='*60}")
    print(f"[Parallel] Phase 0 (STT) + 0.1 (Style) + 0.5 (SceneDetect) + Frame extraction")
    print(f"{'='*60}")
    t_parallel = time.perf_counter()

    stt_result = None
    style = None
    scene_boundaries = None
    cut_timestamps = None
    frames = None
    parallel_errors = []

    def _do_stt():
        return run_phase_0(video_path, output_dir)

    def _do_product_scan():
        return run_phase_0_1(video_path, output_dir)

    def _do_scene_detect():
        print(f"[Phase 0.5] Running PySceneDetect (original video, full fps) ...")
        t0 = time.perf_counter()
        sb, ct = detect_scenes(str(video_path))
        elapsed = time.perf_counter() - t0
        print(f"            → {len(sb)} scenes, {len(ct)} cuts ({elapsed:.1f}s)")
        sd_path = out / f"{video_name}_scene_detect.json"
        sd_path.write_text(json.dumps({
            "boundaries": sb,
            "cut_timestamps": ct,
        }, indent=2))
        print(f"            → saved to {sd_path}")
        return sb, ct

    def _do_frames():
        print(f"[Phase 0+1] Extracting frames at 2fps ({resolution}p) + quant ...")
        t0 = time.perf_counter()
        _frames = extract_frames(video_path, max_dimension=resolution)
        print(f"            → {len(_frames)} frames extracted ({time.perf_counter() - t0:.1f}s)")

        # Phase 1: quant (OpenCV) — runs in same thread, no API calls
        t1 = time.perf_counter()
        quants = []
        for i, frame in enumerate(_frames):
            prev_bgr = _frames[i - 1].image if i > 0 else None
            q = analyse_frame_quant(frame.image, frame.timestamp, prev_bgr)
            quants.append(q)
        print(f"[Phase 1]   → quant done ({time.perf_counter() - t1:.1f}s)")

        # Save quant
        quant_path = out / f"{video_name}_frame_quant.json"
        quant_path.write_text(json.dumps([q.model_dump() for q in quants], indent=2, ensure_ascii=False))
        return _frames, quants

    with ThreadPoolExecutor(max_workers=4) as executor:
        fut_stt = executor.submit(_do_stt)
        fut_style = executor.submit(_do_product_scan)
        fut_sd = executor.submit(_do_scene_detect)
        fut_frames = executor.submit(_do_frames)

        for fut in as_completed([fut_stt, fut_style, fut_sd, fut_frames]):
            try:
                if fut is fut_stt:
                    stt_result = fut.result()
                    if stt_result.narration_type == "silent" and not stt_result.segments:
                        print("  ℹ️  STT: 음성 없음 (silent). 캡션 트랙으로 분석합니다.")
                elif fut is fut_style:
                    product_scan = fut.result()
                    if product_scan.category_confidence == 0.0:
                        print("  ⚠️  제품 스캔 신뢰도 0%. 결과를 확인하세요.")
                elif fut is fut_sd:
                    scene_boundaries, cut_timestamps = fut.result()
                elif fut is fut_frames:
                    frames, quants_early = fut.result()
            except Exception as e:
                parallel_errors.append(str(e))
                print(f"  ❌ Parallel task error: {e}")

    if parallel_errors:
        raise RuntimeError(f"Parallel phase failures: {'; '.join(parallel_errors)}")

    elapsed_parallel = time.perf_counter() - t_parallel
    print(f"\n[Parallel] All done in {elapsed_parallel:.1f}s (was sequential before)")
    print(f"{'='*60}\n")

    # ── Phase 2 + Phase 4: 병렬 실행 (둘 다 Gemini API 호출, 서로 독립적) ───
    print(f"\n{'='*60}")
    print(f"[Parallel] Phase 2 (frame_qual) + Phase 4 (video analysis) — 동시 실행")
    print(f"{'='*60}")
    t_phase24 = time.perf_counter()

    quals = None
    video_analysis = None
    phase24_errors = []

    def _do_phase2():
        """Phase 2: frame_qual (Gemini Flash) — 프레임별 OCR + 어필 분석"""
        print(f"[Phase 2] Running frame_qual (Gemini Flash) ...")
        _t0 = time.perf_counter()
        _jpeg_frames = [(f.timestamp, f.jpeg_bytes) for f in frames]
        _quals = asyncio.run(analyse_frames_qual(_jpeg_frames, quants_early))
        print(f"[Phase 2] → done ({time.perf_counter() - _t0:.1f}s)")

        # Save qual + combined
        _qual_path = out / f"{video_name}_frame_qual.json"
        _qual_data = [q.model_dump() for q in _quals]
        _qual_path.write_text(json.dumps(_qual_data, indent=2, ensure_ascii=False))

        _combined = [
            FrameAnalysis(quant=q, qual=ql).model_dump()
            for q, ql in zip(quants_early, _quals)
        ]
        _combined_path = out / f"{video_name}_frames.json"
        _combined_path.write_text(json.dumps(_combined, indent=2, ensure_ascii=False))
        return _quals

    def _do_phase4():
        """Phase 4: video analysis (Gemini) — 풀영상 업로드 분석 (frame_qual 없이 실행)"""
        return run_phase_4(
            video_path, output_dir, resolution=resolution, frame_quals=None,
            narration_type=stt_result.narration_type,
            stt_transcript=stt_result.full_transcript,
            product_scan=product_scan.to_dict(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        fut_p2 = executor.submit(_do_phase2)
        fut_p4 = executor.submit(_do_phase4)

        for fut in as_completed([fut_p2, fut_p4]):
            try:
                if fut is fut_p2:
                    quals = fut.result()
                elif fut is fut_p4:
                    video_analysis = fut.result()
            except Exception as e:
                phase24_errors.append(str(e))
                print(f"  ❌ Phase 2/4 error: {e}")

    if phase24_errors:
        print(f"  ⚠️ Phase 2/4 had errors (continuing with available data): {'; '.join(phase24_errors)}")
        # Don't crash — continue with whatever data we have
        if quals is None:
            quals = []
        if video_analysis is None:
            video_analysis = {}

    elapsed_phase24 = time.perf_counter() - t_phase24
    print(f"\n[Parallel] Phase 2+4 done in {elapsed_phase24:.1f}s (was sequential ~{elapsed_phase24*1.7:.0f}s before)")
    print(f"{'='*60}\n")

    # Phase 2.5: temporal analysis (local, no API)
    temporal = run_phase_2_5(output_dir, video_path)

    # Phase 3: scene aggregator (local, no API)
    scenes = run_phase_3(output_dir, video_path, temporal=temporal)

    # Phase 5: scene merger — merge Phase 3 + Phase 4 (local, no API)
    merged_scenes = run_phase_5(output_dir, video_path, scenes=scenes, video_analysis=video_analysis)

    # ── Phase 5.5: Appeal Structure ─────────────────────────────────────
    print("[Phase 5.5] Building appeal structure (scenes + groups) ...")
    from src.appeal_clusterer import cluster_appeals_into_scenes, summarize_scenes, group_scenes

    # Extract appeals from Phase 4 persuasion_analysis
    _pa = video_analysis.get("persuasion_analysis", {})
    _appeals = _pa.get("appeal_points", []) if isinstance(_pa, dict) else []

    # Load temporal data for text_dwell / transition_texture
    temporal_path_55 = out / f"{video_name}_temporal.json"
    _temporal_raw = json.loads(temporal_path_55.read_text()) if temporal_path_55.exists() else {}

    # STT segments
    stt_path_55 = out / f"{video_name}_stt.json"
    _stt_segs = []
    if stt_path_55.exists():
        _stt_segs = json.loads(stt_path_55.read_text()).get("segments", [])

    # Frame quals
    qual_path_55 = out / f"{video_name}_frame_qual.json"
    _fq_list = json.loads(qual_path_55.read_text()) if qual_path_55.exists() else []

    # Cut boundaries from SceneDetect
    _cut_ts = _temporal_raw.get("cut_rhythm", {}).get("cut_timestamps", [])
    if not _cut_ts and scene_boundaries:
        _cut_boundaries = list(scene_boundaries)
    else:
        _video_dur = max((fq.get("timestamp", 0) for fq in _fq_list), default=30.0) + 0.5 if _fq_list else 30.0
        _cut_boundaries = []
        _prev = 0.0
        for ct in _cut_ts:
            _cut_boundaries.append((_prev, ct))
            _prev = ct
        _cut_boundaries.append((_prev, _video_dur))

    t_55 = time.perf_counter()
    appeal_scenes = cluster_appeals_into_scenes(
        appeals=_appeals,
        cut_boundaries=_cut_boundaries,
        stt_segments=_stt_segs,
        text_dwell_items=_temporal_raw.get("text_dwell", {}).get("items", []),
        transition_events=_temporal_raw.get("transition_texture", {}).get("events", []),
        frame_quals=_fq_list,
    )
    print(f"          → {len(appeal_scenes)} scenes clustered")

    # Product info from Phase 0.1
    _product_path = out / f"{video_name}_product.json"
    _product_info = json.loads(_product_path.read_text()) if _product_path.exists() else {}

    appeal_scenes = summarize_scenes(appeal_scenes, _product_info)
    appeal_groups = group_scenes(appeal_scenes, _product_info)
    print(f"          → {len(appeal_groups)} groups formed ({time.perf_counter() - t_55:.1f}s)")

    appeal_structure = {"scenes": appeal_scenes, "groups": appeal_groups}
    appeal_struct_path = out / f"{video_name}_appeal_structure.json"
    appeal_struct_path.write_text(json.dumps(appeal_structure, indent=2, ensure_ascii=False))
    print(f"          → saved to {appeal_struct_path}")

    # Phase 6: recipe builder (includes temporal profile + production guide)
    run_phase_6(output_dir, video_path, scenes=merged_scenes, video_analysis=video_analysis, temporal=temporal, product_data=product_scan.to_dict())

    # Phase 7: Integrated analysis + prescriptions (C-8, C-9, C-10)
    run_phase_7(output_dir, video_path, stt_data=stt_result.to_dict(), product_data=product_scan.to_dict(),
                product_name=product_name, product_category=product_category)


# ── compare 서브커맨드 ──────────────────────────────────────────────────────────


def cmd_compare(args: argparse.Namespace) -> None:
    """compare 서브커맨드: N개의 영상을 비교해 VideoComparison JSON을 출력한다."""
    from src.comparator import compare_videos

    paths = args.paths
    labels = args.labels if args.labels else None

    if labels and len(labels) != len(paths):
        print(f"오류: --labels 수({len(labels)})가 경로 수({len(paths)})와 다릅니다", file=sys.stderr)
        sys.exit(1)

    print(f"\n🔍 {len(paths)}개 영상 비교 시작...\n")
    comparison = compare_videos(paths, labels=labels)

    # 출력
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(comparison.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"\n✅ 비교 결과 저장: {out_path}")
    else:
        print("\n" + json.dumps(comparison.model_dump(), indent=2, ensure_ascii=False))

    # 핵심 인사이트 요약 출력
    print(f"\n📊 비교 요약:")
    print(f"  영상 수: {len(comparison.videos)}")
    print(f"  성공 패턴: {len(comparison.success_patterns)}개")
    print(f"  실패 패턴: {len(comparison.failure_patterns)}개")
    print(f"  주요 차이점: {len(comparison.key_differentiators)}개")
    print(f"  인사이트: {len(comparison.insights)}개")
    if comparison.key_differentiators:
        print("\n🔑 핵심 차이점:")
        for d in comparison.key_differentiators:
            print(f"  • {d}")


# ── report 서브커맨드 ───────────────────────────────────────────────────────────


def cmd_report(args: argparse.Namespace) -> None:
    """report 서브커맨드: VideoRecipe JSON에서 리포트를 생성한다."""
    from src.report_generator import generate_report

    fmt = args.format
    recipe_path = args.recipe

    print(f"\n📝 리포트 생성 중... ({fmt} 형식)\n")
    report = generate_report(recipe_path, fmt=fmt)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"✅ 리포트 저장: {out_path}")
    else:
        print(report)

    if fmt == "telegram":
        print(f"\n(글자 수: {len(report)}/4096)")


# ── analyze 서브커맨드 (기존 기능 래퍼) ──────────────────────────────────────────


def cmd_analyze(args: argparse.Namespace) -> None:
    """analyze 서브커맨드: 영상 분석 파이프라인 실행."""
    if args.quant_only:
        run_phase_1_2(args.video, args.output, quant_only=True)
    elif args.phase == "0":
        run_phase_0(args.video, args.output)
    elif args.phase == "0.1":
        run_phase_0_1(args.video, args.output)
    elif args.phase == "1":
        run_phase_1_2(args.video, args.output, quant_only=True, resolution=args.resolution)
    elif args.phase == "2":
        run_phase_1_2(args.video, args.output, quant_only=False, resolution=args.resolution)
    elif args.phase == "2.5":
        run_phase_2_5(args.output, args.video)
    elif args.phase == "3":
        run_phase_3(args.output, args.video)
    elif args.phase == "4":
        # Load Phase 0/0.1 results from disk if available
        _out4, _vn4 = _resolve_output_dir(args.output, args.video)
        _stt_path = _out4 / f"{_vn4}_stt.json"
        _style_path = _out4 / f"{_vn4}_product.json"
        _qual_path = _out4 / f"{_vn4}_frame_qual.json"
        _nt, _st, _sc, _fq = None, None, None, None
        if _stt_path.exists():
            _stt_data = json.loads(_stt_path.read_text())
            _nt = _stt_data.get("narration_type")
            _st = _stt_data.get("full_transcript")
            print(f"  ℹ️  Loaded STT: narration_type={_nt}, {_stt_data.get('segment_count', 0)} segments")
        else:
            print(f"  ⚠️  STT 결과 없음 ({_stt_path.name}). Phase 0을 먼저 실행하세요.")
        if _style_path.exists():
            _sc = json.loads(_style_path.read_text())
            print(f"  ℹ️  Loaded product scan: category={_sc.get('category', '?')}")
        else:
            # Backward compat: try old style.json
            _old_style = _out4 / f"{_vn4}_style.json"
            if _old_style.exists():
                _sc = json.loads(_old_style.read_text())
                print(f"  ℹ️  Loaded legacy style: {_sc.get('primary_format', '?')}")
            else:
                print(f"  ⚠️  제품 스캔 없음 ({_style_path.name}). Phase 0.1을 먼저 실행하세요.")
        if _qual_path.exists():
            _fq = json.loads(_qual_path.read_text())
        run_phase_4(args.video, args.output, resolution=args.resolution,
                    frame_quals=_fq, narration_type=_nt, stt_transcript=_st,
                    product_scan=_sc)
    elif args.phase == "5":
        run_phase_5(args.output, args.video)
    elif args.phase == "6":
        run_phase_6(args.output, args.video)
    elif args.phase == "7":
        run_phase_7(args.output, args.video)
    else:
        product_name = getattr(args, 'product_name', '') or ''
        product_category = getattr(args, 'product_category', '') or ''
        run_full_pipeline(args.video, args.output, resolution=args.resolution,
                          product_name=product_name, product_category=product_category)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Shortform marketing video analyzer — full pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py analyze samples/sample5.mp4 --output output/s5_v2
  python main.py compare output/s1_latest/sample1 output/s5_v2/sample5 --labels failure success
  python main.py report output/s5_v2/sample5/sample5_video_recipe.json --format markdown
  python main.py report output/s5_v2/sample5/sample5_video_recipe.json --format telegram
        """,
    )

    subparsers = parser.add_subparsers(dest="command")

    # ── analyze 서브커맨드 ──────────────────────────────────────────────────────
    analyze_parser = subparsers.add_parser("analyze", help="영상 분석 파이프라인 실행")
    analyze_parser.add_argument("video", help="Path to the video file")
    analyze_parser.add_argument(
        "--output", "-o", default="output", help="Output directory (default: output/)"
    )
    analyze_parser.add_argument(
        "--quant-only", action="store_true",
        help="Run only Phase 1 (OpenCV quant) — no Gemini API calls",
    )
    analyze_parser.add_argument(
        "--phase", type=str, choices=["0", "0.1", "1", "2", "2.5", "3", "4", "5", "6", "7"],
        help="Run only a specific phase (assumes previous phase data exists)",
    )
    analyze_parser.add_argument(
        "--resolution", type=int, choices=[480, 720], default=720,
        help="Frame/video resolution: 720 (default) or 480 (faster/smaller)",
    )
    analyze_parser.add_argument(
        "--product-name", type=str, default="",
        help="Product name for verdict analysis",
    )
    analyze_parser.add_argument(
        "--product-category", type=str, default="",
        help="Product category for verdict analysis",
    )

    # ── compare 서브커맨드 ──────────────────────────────────────────────────────
    compare_parser = subparsers.add_parser("compare", help="복수 영상 비교 분석")
    compare_parser.add_argument(
        "paths", nargs="+",
        help="output 디렉토리 또는 *_video_recipe.json 경로 목록",
    )
    compare_parser.add_argument(
        "--labels", nargs="+", metavar="LABEL",
        help="각 영상의 레이블 (success/failure)",
    )
    compare_parser.add_argument(
        "--output", "-o", default=None,
        help="비교 결과 저장 경로 (기본: stdout)",
    )

    # ── report 서브커맨드 ───────────────────────────────────────────────────────
    report_parser = subparsers.add_parser("report", help="비디오 레시피 리포트 생성")
    report_parser.add_argument(
        "recipe", help="*_video_recipe.json 파일 경로",
    )
    report_parser.add_argument(
        "--format", "-f",
        choices=["markdown", "telegram", "summary"],
        default="markdown",
        help="리포트 형식 (기본: markdown)",
    )
    report_parser.add_argument(
        "--output", "-o", default=None,
        help="리포트 저장 경로 (기본: stdout)",
    )

    # ── 하위 호환성: 서브커맨드 없이 video 파일 경로를 직접 전달하는 경우 ──────────
    # 첫 번째 인자가 서브커맨드가 아니면 analyze로 처리
    args, remaining = parser.parse_known_args()

    if args.command is None:
        # 서브커맨드 없이 실행 → 기존 analyze 동작 유지
        legacy_parser = argparse.ArgumentParser()
        legacy_parser.add_argument("video")
        legacy_parser.add_argument("--output", "-o", default="output")
        legacy_parser.add_argument("--quant-only", action="store_true")
        legacy_parser.add_argument("--phase", type=str, choices=["0", "0.1", "1", "2", "2.5", "3", "4", "5", "6", "7"])
        legacy_parser.add_argument("--resolution", type=int, choices=[480, 720], default=720)

        # 원래 sys.argv에서 파싱
        legacy_args = legacy_parser.parse_args()
        legacy_args.command = "analyze"
        cmd_analyze(legacy_args)
        return

    if args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "compare":
        cmd_compare(args)
    elif args.command == "report":
        cmd_report(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
