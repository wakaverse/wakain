"""PySceneDetect wrapper — detect scene boundaries in video files.

Uses ContentDetector with adaptive threshold: if too few cuts are found,
retries with lower thresholds. Falls back to time-based splitting for
talking-head / low-motion videos.
"""

from __future__ import annotations

from scenedetect import detect, ContentDetector


def detect_scenes(
    video_path: str,
    threshold: float = 27.0,
    min_cuts_per_10s: float = 1.0,
    max_scene_seconds: float = 6.0,
) -> tuple[list[tuple[float, float]], list[float]]:
    """Detect scene boundaries using PySceneDetect ContentDetector.

    Uses adaptive threshold: tries default, then progressively lower thresholds
    if too few cuts are found. Falls back to time-based splitting.

    Args:
        video_path: Path to video file.
        threshold: Initial ContentDetector threshold.
        min_cuts_per_10s: Minimum expected cuts per 10 seconds.
        max_scene_seconds: Force-split scenes longer than this.

    Returns:
        Tuple of:
        - scene_boundaries: list of (start_time, end_time) in seconds
        - cut_timestamps: list of cut points in seconds
    """
    # Try progressively lower thresholds
    thresholds = [threshold, 20.0, 15.0, 10.0]
    best_scenes = []

    for th in thresholds:
        scene_list = detect(video_path, ContentDetector(threshold=th))
        scenes = [
            (round(s.get_seconds(), 3), round(e.get_seconds(), 3))
            for s, e in scene_list
        ]
        best_scenes = scenes

        if len(scenes) < 2:
            continue

        # Check if we have enough cuts
        total_dur = scenes[-1][1] - scenes[0][0]
        if total_dur <= 0:
            continue
        cuts_per_10 = (len(scenes) - 1) / (total_dur / 10.0)
        if cuts_per_10 >= min_cuts_per_10s:
            break

    # Force-split any scene longer than max_scene_seconds
    final_scenes = []
    for start, end in best_scenes:
        dur = end - start
        if dur <= max_scene_seconds:
            final_scenes.append((start, end))
        else:
            # Split into roughly equal parts
            n_parts = max(2, int(dur / max_scene_seconds + 0.5))
            part_dur = dur / n_parts
            for j in range(n_parts):
                ps = round(start + j * part_dur, 3)
                pe = round(start + (j + 1) * part_dur, 3) if j < n_parts - 1 else end
                final_scenes.append((ps, pe))

    # If still empty or just 1 scene, do uniform time split
    if len(final_scenes) < 2:
        # Get video duration from scenes or fallback
        if best_scenes:
            total_dur = best_scenes[-1][1]
        else:
            total_dur = _get_video_duration(video_path)
        if total_dur > 0:
            n_parts = max(2, int(total_dur / max_scene_seconds + 0.5))
            part_dur = total_dur / n_parts
            final_scenes = [
                (round(j * part_dur, 3), round((j + 1) * part_dur, 3) if j < n_parts - 1 else round(total_dur, 3))
                for j in range(n_parts)
            ]

    # Build cut timestamps
    cut_timestamps = [s[0] for s in final_scenes[1:]]

    return final_scenes, cut_timestamps


def _get_video_duration(video_path: str) -> float:
    """Get video duration using scenedetect's backend."""
    try:
        from scenedetect import open_video
        video = open_video(video_path)
        return video.duration.get_seconds()
    except Exception:
        return 0.0
