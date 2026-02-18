"""Extract frames from video at 2fps using OpenCV."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

FPS_TARGET = 2
MAX_DIMENSION = 720  # Resize frames so longest side ≤ this


@dataclass
class ExtractedFrame:
    timestamp: float
    image: np.ndarray  # BGR, HWC
    jpeg_bytes: bytes


def extract_frames(
    video_path: str | Path,
    fps: float = FPS_TARGET,
) -> list[ExtractedFrame]:
    """Extract frames from *video_path* at the given FPS rate.

    Returns a list of ``ExtractedFrame`` ordered by timestamp.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        raise ValueError(f"Invalid video FPS: {video_fps}")

    frame_interval = int(round(video_fps / fps))
    if frame_interval < 1:
        frame_interval = 1

    frames: list[ExtractedFrame] = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / video_fps
            # Resize: longest side ≤ MAX_DIMENSION
            h, w = frame.shape[:2]
            if max(h, w) > MAX_DIMENSION:
                scale = MAX_DIMENSION / max(h, w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)),
                                   interpolation=cv2.INTER_AREA)
            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frames.append(
                ExtractedFrame(
                    timestamp=round(timestamp, 2),
                    image=frame,
                    jpeg_bytes=jpeg.tobytes(),
                )
            )

        frame_idx += 1

    cap.release()
    return frames
