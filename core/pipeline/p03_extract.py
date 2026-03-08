"""P3: EXTRACT — 프레임 추출 + 정량 분석 + SceneDetect.

로컬 전용 (API 호출 없음).
- 1fps 프레임 추출 (OpenCV, 최장변 720px 리사이즈, JPEG 저장)
- 프레임별 정량 분석: brightness, saturation, edge_diff, color_diff
- SceneDetect ContentDetector (threshold=27) → scene_boundaries
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import cv2
import numpy as np
from scenedetect import ContentDetector, detect

from core.schemas.pipeline import ExtractFrame, ExtractOutput

logger = logging.getLogger(__name__)

MAX_DIMENSION = 720
GRID_SIZE = 16
HIST_BINS = 64
SCENE_THRESHOLD = 27.0


# ── 정량 분석 함수 ───────────────────────────────────────────────────────────


def _edge_grid(gray: np.ndarray) -> np.ndarray:
    """Sobel edge magnitude → 16x16 grid of average magnitudes."""
    sx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(sx**2 + sy**2)

    h, w = mag.shape
    gh, gw = h // GRID_SIZE, w // GRID_SIZE
    mag = mag[: gh * GRID_SIZE, : gw * GRID_SIZE]
    grid = (
        mag.reshape(GRID_SIZE, gh, GRID_SIZE, gw)
        .transpose(0, 2, 1, 3)
        .reshape(GRID_SIZE, GRID_SIZE, -1)
    )
    return grid.mean(axis=2)


def _compute_edge_diff(gray_cur: np.ndarray, gray_prev: np.ndarray | None) -> float:
    """Sobel 16x16 그리드 L1 거리."""
    grid_cur = _edge_grid(gray_cur)
    if gray_prev is None:
        return 0.0
    grid_prev = _edge_grid(gray_prev)
    return float(np.abs(grid_cur - grid_prev).mean())


def _rgb_histogram(bgr: np.ndarray) -> np.ndarray:
    """Concatenated normalised RGB histogram (64-bin x 3 channels)."""
    hists = []
    for ch in range(3):
        h = cv2.calcHist([bgr], [ch], None, [HIST_BINS], [0, 256])
        h = h.flatten().astype(np.float64)
        s = h.sum()
        if s > 0:
            h /= s
        hists.append(h)
    return np.concatenate(hists)


def _compute_color_diff(bgr_cur: np.ndarray, bgr_prev: np.ndarray | None) -> float:
    """RGB 히스토그램 64빈x3채널 L1 거리."""
    hist_cur = _rgb_histogram(bgr_cur)
    if bgr_prev is None:
        return 0.0
    hist_prev = _rgb_histogram(bgr_prev)
    return float(np.abs(hist_cur - hist_prev).sum())


def _compute_brightness(hsv: np.ndarray) -> float:
    """HSV V채널 평균 (0~1 정규화)."""
    return float(hsv[:, :, 2].mean() / 255.0)


def _compute_saturation(hsv: np.ndarray) -> float:
    """HSV S채널 평균 (0~1 정규화)."""
    return float(hsv[:, :, 1].mean() / 255.0)


# ── 프레임 추출 + 정량 분석 (동기) ───────────────────────────────────────────


def _extract_and_analyze(
    video_path: str, output_dir: str, fps: int = 1
) -> tuple[list[ExtractFrame], int]:
    """프레임 추출, JPEG 저장, 정량 분석을 수행. (frames, total_frames) 반환."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        cap.release()
        raise ValueError(f"Invalid video FPS: {video_fps}")

    frame_interval = int(round(video_fps / fps))
    if frame_interval < 1:
        frame_interval = 1

    frames_dir = Path(output_dir) / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frames: list[ExtractFrame] = []
    prev_bgr: np.ndarray | None = None
    prev_gray: np.ndarray | None = None
    frame_idx = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    logger.info(
        "Extracting frames: video_fps=%.1f, target_fps=%d, interval=%d, total=%d",
        video_fps, fps, frame_interval, total_frames,
    )

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp = round(frame_idx / video_fps, 1)

            # 리사이즈 (최장변 720px)
            h, w = frame.shape[:2]
            if max(h, w) > MAX_DIMENSION:
                scale = MAX_DIMENSION / max(h, w)
                frame = cv2.resize(
                    frame,
                    (int(w * scale), int(h * scale)),
                    interpolation=cv2.INTER_AREA,
                )

            # JPEG 저장
            jpeg_path = frames_dir / f"frame_{timestamp:.1f}.jpg"
            cv2.imwrite(str(jpeg_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

            # 정량 분석
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

            edge_diff = _compute_edge_diff(gray, prev_gray)
            color_diff = _compute_color_diff(frame, prev_bgr)
            brightness = _compute_brightness(hsv)
            saturation = _compute_saturation(hsv)

            frames.append(
                ExtractFrame(
                    timestamp=timestamp,
                    brightness=round(brightness, 3),
                    saturation=round(saturation, 3),
                    edge_diff=round(edge_diff, 2),
                    color_diff=round(color_diff, 3),
                )
            )

            prev_bgr = frame
            prev_gray = gray

        frame_idx += 1

    cap.release()
    extracted_count = len(frames)
    logger.info("Extracted %d frames", extracted_count)
    return frames, extracted_count


# ── SceneDetect (동기) ───────────────────────────────────────────────────────


def _detect_scenes(video_path: str) -> list[list[float]]:
    """PySceneDetect ContentDetector로 씬 경계 계산."""
    scene_list = detect(video_path, ContentDetector(threshold=SCENE_THRESHOLD))

    boundaries: list[list[float]] = []
    for start, end in scene_list:
        boundaries.append([
            round(start.get_seconds(), 3),
            round(end.get_seconds(), 3),
        ])

    logger.info("Detected %d scenes", len(boundaries))
    return boundaries


# ── Public API ───────────────────────────────────────────────────────────────


async def run(video_path: str, output_dir: str, fps: int = 1) -> ExtractOutput:
    """P3 EXTRACT 실행.

    Args:
        video_path: 영상 파일 경로
        output_dir: 프레임 JPEG 저장 디렉토리 (output/{video_name}/)
        fps: 추출 fps (기본 1)

    Returns:
        ExtractOutput (from core.schemas.pipeline)
    """
    logger.info("P3 EXTRACT start: %s", video_path)

    # CPU 바운드 작업 → asyncio.to_thread
    frames, total_frames = await asyncio.to_thread(
        _extract_and_analyze, video_path, output_dir, fps
    )
    scene_boundaries = await asyncio.to_thread(_detect_scenes, video_path)

    result = ExtractOutput(
        frames=frames,
        scene_boundaries=scene_boundaries,
        total_frames=total_frames,
        fps=fps,
    )

    # 중간 산출물 JSON 저장
    output_path = Path(output_dir) / "p03_extract.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("P3 EXTRACT done → %s", output_path)

    return result
