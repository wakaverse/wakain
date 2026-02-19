"""CLI entry point — runs the full video analysis pipeline.

Usage:
    python main.py <video_path> [--output <dir>] [--quant-only] [--phase <N>]

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

    print(f"[Phase 2.5] Running temporal analysis (local, no API) ...")
    t0 = time.perf_counter()
    temporal = run_temporal_analysis(quants, quals)
    elapsed = time.perf_counter() - t0
    print(f"            → done ({elapsed:.1f}s)")
    print(f"            → energy: {temporal.energy_curve.energy_arc}, "
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


def run_phase_4(video_path: str, output_dir: str, resolution: int = 720) -> dict:
    """Run Phase 4: full video analysis via Gemini."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    print(f"[Phase 4] Running video analysis (Gemini, full video upload, {resolution}p) ...")
    t0 = time.perf_counter()
    analysis = run_video_analysis(video_path, resolution=resolution)
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

    print(f"[Phase 6] Building video recipe ...")
    t0 = time.perf_counter()
    recipe = build_recipe(scenes, video_analysis, quants=quants, quals=quals, temporal=temporal)
    print(f"          → done ({time.perf_counter() - t0:.1f}s)")

    # Save recipe
    recipe_path = out / f"{video_name}_video_recipe.json"
    recipe_path.write_text(
        json.dumps({"video_recipe": recipe.model_dump()}, indent=2, ensure_ascii=False)
    )
    print(f"          → saved to {recipe_path}")
    print(f"\n✅ Full pipeline complete! Recipe: {recipe_path}")


def run_full_pipeline(video_path: str, output_dir: str, resolution: int = 720) -> None:
    """Run all phases end-to-end."""
    out, video_name = _resolve_output_dir(output_dir, video_path)

    # Phase 0.5: PySceneDetect — run on original video (full fps, resolution-independent)
    from src.scene_detect import detect_scenes
    print(f"[Phase 0.5] Running PySceneDetect (original video, full fps) ...")
    t0 = time.perf_counter()
    scene_boundaries, cut_timestamps = detect_scenes(str(video_path))
    print(f"            → {len(scene_boundaries)} scenes, {len(cut_timestamps)} cuts ({time.perf_counter() - t0:.1f}s)")
    sd_path = out / f"{video_name}_scene_detect.json"
    sd_path.write_text(json.dumps({
        "boundaries": scene_boundaries,
        "cut_timestamps": cut_timestamps,
    }, indent=2))
    print(f"            → saved to {sd_path}")

    # Phase 1+2: frame extraction + quant + qual
    run_phase_1_2(video_path, output_dir, quant_only=False, resolution=resolution)

    # Phase 2.5: temporal analysis (local, no API)
    temporal = run_phase_2_5(output_dir, video_path)

    # Phase 3: scene aggregator (local, no API)
    scenes = run_phase_3(output_dir, video_path, temporal=temporal)

    # Phase 4: video analysis (Gemini)
    video_analysis = run_phase_4(video_path, output_dir, resolution=resolution)

    # Phase 5: scene merger — merge Phase 3 + Phase 4 (local, no API)
    merged_scenes = run_phase_5(output_dir, video_path, scenes=scenes, video_analysis=video_analysis)

    # Phase 6: recipe builder (includes temporal profile + production guide)
    run_phase_6(output_dir, video_path, scenes=merged_scenes, video_analysis=video_analysis, temporal=temporal)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Shortform marketing video analyzer — full pipeline"
    )
    parser.add_argument("video", help="Path to the video file")
    parser.add_argument(
        "--output", "-o", default="output", help="Output directory (default: output/)"
    )
    parser.add_argument(
        "--quant-only", action="store_true",
        help="Run only Phase 1 (OpenCV quant) — no Gemini API calls",
    )
    parser.add_argument(
        "--phase", type=str, choices=["1", "2", "2.5", "3", "4", "5", "6"],
        help="Run only a specific phase (assumes previous phase data exists)",
    )
    parser.add_argument(
        "--resolution", type=int, choices=[480, 720], default=720,
        help="Frame/video resolution: 720 (default, better text detection) or 480 (faster/smaller)",
    )
    args = parser.parse_args()

    if args.quant_only:
        run_phase_1_2(args.video, args.output, quant_only=True)
    elif args.phase == "1":
        run_phase_1_2(args.video, args.output, quant_only=True, resolution=args.resolution)
    elif args.phase == "2":
        run_phase_1_2(args.video, args.output, quant_only=False, resolution=args.resolution)
    elif args.phase == "2.5":
        run_phase_2_5(args.output, args.video)
    elif args.phase == "3":
        run_phase_3(args.output, args.video)
    elif args.phase == "4":
        run_phase_4(args.video, args.output, resolution=args.resolution)
    elif args.phase == "5":
        run_phase_5(args.output, args.video)
    elif args.phase == "6":
        run_phase_6(args.output, args.video)
    else:
        # Full pipeline
        run_full_pipeline(args.video, args.output, resolution=args.resolution)


if __name__ == "__main__":
    main()
