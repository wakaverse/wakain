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
    TemporalAnalysis,
    VisualSummary,
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


MIN_SCENE_DURATION = 1.5  # seconds — short scenes get absorbed into neighbours

def _group_frames(
    quants: list[FrameQuant], quals: list[FrameQual],
    temporal: TemporalAnalysis | None = None,
) -> list[list[int]]:
    """Group consecutive frame indices with similar shot_type + subject_type.

    A new group starts only when BOTH shot_type AND subject_type change,
    OR when there is a significant visual cut (high edge_diff + color_diff).
    Relaxed criteria to avoid over-splitting short-form videos.

    When temporal data is available, also split on:
    - energy peaks (climax moments are natural scene boundaries)
    - hard_cut transitions detected by transition texture analysis
    """
    if not quals:
        return []

    # Build sets of timestamps where temporal analysis suggests a boundary
    temporal_cut_timestamps: set[float] = set()
    if temporal:
        # Energy peaks are natural scene boundaries
        for ts in temporal.energy_curve.peak_timestamps:
            temporal_cut_timestamps.add(ts)
        # Hard cuts from transition texture
        for ev in temporal.transition_texture.events:
            if ev.type == "hard_cut":
                temporal_cut_timestamps.add(ev.timestamp)

    groups: list[list[int]] = [[0]]
    for i in range(1, len(quals)):
        prev = quals[i - 1]
        curr = quals[i]
        quant = quants[i]

        shot_changed = curr.shot_type != prev.shot_type
        subject_changed = curr.subject_type != prev.subject_type
        big_cut = quant.edge_diff > 40 and quant.color_diff > 0.8

        # Temporal-informed boundary: if shot OR subject changed AND temporal
        # analysis confirms a cut/peak at this timestamp
        temporal_boundary = (
            (shot_changed or subject_changed)
            and quant.timestamp in temporal_cut_timestamps
        )

        # Only split when BOTH shot and subject change, or on a hard visual cut,
        # or when temporal analysis confirms a boundary with at least one change
        if (shot_changed and subject_changed) or big_cut or temporal_boundary:
            groups.append([i])
        else:
            groups[-1].append(i)

    return groups


def _merge_short_scenes(
    groups: list[list[int]], quants: list[FrameQuant],
) -> list[list[int]]:
    """Absorb scenes shorter than MIN_SCENE_DURATION into their neighbours."""
    if len(groups) <= 1:
        return groups

    def _duration(group: list[int]) -> float:
        ts_start = quants[group[0]].timestamp
        ts_end = quants[group[-1]].timestamp + 0.5
        return ts_end - ts_start

    merged = True
    while merged:
        merged = False
        new_groups: list[list[int]] = []
        i = 0
        while i < len(groups):
            if _duration(groups[i]) < MIN_SCENE_DURATION and len(groups) > 1:
                # Absorb into the neighbour with shorter duration (prefer previous)
                if new_groups:
                    new_groups[-1].extend(groups[i])
                    merged = True
                elif i + 1 < len(groups):
                    groups[i + 1] = groups[i] + groups[i + 1]
                    merged = True
                else:
                    new_groups.append(groups[i])
            else:
                new_groups.append(groups[i])
            i += 1
        groups = new_groups

    return groups


# ── Compute visual/content summaries from frame data ───────────────────────


def _compute_visual_summary(
    quants: list[FrameQuant], quals: list[FrameQual],
) -> dict:
    """Compute visual_summary fields from grouped frames (without LLM fields)."""
    # Dominant shot = most common shot_type
    shot_counts = Counter(q.shot_type for q in quals)
    dominant_shot = shot_counts.most_common(1)[0][0]

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

    return {
        "dominant_shot": dominant_shot,
        "cut_count": cut_count,
        "avg_cut_interval": round(avg_cut_interval, 2),
        "motion_level": motion_level,
        "color_consistency": color_consistency,
        "color_mood": color_mood,
    }


def _compute_content_summary(
    quals: list[FrameQual],
) -> dict:
    """Compute content_summary fields from grouped frames."""
    subject_counts = Counter(q.subject_type for q in quals)
    subject_type = subject_counts.most_common(1)[0][0]

    vis_counts = Counter(q.product_presentation.visibility for q in quals)
    product_visibility = vis_counts.most_common(1)[0][0]

    text_overlays: list[str] = []
    seen: set[str] = set()
    for q in quals:
        if q.text_overlay and q.text_overlay.content:
            content = q.text_overlay.content.strip()
            if content and content not in seen:
                seen.add(content)
                text_overlays.append(content)

    return {
        "subject_type": subject_type,
        "product_visibility": product_visibility,
        "text_overlays": text_overlays,
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
) -> list[Scene]:
    """Merge frames into scenes and assign roles via Gemini."""
    groups = _group_frames(quants, quals, temporal=temporal)
    if not groups:
        return []

    # Absorb short scenes into neighbours
    groups = _merge_short_scenes(groups, quants)

    client = _make_client()
    scenes: list[Scene] = []

    for scene_idx, frame_indices in enumerate(groups):
        grp_quants = [quants[i] for i in frame_indices]
        grp_quals = [quals[i] for i in frame_indices]

        ts_start = grp_quants[0].timestamp
        ts_end = grp_quants[-1].timestamp + 0.5
        duration = round(ts_end - ts_start, 2)
        time_range = [round(ts_start, 2), round(ts_end, 2)]

        visual_summary = _compute_visual_summary(grp_quants, grp_quals)
        content_summary = _compute_content_summary(grp_quals)

        # LLM assigns role + effectiveness
        llm_result = await _assign_role_and_signals(
            client, scene_idx, len(groups),
            time_range, visual_summary, content_summary,
        )

        content_summary["key_action"] = llm_result.get("key_action", "")

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
        )
        scenes.append(scene)
        print(f"  ✓ Scene {scene_idx+1}/{len(groups)}: {scene.role} ({time_range[0]:.1f}s-{time_range[1]:.1f}s)")

    return scenes


def load_and_merge(
    output_dir: str | Path,
    video_name: str,
    temporal: TemporalAnalysis | None = None,
) -> list[Scene]:
    """Load frame data from disk and run scene merger. Convenience wrapper."""
    out = Path(output_dir)
    quant_path = out / f"{video_name}_frame_quant.json"
    qual_path = out / f"{video_name}_frame_qual.json"

    quants = [FrameQuant.model_validate(d) for d in json.loads(quant_path.read_text())]
    quals = [FrameQual.model_validate(d) for d in json.loads(qual_path.read_text())]

    return asyncio.run(merge_scenes(quants, quals, temporal=temporal))
