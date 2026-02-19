"""Phase 3: Scene aggregator — group frames into scenes (pure local, no API calls).

Reads frame_quant + frame_qual + temporal results, groups frames using
PySceneDetect boundaries (or heuristic fallback) into scenes.
No LLM calls — runs in near-zero seconds.
"""

from __future__ import annotations

from collections import Counter

from .schemas import (
    ContentSummary,
    EffectivenessSignals,
    FrameQual,
    FrameQuant,
    Scene,
    SceneArtwork,
    SceneEnergy,
    SceneHumanElement,
    SceneTextOverlay,
    TemporalAnalysis,
    VisualSummary,
    ZoomEvent,
)


# ── Frame grouping ──────────────────────────────────────────────────────────


def _group_frames_by_scene_boundaries(
    quants: list[FrameQuant],
    scene_boundaries: list[tuple[float, float]],
) -> list[list[int]]:
    """Group frame indices using PySceneDetect scene boundaries."""
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
    """Fallback: group by shot_type + subject_type changes."""
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
    """Compute visual_summary fields from grouped frames (no LLM)."""
    shot_counts = Counter(q.shot_type for q in quals)
    dominant_shot = shot_counts.most_common(1)[0][0]

    shot_sequence = [q.shot_type for q in quals]

    layout_counts = Counter(q.composition.layout for q in quals)
    composition = layout_counts.most_common(1)[0][0]

    cut_count = sum(1 for q in quants[1:] if q.edge_diff > 30)

    ts_start = quants[0].timestamp
    ts_end = quants[-1].timestamp
    duration = ts_end - ts_start + 0.5
    avg_cut_interval = duration / max(cut_count, 1)

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

    avg_cdiff = sum(q.color_diff for q in quants) / len(quants)
    color_consistency = round(max(0.0, min(1.0, 1.0 - avg_cdiff)), 2)

    mood_counts = Counter(q.color_mood for q in quals)
    color_mood = mood_counts.most_common(1)[0][0]

    color_ratios: dict[str, float] = {}
    for q in quants:
        for dc in q.dominant_colors:
            color_ratios[dc.hex] = color_ratios.get(dc.hex, 0.0) + dc.ratio
    top_colors = sorted(color_ratios.items(), key=lambda x: x[1], reverse=True)[:3]
    color_palette = [hex_code for hex_code, _ in top_colors]

    zoom_events: list[dict] = []
    transition_in = "none"
    transition_out = "none"

    if temporal and time_range:
        s_start, s_end = time_range

        for z in temporal.zoom_events:
            if z.time_range[0] >= s_start and z.time_range[1] <= s_end:
                zoom_events.append(z.model_dump())

        for evt in temporal.transition_texture.events:
            if abs(evt.timestamp - s_start) <= 0.6:
                transition_in = evt.type
                break

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

    angle_counts = Counter(q.product_presentation.angle for q in quals)
    product_angle = angle_counts.most_common(1)[0][0]

    context_counts = Counter(q.product_presentation.context for q in quals)
    product_context = context_counts.most_common(1)[0][0]

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


# ── Artwork aggregation ──────────────────────────────────────────────────────


