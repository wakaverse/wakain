"""CLI entry point — runs the Phase 1 + Phase 2 pipeline on a video file.

Usage:
    python main.py <video_path> [--output <dir>] [--quant-only]
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
from src.schemas import FrameAnalysis


def run_pipeline(video_path: str, output_dir: str, quant_only: bool) -> None:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    video_name = Path(video_path).stem

    # ── Phase 0: Frame extraction ────────────────────────────────────────
    print(f"[1/3] Extracting frames at 2fps from {video_path} ...")
    t0 = time.perf_counter()
    frames = extract_frames(video_path)
    print(f"       → {len(frames)} frames extracted ({time.perf_counter() - t0:.1f}s)")

    if not frames:
        print("No frames extracted. Check the video file.")
        sys.exit(1)

    # ── Phase 1: frame_quant (OpenCV) ────────────────────────────────────
    print(f"[2/3] Running frame_quant (OpenCV) ...")
    t0 = time.perf_counter()
    quants = []
    for i, frame in enumerate(frames):
        prev_bgr = frames[i - 1].image if i > 0 else None
        q = analyse_frame_quant(frame.image, frame.timestamp, prev_bgr)
        quants.append(q)
    print(f"       → done ({time.perf_counter() - t0:.1f}s)")

    # Save quant results
    quant_path = out / f"{video_name}_frame_quant.json"
    quant_data = [q.model_dump() for q in quants]
    quant_path.write_text(json.dumps(quant_data, indent=2, ensure_ascii=False))
    print(f"       → saved to {quant_path}")

    if quant_only:
        print("Quant-only mode. Skipping Phase 2.")
        return

    # ── Phase 2: frame_qual (Gemini Flash) ───────────────────────────────
    print(f"[3/3] Running frame_qual (Gemini 2.0 Flash) ...")
    t0 = time.perf_counter()
    jpeg_frames = [(f.timestamp, f.jpeg_bytes) for f in frames]

    quals = asyncio.run(analyse_frames_qual(jpeg_frames, quants))
    print(f"       → done ({time.perf_counter() - t0:.1f}s)")

    # Save qual results
    qual_path = out / f"{video_name}_frame_qual.json"
    qual_data = [q.model_dump() for q in quals]
    qual_path.write_text(json.dumps(qual_data, indent=2, ensure_ascii=False))
    print(f"       → saved to {qual_path}")

    # Save combined results
    combined = [
        FrameAnalysis(quant=q, qual=ql).model_dump()
        for q, ql in zip(quants, quals)
    ]
    combined_path = out / f"{video_name}_frames.json"
    combined_path.write_text(json.dumps(combined, indent=2, ensure_ascii=False))
    print(f"       → combined saved to {combined_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Shortform marketing video frame analyzer (Phase 1 + 2)"
    )
    parser.add_argument("video", help="Path to the video file")
    parser.add_argument(
        "--output", "-o", default="output", help="Output directory (default: output/)"
    )
    parser.add_argument(
        "--quant-only", action="store_true",
        help="Run only Phase 1 (OpenCV quant) — no Gemini API calls",
    )
    args = parser.parse_args()

    run_pipeline(args.video, args.output, args.quant_only)


if __name__ == "__main__":
    main()
