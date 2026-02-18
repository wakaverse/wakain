"""Phase 3: Scene merger — group consecutive similar frames into scenes.

Reads frame_quant + frame_qual results, merges frames with similar
shot_type + subject_type into scenes, then uses Gemini Flash to assign
scene role and effectiveness signals.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections import Counter
from pathlib import Path

from google import genai
from google.genai import types

from typing import Literal

from .schemas import (
    ContentSummary,
    EffectivenessSignals,
    FrameQual,
    FrameQuant,
    Scene,
    SceneEnergy,
    SceneHumanElement,
    SceneTextOverlay,
    TemporalAnalysis,
    VisualSummary,
    ZoomEvent,
)

MODEL = "gemini-2.0-flash"

SYSTEM_INSTRUCTION = """\
You are a shortform marketing video analyst. Given scene data (grouped frames),
assign the scene's narrative role and effectiveness signals.

Always respond with valid JSON matching the requested schema exactly.

Scene roles:
- hook: Opening attention grab (first 1-3 seconds typically)
- problem: Presents pain point or need
- solution: Introduces product/service as answer
- demo: Shows product in action
- proof: Social proof, testimonials, results
- cta: Call to action
- transition: Brief connecting shot between scenes
- brand_intro: Brand/logo showcase

For effectiveness_signals:
- hook_strength: Describe what grabs attention (or "none" for non-hook scenes)
- information_density: high (lots of info), medium, low (visual/emotional only)
- emotional_trigger: The primary emotional lever used
"""


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    return genai.Client(api_key=api_key)


# ── Frame grouping ──────────────────────────────────────────────────────────


def _group_frames_by_scene_boundaries(
    quants: list[FrameQuant],
    scene_boundaries: list[tuple[float, float]],
) -> list[list[int]]:
    """Group frame indices using PySceneDetect scene boundaries.

    Each frame is assigned to the scene whose time range contains it.
    Empty scenes (no frame landed inside) get the nearest frame assigned
    so that every PySceneDetect boundary produces a scene.
    """
    if not quants or not scene_boundaries:
        return [[i for i in range(len(quants))]] if quants else []

    groups: list[list[int]] = [[] for _ in scene_boundaries]

    for idx, q in enumerate(quants):
        placed = False
        for s_idx, (s_start, s_end) in enumerate(scene_boundaries):
            if s_start <= q.timestamp < s_end:
                groups[s_idx].append(idx)
                placed = True
                break
        if not placed:
            # Frame after last scene end — put in last group
            groups[-1].append(idx)

    # Fill empty groups with the nearest frame (by scene midpoint)
    timestamps = [q.timestamp for q in quants]
    for s_idx, grp in enumerate(groups):
        if not grp:
            mid = (scene_boundaries[s_idx][0] + scene_boundaries[s_idx][1]) / 2.0
            nearest_idx = min(range(len(timestamps)),
                             key=lambda i: abs(timestamps[i] - mid))
            groups[s_idx] = [nearest_idx]

    return groups


def _group_frames_fallback(
    quants: list[FrameQuant], quals: list[FrameQual],
) -> list[list[int]]:
    """Fallback: group by shot_type + subject_type changes (old method)."""
    if not quals:
        return []

    groups: list[list[int]] = [[0]]
    for i in range(1, len(quals)):
        prev = quals[i - 1]
        curr = quals[i]
        quant = quants[i]

        shot_changed = curr.shot_type != prev.shot_type
        subject_changed = curr.subject_type != prev.subject_type
        big_cut = quant.edge_diff > 40 and quant.color_diff > 0.8

        if (shot_changed and subject_changed) or big_cut:
            groups.append([i])
        else:
            groups[-1].append(i)

    return groups


# ── Compute visual/content summaries from frame data ───────────────────────


def _compute_visual_summary(
    quants: list[FrameQuant],
    quals: list[FrameQual],
    temporal: TemporalAnalysis | None = None,
    time_range: list[float] | None = None,
) -> dict:
    """Compute visual_summary fields from grouped frames (without LLM fields)."""
    # Dominant shot = most common shot_type
    shot_counts = Counter(q.shot_type for q in quals)
    dominant_shot = shot_counts.most_common(1)[0][0]

    # Shot sequence: ordered list of shot_type from each frame
    shot_sequence = [q.shot_type for q in quals]

    # Composition: most common layout
    layout_counts = Counter(q.composition.layout for q in quals)
    composition = layout_counts.most_common(1)[0][0]

    # Count cuts (frames with high edge_diff)
    cut_count = sum(1 for q in quants[1:] if q.edge_diff > 30)

    # Time span
    ts_start = quants[0].timestamp
    ts_end = quants[-1].timestamp
    duration = ts_end - ts_start + 0.5  # +0.5 for last frame duration
    avg_cut_interval = duration / max(cut_count, 1)

    # Motion level from average edge_diff
    avg_edge = sum(q.edge_diff for q in quants) / len(quants)
    if avg_edge < 5:
        motion_level = "static"
    elif avg_edge < 15:
        motion_level = "slow"
    elif avg_edge < 30:
        motion_level = "moderate"
    elif avg_edge < 50:
        motion_level = "fast"
    else:
        motion_level = "jump_cut"

    # Color consistency: 1 - avg(color_diff) clamped to [0,1]
    avg_cdiff = sum(q.color_diff for q in quants) / len(quants)
    color_consistency = round(max(0.0, min(1.0, 1.0 - avg_cdiff)), 2)

    # Most common color_mood
    mood_counts = Counter(q.color_mood for q in quals)
    color_mood = mood_counts.most_common(1)[0][0]

    # Color palette: collect dominant_colors from all frames, pick top 3 by total ratio
    color_ratios: dict[str, float] = {}
    for q in quants:
        for dc in q.dominant_colors:
            color_ratios[dc.hex] = color_ratios.get(dc.hex, 0.0) + dc.ratio
    top_colors = sorted(color_ratios.items(), key=lambda x: x[1], reverse=True)[:3]
    color_palette = [hex_code for hex_code, _ in top_colors]

    # Zoom events + transitions from temporal data
    zoom_events: list[dict] = []
    transition_in = "none"
    transition_out = "none"

    if temporal and time_range:
        s_start, s_end = time_range

        # Zoom events within scene time range
        for z in temporal.zoom_events:
            if z.time_range[0] >= s_start and z.time_range[1] <= s_end:
                zoom_events.append(z.model_dump())

        # Transition at scene start (event closest to s_start)
        for evt in temporal.transition_texture.events:
            if abs(evt.timestamp - s_start) <= 0.6:
                transition_in = evt.type
                break

        # Transition at scene end (event closest to s_end)
        for evt in reversed(temporal.transition_texture.events):
            if abs(evt.timestamp - s_end) <= 0.6:
                transition_out = evt.type
                break

    return {
        "dominant_shot": dominant_shot,
        "shot_sequence": shot_sequence,
        "composition": composition,
        "cut_count": cut_count,
        "avg_cut_interval": round(avg_cut_interval, 2),
        "motion_level": motion_level,
        "color_consistency": color_consistency,
        "color_mood": color_mood,
        "color_palette": color_palette,
        "zoom_events": zoom_events,
        "transition_in": transition_in,
        "transition_out": transition_out,
    }


def _compute_content_summary(
    quals: list[FrameQual],
    quants: list[FrameQuant],
) -> dict:
    """Compute content_summary fields from grouped frames."""
    subject_counts = Counter(q.subject_type for q in quals)
    subject_type = subject_counts.most_common(1)[0][0]

    vis_counts = Counter(q.product_presentation.visibility for q in quals)
    product_visibility = vis_counts.most_common(1)[0][0]

    # Product angle + context: most common values
    angle_counts = Counter(q.product_presentation.angle for q in quals)
    product_angle = angle_counts.most_common(1)[0][0]

    context_counts = Counter(q.product_presentation.context for q in quals)
    product_context = context_counts.most_common(1)[0][0]

    # Human element: aggregate most common role/emotion/gesture, majority eye_contact
    human_frames = [q for q in quals if q.human_element.role != "none"]
    human_element = None
    if human_frames:
        role_counts = Counter(q.human_element.role for q in human_frames)
        emotion_counts = Counter(q.human_element.emotion for q in human_frames)
        gesture_counts = Counter(q.human_element.gesture for q in human_frames)
        eye_contact_true = sum(1 for q in human_frames if q.human_element.eye_contact)
        human_element = {
            "role": role_counts.most_common(1)[0][0],
            "emotion": emotion_counts.most_common(1)[0][0],
            "eye_contact": eye_contact_true > len(human_frames) / 2,
            "gesture": gesture_counts.most_common(1)[0][0],
        }

    # Text overlays: enriched with purpose, font_style, position, dwell_time
    text_overlays: list[dict] = []
    text_frame_counts: dict[str, int] = {}
    text_info: dict[str, dict] = {}
    for q in quals:
        if q.text_overlay and q.text_overlay.content:
            content = q.text_overlay.content.strip()
            if not content:
                continue
            text_frame_counts[content] = text_frame_counts.get(content, 0) + 1
            if content not in text_info:
                # Get text region position from corresponding quant frame
                position = "unknown"
                for quant in quants:
                    if quant.timestamp == q.timestamp:
                        position = quant.text_region.position
                        break
                text_info[content] = {
                    "content": content,
                    "purpose": q.text_overlay.purpose,
                    "font_style": q.text_overlay.font_style,
                    "position": position,
                }

    for content, info in text_info.items():
        dwell_time = round(text_frame_counts[content] * 0.5, 1)
        text_overlays.append({**info, "dwell_time": dwell_time})

    # Attention elements: unique attention_element strings from all frames
    attention_elements: list[str] = []
    seen_attn: set[str] = set()
    for q in quals:
        if q.attention_element and q.attention_element not in seen_attn:
            seen_attn.add(q.attention_element)
            attention_elements.append(q.attention_element)

    return {
        "subject_type": subject_type,
        "product_visibility": product_visibility,
        "product_angle": product_angle,
        "product_context": product_context,
        "human_element": human_element,
        "text_overlays": text_overlays,
        "attention_elements": attention_elements,
    }


# ── Scene energy from temporal data ─────────────────────────────────────────


def _compute_scene_energy(
    temporal: TemporalAnalysis,
    time_range: list[float],
) -> dict | None:
    """Compute energy stats for a scene from temporal energy curve."""
    s_start, s_end = time_range
    points = [
        p for p in temporal.energy_curve.points
        if s_start <= p.timestamp <= s_end
    ]
    if not points:
        return None

    scores = [p.score for p in points]
    avg_score = round(sum(scores) / len(scores), 3)
    peak_point = max(points, key=lambda p: p.score)
    peak_score = round(peak_point.score, 3)
    peak_timestamp = round(peak_point.timestamp, 2)
    section = peak_point.section
    is_climax = peak_score >= 0.75

    return {
        "avg_score": avg_score,
        "peak_score": peak_score,
        "peak_timestamp": peak_timestamp,
        "section": section,
        "is_climax": is_climax,
    }


# ── Gemini LLM for role + effectiveness ────────────────────────────────────


class _SceneRoleResponse(EffectivenessSignals):
    """Extended response that also includes role and key_action."""
    role: Literal[
        "hook", "problem", "solution", "demo", "proof",
        "cta", "transition", "brand_intro",
    ]
    key_action: str


async def _assign_role_and_signals(
    client: genai.Client,
    scene_index: int,
    total_scenes: int,
    time_range: list[float],
    visual_summary: dict,
    content_summary: dict,
) -> dict:
    """Use Gemini Flash to assign scene role and effectiveness signals."""
    prompt = f"""Analyse this scene from a shortform marketing video.

