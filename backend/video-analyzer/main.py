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
        run_full_pipeline(args.video, args.output, resolution=args.resolution)


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
        "--phase", type=str, choices=["1", "2", "2.5", "3", "4", "5", "6"],
        help="Run only a specific phase (assumes previous phase data exists)",
    )
    analyze_parser.add_argument(
        "--resolution", type=int, choices=[480, 720], default=720,
        help="Frame/video resolution: 720 (default) or 480 (faster/smaller)",
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
        legacy_parser.add_argument("--phase", type=str, choices=["1", "2", "2.5", "3", "4", "5", "6"])
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
