"""Phase 5: Scene merger — merge Phase 3 aggregated scenes + Phase 4 video analysis.

Matches Phase 4 scene_roles, transcript, and text_effects to Phase 3 scenes
by time range overlap. Pure local computation — no API calls.
"""

from __future__ import annotations

import copy

from .schemas import (
    ContentSummary,
    EffectivenessSignals,
    Scene,
    TranscriptSegment,
    VisualSummary,
)


def _time_overlap(range_a: list[float], range_b: list[float]) -> float:
    """Compute overlap duration between two time ranges."""
    start = max(range_a[0], range_b[0])
    end = min(range_a[1], range_b[1])
    return max(0.0, end - start)


def _rescale_timestamps(video_analysis: dict, duration: float) -> dict:
    """Rescale normalized (0.0-1.0) timestamps to actual seconds."""
    va = copy.deepcopy(video_analysis)

    for sr in va.get("scene_roles", []):
        if "start" in sr:
            sr["start"] = float(sr["start"]) * duration
        if "end" in sr:
            sr["end"] = float(sr["end"]) * duration

    transcript = va.get("audio", {}).get("voice", {}).get("transcript", [])
    for seg in transcript:
        if "start" in seg:
            seg["start"] = float(seg["start"]) * duration
        if "end" in seg:
            seg["end"] = float(seg["end"]) * duration

    for te in va.get("text_effects", []):
        if "time" in te:
            te["time"] = float(te["time"]) * duration

    appeal_points = va.get("persuasion_analysis", {}).get("appeal_points", [])
    for ap in appeal_points:
        vp = ap.get("visual_proof", {})
        if vp.get("timestamp") is not None:
            vp["timestamp"] = float(vp["timestamp"]) * duration

    return va


def merge_analysis(
    aggregated_scenes: list[Scene],
    video_analysis: dict,
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> list[Scene]:
    """Merge Phase 3 aggregated scenes with Phase 4 video analysis.

    For each aggregated scene:
    - Assigns role from Phase 4 scene_roles (best time-overlap match)
    - Attaches matching transcript segments (by time overlap)
    - Attaches matching text_effects (by time point within scene range)

    Parameters
    ----------
    aggregated_scenes : list[Scene]
        Scenes from Phase 3 (role="transition" placeholders).
    video_analysis : dict
        Raw dict from Phase 4 video_analyzer.
    scene_boundaries : optional
        PySceneDetect boundaries (unused here, kept for API consistency).
    """
    # ── Detect & fix normalized timestamps (ratio 0.0~1.0 instead of seconds)
    duration = aggregated_scenes[-1].time_range[1] if aggregated_scenes else 0.0

    if duration > 0:
        all_ts: list[float] = []
        for sr in video_analysis.get("scene_roles", []):
            if "start" in sr:
                all_ts.append(float(sr["start"]))
            if "end" in sr:
                all_ts.append(float(sr["end"]))
        for seg in video_analysis.get("audio", {}).get("voice", {}).get("transcript", []):
            if "start" in seg:
                all_ts.append(float(seg["start"]))
            if "end" in seg:
                all_ts.append(float(seg["end"]))
        for te in video_analysis.get("text_effects", []):
            if "time" in te:
                all_ts.append(float(te["time"]))
        for ap in video_analysis.get("persuasion_analysis", {}).get("appeal_points", []):
            vp = ap.get("visual_proof", {})
            if vp.get("timestamp") is not None:
                all_ts.append(float(vp["timestamp"]))

        if all_ts:
            max_ts = max(all_ts)
            if max_ts < duration * 0.1:
                print(
                    f"  ⚠️ Detected normalized timestamps "
                    f"(max={max_ts:.2f}s for {duration:.1f}s video). Rescaling..."
                )
                video_analysis = _rescale_timestamps(video_analysis, duration)

    scene_roles = video_analysis.get("scene_roles", [])
    transcript = (
        video_analysis.get("audio", {})
        .get("voice", {})
        .get("transcript", [])
    )
    text_effects = video_analysis.get("text_effects", [])
    appeal_points = (
        video_analysis.get("persuasion_analysis", {})
        .get("appeal_points", [])
    )

    enriched_scenes: list[Scene] = []

    for scene in aggregated_scenes:
        s_start, s_end = scene.time_range
        scene_range = [s_start, s_end]

        # 1. Find best matching role from scene_roles (max time overlap)
        best_role = "transition"
        best_description = ""
        best_overlap = 0.0
        for sr in scene_roles:
            sr_range = [float(sr.get("start", 0)), float(sr.get("end", 0))]
            overlap = _time_overlap(scene_range, sr_range)
            if overlap > best_overlap:
                best_overlap = overlap
                best_role = sr.get("role", "transition")
                best_description = sr.get("description", "")

        # 1b. Fallback: position-based role when no overlap found
        if best_overlap == 0:
            relative_pos = s_start / duration if duration > 0 else 0.5
            if relative_pos < 0.10:
                best_role = "hook"
            elif relative_pos >= 0.85:
                best_role = "cta"
            else:
                best_role = "body"

        # 2. Match transcript segments by time range overlap
        matched_transcript: list[TranscriptSegment] = []
        for seg in transcript:
            seg_range = [float(seg.get("start", 0)), float(seg.get("end", 0))]
            if _time_overlap(scene_range, seg_range) > 0:
                matched_transcript.append(TranscriptSegment(
                    start=seg.get("start", 0),
                    end=seg.get("end", 0),
                    text=seg.get("text", ""),
                    speaker=seg.get("speaker"),
                ))

        # 3. Match text_effects to scene by appearance time
        matched_text_effects: list[dict] = []
        for te in text_effects:
            te_time = float(te.get("time", 0))
            if s_start <= te_time <= s_end:
                matched_text_effects.append(te)

        # 4. Match appeal_points to scene by visual_proof timestamp
        matched_appeals: list[dict] = []
        for ap in appeal_points:
            vp = ap.get("visual_proof", {})
            ap_time = vp.get("timestamp")
            if ap_time is not None and s_start <= float(ap_time) <= s_end:
                matched_appeals.append(ap)

        # 4b. Generate description from text_effects if empty
        if not best_description and matched_text_effects:
            text_parts = [
                te.get("content", "") or te.get("text", "")
                for te in matched_text_effects
                if te.get("content") or te.get("text")
            ]
            if text_parts:
                best_description = " / ".join(text_parts[:3])

        enriched = Scene(
            scene_id=scene.scene_id,
            role=best_role,
            description=best_description,
            time_range=scene.time_range,
            duration=scene.duration,
            visual_summary=scene.visual_summary,
            content_summary=scene.content_summary,
            effectiveness_signals=scene.effectiveness_signals,
            attention=scene.attention,
            transcript_segments=matched_transcript,
            text_effects=matched_text_effects,
            appeal_points=matched_appeals,
            artwork=scene.artwork,
        )
        enriched_scenes.append(enriched)
        print(
            f"  ✓ Scene {scene.scene_id}: role={best_role}, "
            f"transcript_segs={len(matched_transcript)}, "
            f"text_effects={len(matched_text_effects)}, "
            f"appeals={len(matched_appeals)}"
        )

    return enriched_scenes