def _compute_scene_artwork(quals: list[FrameQual]) -> SceneArtwork | None:
    """Aggregate FrameArtwork data across frames into a SceneArtwork."""
    artwork_frames = [q for q in quals if q.artwork is not None]
    if not artwork_frames:
        return None

    # Typography: most common font family, weight, colors
    typo_frames = [q for q in artwork_frames if q.artwork.typography is not None]
    typography_style = None
    typography_weight = None
    text_color_primary = None
    text_color_highlight = None
    has_text_background = False
    text_bg_color = None

    if typo_frames:
        family_counts = Counter(q.artwork.typography.font_family for q in typo_frames)
        typography_style = family_counts.most_common(1)[0][0]

        weight_counts = Counter(q.artwork.typography.font_weight for q in typo_frames)
        typography_weight = weight_counts.most_common(1)[0][0]

        color_counts = Counter(q.artwork.typography.font_color for q in typo_frames)
        text_color_primary = color_counts.most_common(1)[0][0]

        highlight_colors = [q.artwork.typography.highlight_color for q in typo_frames if q.artwork.typography.highlight_color]
        if highlight_colors:
            hl_counts = Counter(highlight_colors)
            text_color_highlight = hl_counts.most_common(1)[0][0]

        bg_frames = [q for q in typo_frames if q.artwork.typography.has_background]
        has_text_background = len(bg_frames) > len(typo_frames) / 2
        if bg_frames:
            bg_colors = [q.artwork.typography.background_color for q in bg_frames if q.artwork.typography.background_color]
            if bg_colors:
                bg_counts = Counter(bg_colors)
                text_bg_color = bg_counts.most_common(1)[0][0]

    # Graphic elements: union of all unique elements
    all_elements: set[str] = set()
    for q in artwork_frames:
        for elem in q.artwork.graphic_elements:
            if elem != "none":
                all_elements.add(elem)
    graphic_elements = sorted(all_elements)

    # Layout: most common zone pattern
    layout_patterns: list[str] = []
    overlap_count = 0
    for q in artwork_frames:
        lz = q.artwork.layout_zones
        pattern = f"{lz.top}-top/{lz.middle}-middle/{lz.bottom}-bottom"
        layout_patterns.append(pattern)
        if lz.text_product_overlap:
            overlap_count += 1

    layout_counts = Counter(layout_patterns)
    dominant_layout = layout_counts.most_common(1)[0][0] if layout_patterns else ""
    text_product_overlap = overlap_count > len(artwork_frames) / 2

    # Color: most common primary/accent colors
    primary_counts = Counter(q.artwork.color_design.primary_color for q in artwork_frames)
    primary_color = primary_counts.most_common(1)[0][0]

    accent_colors = [q.artwork.color_design.accent_color for q in artwork_frames if q.artwork.color_design.accent_color]
    accent_color = None
    if accent_colors:
        accent_counts = Counter(accent_colors)
        accent_color = accent_counts.most_common(1)[0][0]

    contrast_counts = Counter(q.artwork.color_design.text_bg_contrast for q in artwork_frames)
    contrast_level = contrast_counts.most_common(1)[0][0]

    harmony_counts = Counter(q.artwork.color_design.color_harmony for q in artwork_frames)
    color_harmony = harmony_counts.most_common(1)[0][0] if harmony_counts else None

    return SceneArtwork(
        typography_style=typography_style,
        typography_weight=typography_weight,
        text_color_primary=text_color_primary,
        text_color_highlight=text_color_highlight,
        has_text_background=has_text_background,
        text_bg_color=text_bg_color,
        graphic_elements=graphic_elements,
        dominant_layout=dominant_layout,
        text_product_overlap=text_product_overlap,
        primary_color=primary_color,
        accent_color=accent_color,
        contrast_level=contrast_level,
        color_harmony=color_harmony,
    )


# ── Public API ──────────────────────────────────────────────────────────────


def aggregate_scenes(
    quants: list[FrameQuant],
    quals: list[FrameQual],
    temporal: TemporalAnalysis | None = None,
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> list[Scene]:
    """Aggregate frames into scenes. Pure local computation — no API calls.

    Role is set to 'transition' as a placeholder; Phase 5 (scene_merger)
    assigns the real role from Phase 4 video analysis.
    """
    if scene_boundaries:
        groups = _group_frames_by_scene_boundaries(quants, scene_boundaries)
    else:
        groups = _group_frames_fallback(quants, quals)
    if not groups:
        return []

    scenes: list[Scene] = []

    for scene_idx, frame_indices in enumerate(groups):
        grp_quants = [quants[i] for i in frame_indices]
        grp_quals = [quals[i] for i in frame_indices]

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

        energy = None
        if temporal:
            energy_data = _compute_scene_energy(temporal, time_range)
            if energy_data:
                energy = SceneEnergy(**energy_data)

        artwork = _compute_scene_artwork(grp_quals)

        scene = Scene(
            scene_id=scene_idx + 1,
            role="transition",  # placeholder; Phase 5 assigns real role
            time_range=time_range,
            duration=duration,
            visual_summary=VisualSummary(**visual_summary),
            content_summary=ContentSummary(**content_summary),
            effectiveness_signals=EffectivenessSignals(
                hook_strength="none",
                information_density="medium",
                emotional_trigger="none",
            ),
            energy=energy,
            artwork=artwork,
        )
        scenes.append(scene)
        print(f"  ✓ Scene {scene_idx+1}/{len(groups)}: aggregated ({time_range[0]:.1f}s-{time_range[1]:.1f}s)")

    return scenes