Scene {scene_index + 1} of {total_scenes}
Time range: {time_range[0]:.1f}s - {time_range[1]:.1f}s

Visual summary:
{json.dumps(visual_summary, indent=2, ensure_ascii=False)}

Content summary:
{json.dumps(content_summary, indent=2, ensure_ascii=False)}

Based on the scene's position in the video, visual content, and text overlays:
1. Assign the scene role — MUST be exactly one of: hook, problem, solution, demo, proof, cta, transition, brand_intro
2. Write a 1-line key_action describing what happens in this scene
3. Assess effectiveness signals (hook_strength, information_density, emotional_trigger)

Return JSON with: role, key_action, hook_strength, information_density, emotional_trigger"""

    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=[types.Part.from_text(text=prompt)],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=_SceneRoleResponse,
                    temperature=0.1,
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            wait = 2 ** attempt * 5
            if attempt < max_retries - 1:
                print(f"  ⚠ Scene {scene_index+1} retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                await asyncio.sleep(wait)
            else:
                raise RuntimeError(f"Scene {scene_index+1} failed after {max_retries} retries: {e}") from e


# ── Public API ──────────────────────────────────────────────────────────────


async def merge_scenes(
    quants: list[FrameQuant],
    quals: list[FrameQual],
    temporal: TemporalAnalysis | None = None,
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> list[Scene]:
    """Merge frames into scenes and assign roles via Gemini.

    When scene_boundaries is provided (from PySceneDetect), use those
    for frame grouping. Otherwise falls back to heuristic grouping.
    """
    if scene_boundaries:
        groups = _group_frames_by_scene_boundaries(quants, scene_boundaries)
    else:
        groups = _group_frames_fallback(quants, quals)
    if not groups:
        return []

    client = _make_client()
    scenes: list[Scene] = []

    for scene_idx, frame_indices in enumerate(groups):
        grp_quants = [quants[i] for i in frame_indices]
        grp_quals = [quals[i] for i in frame_indices]

        # Use PySceneDetect boundaries for accurate time_range
        if scene_boundaries and scene_idx < len(scene_boundaries):
            ts_start = scene_boundaries[scene_idx][0]
            ts_end = scene_boundaries[scene_idx][1]
        else:
            ts_start = grp_quants[0].timestamp
            ts_end = grp_quants[-1].timestamp + 0.5
        duration = round(ts_end - ts_start, 2)
        time_range = [round(ts_start, 2), round(ts_end, 2)]

        visual_summary = _compute_visual_summary(
            grp_quants, grp_quals,
            temporal=temporal, time_range=time_range,
        )
        content_summary = _compute_content_summary(grp_quals, grp_quants)

        # LLM assigns role + effectiveness
        llm_result = await _assign_role_and_signals(
            client, scene_idx, len(groups),
            time_range, visual_summary, content_summary,
        )

        content_summary["key_action"] = llm_result.get("key_action", "")

        # Energy from temporal data
        energy = None
        if temporal:
            energy_data = _compute_scene_energy(temporal, time_range)
            if energy_data:
                energy = SceneEnergy(**energy_data)

        scene = Scene(
            scene_id=scene_idx + 1,
            role=llm_result.get("role", "transition"),
            time_range=time_range,
            duration=duration,
            visual_summary=VisualSummary(**visual_summary),
            content_summary=ContentSummary(**content_summary),
            effectiveness_signals=EffectivenessSignals(
                hook_strength=llm_result.get("hook_strength", "none"),
                information_density=llm_result.get("information_density", "medium"),
                emotional_trigger=llm_result.get("emotional_trigger", "none"),
            ),
            energy=energy,
        )
        scenes.append(scene)
        print(f"  ✓ Scene {scene_idx+1}/{len(groups)}: {scene.role} ({time_range[0]:.1f}s-{time_range[1]:.1f}s)")

    return scenes


def load_and_merge(
    output_dir: str | Path,
    video_name: str,
    temporal: TemporalAnalysis | None = None,
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> list[Scene]:
    """Load frame data from disk and run scene merger. Convenience wrapper."""
    out = Path(output_dir)
    quant_path = out / f"{video_name}_frame_quant.json"
    qual_path = out / f"{video_name}_frame_qual.json"

    quants = [FrameQuant.model_validate(d) for d in json.loads(quant_path.read_text())]
    quals = [FrameQual.model_validate(d) for d in json.loads(qual_path.read_text())]

    return asyncio.run(merge_scenes(quants, quals, temporal=temporal, scene_boundaries=scene_boundaries))
