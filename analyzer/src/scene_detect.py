"""PySceneDetect wrapper — detect scene boundaries in video files.

Uses ContentDetector to find cuts/transitions in the original video
(full fps, not extracted 2fps frames).
"""

from __future__ import annotations

from scenedetect import detect, ContentDetector


def detect_scenes(
    video_path: str,
    threshold: float = 27.0,
) -> tuple[list[tuple[float, float]], list[float]]:
    """Detect scene boundaries using PySceneDetect ContentDetector.

    Args:
        video_path: Path to video file.
        threshold: ContentDetector threshold (default 27).

    Returns:
        Tuple of:
        - scene_boundaries: list of (start_time, end_time) in seconds
        - cut_timestamps: list of cut points in seconds (boundary between scenes)
    """
    scene_list = detect(video_path, ContentDetector(threshold=threshold))

    scene_boundaries: list[tuple[float, float]] = []
    cut_timestamps: list[float] = []

    for start, end in scene_list:
        scene_boundaries.append((
            round(start.get_seconds(), 3),
            round(end.get_seconds(), 3),
        ))

    # Cut timestamps = start of each scene except the first
    for i in range(1, len(scene_boundaries)):
        cut_timestamps.append(scene_boundaries[i][0])

    return scene_boundaries, cut_timestamps
