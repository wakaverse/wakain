"""Phase 2.5: Temporal analyzer — time-series analysis of frame data.

Pure local computation (no API calls, cost = 0).
Analyses frame_quant + frame_qual data as time series to extract
energy curves, cut rhythms, zoom events, B-roll segments, etc.
"""

from __future__ import annotations

from collections import Counter
from typing import Optional

from .schemas import (
    AttentionCurve,
    AttentionPoint,
    BRollSegment,
    CaptionPattern,
    ColorChangeCurve,
    ColorChangePoint,
    ColorShift,
    CutRhythm,
    ExposureCurve,
    ExposureSegment,
    FrameQual,
    FrameQuant,
    PlaybackSpeedSegment,
    ShotTransition,
    TemporalAnalysis,
    TextDwellAnalysis,
    TextDwellItem,
    TransitionEvent,
    TransitionTexture,
    VisualJourney,
    ZoomEvent,
)

# Frame interval assumed from 2fps extraction
FRAME_INTERVAL = 0.5

# ── 1. Attention Curve ───────────────────────────────────────────────────────


def _analyse_attention(quants: list[FrameQuant]) -> AttentionCurve:
    """Per-frame attention score (0-100) from edge_diff + color_diff + brightness delta."""
    if not quants:
        return AttentionCurve(
            points=[], peak_timestamps=[], attention_avg=0, attention_arc="flat",
        )

    points: list[AttentionPoint] = []
    for i, q in enumerate(quants):
        # Normalize components to 0-1 range
        edge_norm = min(q.edge_diff / 60.0, 1.0)  # 60 is high edge_diff
        color_norm = min(q.color_diff / 1.5, 1.0)  # 1.5 is high color_diff
        brightness_delta = 0.0
        if i > 0:
            brightness_delta = abs(q.brightness - quants[i - 1].brightness)
        bright_norm = min(brightness_delta / 0.3, 1.0)

        raw = edge_norm * 0.4 + color_norm * 0.4 + bright_norm * 0.2
        score = int(round(raw * 100))

        if score > 75:
            section = "클라이막스"
        elif score > 45:
            section = "강"
        elif score > 20:
            section = "중"
        else:
            section = "정적"

        points.append(AttentionPoint(
            timestamp=q.timestamp, score=score, section=section,
        ))

    # Find peaks: local maxima above threshold
    scores = [p.score for p in points]
    attention_avg = int(round(sum(scores) / len(scores)))

    peak_timestamps: list[float] = []
    for i in range(1, len(scores) - 1):
        if scores[i] > scores[i - 1] and scores[i] > scores[i + 1] and scores[i] > 50:
            peak_timestamps.append(points[i].timestamp)
    # Also check first and last
    if len(scores) >= 2 and scores[0] > scores[1] and scores[0] > 50:
        peak_timestamps.insert(0, points[0].timestamp)
    if len(scores) >= 2 and scores[-1] > scores[-2] and scores[-1] > 50:
        peak_timestamps.append(points[-1].timestamp)

    # Determine attention arc
    n = len(scores)
    if n < 4:
        attention_arc = "flat"
    else:
        first_quarter = sum(scores[: n // 4]) / max(n // 4, 1)
        last_quarter = sum(scores[3 * n // 4 :]) / max(n - 3 * n // 4, 1)
        mid_peak = max(scores[n // 4 : 3 * n // 4]) if n > 2 else attention_avg

        if mid_peak > first_quarter * 1.5 and mid_peak > last_quarter * 1.5:
            attention_arc = "building→peak→fade"
        elif last_quarter > first_quarter * 1.3:
            attention_arc = "building"
        elif first_quarter > last_quarter * 1.3:
            attention_arc = "fading"
        elif attention_avg > 45:
            attention_arc = "sustained_high"
        elif attention_avg < 20:
            attention_arc = "sustained_low"
        else:
            attention_arc = "flat"

    return AttentionCurve(
        points=points,
        peak_timestamps=peak_timestamps,
        attention_avg=attention_avg,
        attention_arc=attention_arc,
    )


# ── 2. Cut Rhythm Pattern ───────────────────────────────────────────────────


def _analyse_cut_rhythm(
    quants: list[FrameQuant],
    cut_timestamps: list[float] | None = None,
) -> CutRhythm:
    """Intervals between cuts, classify rhythm pattern.

    When cut_timestamps is provided (from PySceneDetect), use those directly.
    Otherwise falls back to edge_diff > 40 heuristic.
    """
    if cut_timestamps is None:
        cut_timestamps = []
        for q in quants:
            if q.edge_diff > 40:
                cut_timestamps.append(q.timestamp)

    if len(cut_timestamps) < 2:
        return CutRhythm(
            cut_timestamps=cut_timestamps,
            intervals=[],
            pattern="constant",
            avg_interval=0.0,
            min_interval=0.0,
            max_interval=0.0,
            total_cuts=len(cut_timestamps),
        )

    intervals = [
        round(cut_timestamps[i + 1] - cut_timestamps[i], 2)
        for i in range(len(cut_timestamps) - 1)
    ]

    avg_interval = round(sum(intervals) / len(intervals), 2)
    min_interval = round(min(intervals), 2)
    max_interval = round(max(intervals), 2)

    # Classify pattern: compare first half intervals to second half
    mid = len(intervals) // 2
    if mid == 0:
        pattern = "constant"
    else:
        first_half_avg = sum(intervals[:mid]) / mid
        second_half_avg = sum(intervals[mid:]) / max(len(intervals) - mid, 1)

        if first_half_avg > second_half_avg * 1.3:
            pattern = "accelerating"
        elif second_half_avg > first_half_avg * 1.3:
            pattern = "decelerating"
        elif max_interval > avg_interval * 2.0:
            pattern = "irregular"
        else:
            pattern = "constant"

    return CutRhythm(
        cut_timestamps=cut_timestamps,
        intervals=intervals,
        pattern=pattern,
        avg_interval=avg_interval,
        min_interval=min_interval,
        max_interval=max_interval,
        total_cuts=len(cut_timestamps),
    )


# ── 3. Playback Speed Detection ─────────────────────────────────────────────


def _analyse_playback_speed(quants: list[FrameQuant]) -> list[PlaybackSpeedSegment]:
    """Detect slow-motion and timelapse segments."""
    if len(quants) < 3:
        return []

    segments: list[PlaybackSpeedSegment] = []
    current_type = "normal"
    segment_start = quants[0].timestamp
    edge_diffs: list[float] = []
    WINDOW = 3  # Minimum consecutive frames for a speed segment

    def _classify_speed(avg_ed: float) -> str:
        if avg_ed < 2.0:
            return "slow_motion"
        elif avg_ed > 45.0:
            return "timelapse"
        return "normal"

    for i, q in enumerate(quants):
        edge_diffs.append(q.edge_diff)

        if len(edge_diffs) >= WINDOW:
            recent_avg = sum(edge_diffs[-WINDOW:]) / WINDOW
            frame_type = _classify_speed(recent_avg)

            if frame_type != current_type:
                if current_type != "normal" and len(edge_diffs) >= WINDOW:
                    avg_ed = sum(edge_diffs[:-1]) / max(len(edge_diffs) - 1, 1)
                    segments.append(PlaybackSpeedSegment(
                        time_range=[round(segment_start, 2), round(quants[i - 1].timestamp, 2)],
                        type=current_type,
                        avg_edge_diff=round(avg_ed, 2),
                    ))
                current_type = frame_type
                segment_start = q.timestamp
                edge_diffs = [q.edge_diff]

    # Close final segment
    if current_type != "normal" and len(edge_diffs) >= WINDOW:
        avg_ed = sum(edge_diffs) / len(edge_diffs)
        segments.append(PlaybackSpeedSegment(
            time_range=[round(segment_start, 2), round(quants[-1].timestamp, 2)],
            type=current_type,
            avg_edge_diff=round(avg_ed, 2),
        ))

    return segments


# ── 4. Text Dwell Time ──────────────────────────────────────────────────────


def _analyse_text_dwell(quals: list[FrameQual]) -> TextDwellAnalysis:
    """Track OCR text changes over time, compute per-text duration."""
    items: list[TextDwellItem] = []
    active_texts: dict[str, dict] = {}  # content -> {first_appear, last_appear, position}

    for q in quals:
        content = ""
        position = "none"
        if q.text_overlay and q.text_overlay.content:
            content = q.text_overlay.content.strip()
        if q.text_overlay:
            position = q.text_overlay.purpose

        if content:
            if content not in active_texts:
                active_texts[content] = {
                    "first_appear": q.timestamp,
                    "last_appear": q.timestamp,
                    "position": position,
                }
            else:
                active_texts[content]["last_appear"] = q.timestamp

    for content, info in active_texts.items():
        duration = info["last_appear"] - info["first_appear"] + FRAME_INTERVAL
        items.append(TextDwellItem(
            content=content,
            first_appear=round(info["first_appear"], 2),
            last_appear=round(info["last_appear"], 2),
            duration=round(duration, 2),
            position=info["position"],
        ))

    total_duration = 0.0
    if quals:
        total_duration = quals[-1].timestamp - quals[0].timestamp + FRAME_INTERVAL

    total_text_time = sum(it.duration for it in items)
    texts_per_second = round(
        len(items) / total_duration if total_duration > 0 else 0, 3,
    )

    return TextDwellAnalysis(
        items=items,
        texts_per_second=texts_per_second,
        total_text_screen_time=round(total_text_time, 2),
    )


# ── 5. Visual Journey (Gaze Flow) ───────────────────────────────────────────


def _analyse_visual_journey(quals: list[FrameQual]) -> VisualJourney:
    """Shot_type sequence over time with transitions."""
    if not quals:
        return VisualJourney(
            shot_sequence=[], transitions=[], dominant_pattern="none",
            transition_counts={},
        )

    shot_sequence: list[str] = [quals[0].shot_type]
    transitions: list[ShotTransition] = []
    transition_counter: Counter = Counter()

    for i in range(1, len(quals)):
        prev_shot = quals[i - 1].shot_type
        curr_shot = quals[i].shot_type
        shot_sequence.append(curr_shot)

        if curr_shot != prev_shot:
            key = f"{prev_shot}→{curr_shot}"
            transition_counter[key] += 1
            transitions.append(ShotTransition(
                timestamp=quals[i].timestamp,
                from_shot=prev_shot,
                to_shot=curr_shot,
            ))

    # Dominant pattern
    if transition_counter:
        top = transition_counter.most_common(3)
        dominant_pattern = " / ".join(f"{k} ({v}x)" for k, v in top)
    else:
        dominant_pattern = f"static {shot_sequence[0]}" if shot_sequence else "none"

    return VisualJourney(
        shot_sequence=shot_sequence,
        transitions=transitions,
        dominant_pattern=dominant_pattern,
        transition_counts=dict(transition_counter),
    )


# ── 6. Product/Human Exposure Curve ─────────────────────────────────────────


def _analyse_exposure(
    quants: list[FrameQuant], quals: list[FrameQual],
) -> ExposureCurve:
    """Per-segment human vs product exposure ratios."""
    if not quals:
        return ExposureCurve(
            segments=[], total_human_time_ratio=0.0,
            total_product_time_ratio=0.0, circulation_pattern="none",
        )

    # Group into ~2s segments (4 frames at 2fps)
    SEGMENT_SIZE = 4
    segments: list[ExposureSegment] = []
    sequence: list[str] = []  # 'human', 'product', 'both', 'neither'

    for start in range(0, len(quals), SEGMENT_SIZE):
        chunk_quals = quals[start : start + SEGMENT_SIZE]
        chunk_quants = quants[start : start + SEGMENT_SIZE]

        human_count = sum(
            1 for q in chunk_quals
            if q.subject_type in ("person_with_product", "person_only")
        )
        product_count = sum(
            1 for q in chunk_quals
            if q.product_presentation.visibility not in ("hidden", "glimpse")
        )

        n = len(chunk_quals)
        human_ratio = round(human_count / n, 2) if n else 0
        product_ratio = round(product_count / n, 2) if n else 0

        t_start = chunk_quants[0].timestamp
        t_end = chunk_quants[-1].timestamp + FRAME_INTERVAL

        segments.append(ExposureSegment(
            time_range=[round(t_start, 2), round(t_end, 2)],
            human_ratio=human_ratio,
            product_ratio=product_ratio,
        ))

        # Track circulation
        if human_ratio > 0.5 and product_ratio > 0.5:
            sequence.append("both")
        elif human_ratio > 0.5:
            sequence.append("human")
        elif product_ratio > 0.5:
            sequence.append("product")
        else:
            sequence.append("neither")

    # Total ratios
    total_human = sum(
        1 for q in quals
        if q.subject_type in ("person_with_product", "person_only")
    )
    total_product = sum(
        1 for q in quals
        if q.product_presentation.visibility not in ("hidden", "glimpse")
    )
    n_total = len(quals)

    # Detect circulation pattern
    simplified = []
    for s in sequence:
        if not simplified or simplified[-1] != s:
            simplified.append(s)

    label_map = {"human": "사람", "product": "제품", "both": "제품+사람", "neither": "기타"}
    circulation = "→".join(label_map.get(s, s) for s in simplified)

    return ExposureCurve(
        segments=segments,
        total_human_time_ratio=round(total_human / n_total, 3) if n_total else 0,
        total_product_time_ratio=round(total_product / n_total, 3) if n_total else 0,
        circulation_pattern=circulation or "none",
    )


# ── 7. Color Change Curve ───────────────────────────────────────────────────


def _analyse_color_change(quants: list[FrameQuant]) -> ColorChangeCurve:
    """Brightness + saturation time series with shift detection."""
    points = [
        ColorChangePoint(
            timestamp=q.timestamp,
            brightness=round(q.brightness, 3),
            saturation=round(q.saturation, 3),
        )
        for q in quants
    ]

    shifts: list[ColorShift] = []
    for i in range(1, len(quants)):
        b_delta = quants[i].brightness - quants[i - 1].brightness
        s_delta = quants[i].saturation - quants[i - 1].saturation

        if abs(b_delta) > 0.1 or abs(s_delta) > 0.1:
            shift_type = "abrupt" if abs(b_delta) > 0.2 or abs(s_delta) > 0.2 else "gradual"
            shifts.append(ColorShift(
                timestamp=quants[i].timestamp,
                type=shift_type,
                brightness_delta=round(b_delta, 3),
                saturation_delta=round(s_delta, 3),
            ))

    # Overall pattern
    if not quants:
        pattern = "consistent"
    else:
        brightness_vals = [q.brightness for q in quants]
        b_std = _std(brightness_vals)
        b_first = sum(brightness_vals[: len(brightness_vals) // 3 + 1]) / max(len(brightness_vals) // 3, 1)
        b_last = sum(brightness_vals[2 * len(brightness_vals) // 3 :]) / max(len(brightness_vals) - 2 * len(brightness_vals) // 3, 1)

        sat_vals = [q.saturation for q in quants]
        s_std = _std(sat_vals)

        abrupt_count = sum(1 for s in shifts if s.type == "abrupt")

        if b_std < 0.05 and s_std < 0.05:
            pattern = "consistent"
        elif abrupt_count > 3:
            pattern = "high_variance"
        elif b_last > b_first + 0.1:
            pattern = "dark_to_bright"
        elif b_first > b_last + 0.1:
            pattern = "bright_to_dark"
        elif sum(s.saturation_delta for s in shifts) > 0.15:
            pattern = "gradual_warm"
        elif sum(s.saturation_delta for s in shifts) < -0.15:
            pattern = "gradual_cool"
        else:
            pattern = "consistent"

    return ColorChangeCurve(points=points, shifts=shifts, overall_pattern=pattern)


def _std(values: list[float]) -> float:
    """Simple standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return variance ** 0.5


# ── 8. B-Roll Detection ─────────────────────────────────────────────────────


def _detect_broll(
    quants: list[FrameQuant], quals: list[FrameQual],
) -> list[BRollSegment]:
    """Frames with lifestyle/text_graphic subject, no face, low subject_area_ratio."""
    broll_indices: list[int] = []

    for i, (quant, qual) in enumerate(zip(quants, quals)):
        is_broll_subject = qual.subject_type in ("lifestyle_scene", "text_graphic")
        no_face = not quant.face_detected
        low_subject = quant.subject_area_ratio < 0.3

        if is_broll_subject and no_face and low_subject:
            broll_indices.append(i)

    # Group consecutive indices into segments
    segments: list[BRollSegment] = []
    if not broll_indices:
        return segments

    seg_start = broll_indices[0]
    seg_end = broll_indices[0]

    for idx in broll_indices[1:]:
        if idx == seg_end + 1:
            seg_end = idx
        else:
            segments.append(BRollSegment(
                time_range=[
                    round(quants[seg_start].timestamp, 2),
                    round(quants[seg_end].timestamp + FRAME_INTERVAL, 2),
                ],
                frame_count=seg_end - seg_start + 1,
                reason=f"{quals[seg_start].subject_type}, no face, low subject area",
            ))
            seg_start = idx
            seg_end = idx

    # Close last segment
    segments.append(BRollSegment(
        time_range=[
            round(quants[seg_start].timestamp, 2),
            round(quants[seg_end].timestamp + FRAME_INTERVAL, 2),
        ],
        frame_count=seg_end - seg_start + 1,
        reason=f"{quals[seg_start].subject_type}, no face, low subject area",
    ))

    return segments


# ── 9. Zoom/Scale Detection ─────────────────────────────────────────────────


def _detect_zoom(quants: list[FrameQuant]) -> list[ZoomEvent]:
    """Track subject_area_ratio changes between consecutive frames."""
    events: list[ZoomEvent] = []
    MIN_CHANGE = 0.05  # Minimum change to register
    MIN_FRAMES = 2  # Minimum consecutive frames in same direction

    if len(quants) < 2:
        return events

    streak_dir: Optional[str] = None
    streak_start = 0
    streak_changes: list[float] = []

    for i in range(1, len(quants)):
        delta = quants[i].subject_area_ratio - quants[i - 1].subject_area_ratio

        if abs(delta) < 0.02:
            # No significant change — end streak if active
            if streak_dir and len(streak_changes) >= MIN_FRAMES:
                total_change = sum(streak_changes)
                if abs(total_change) >= MIN_CHANGE:
                    events.append(ZoomEvent(
                        time_range=[
                            round(quants[streak_start].timestamp, 2),
                            round(quants[i - 1].timestamp, 2),
                        ],
                        direction="zoom_in" if total_change > 0 else "zoom_out",
                        scale_change=round(abs(total_change), 3),
                    ))
            streak_dir = None
            streak_changes = []
            continue

        direction = "in" if delta > 0 else "out"

        if streak_dir == direction:
            streak_changes.append(delta)
        else:
            # Direction changed — close previous streak
            if streak_dir and len(streak_changes) >= MIN_FRAMES:
                total_change = sum(streak_changes)
                if abs(total_change) >= MIN_CHANGE:
                    events.append(ZoomEvent(
                        time_range=[
                            round(quants[streak_start].timestamp, 2),
                            round(quants[i - 1].timestamp, 2),
                        ],
                        direction="zoom_in" if total_change > 0 else "zoom_out",
                        scale_change=round(abs(total_change), 3),
                    ))
            streak_dir = direction
            streak_start = i - 1
            streak_changes = [delta]

    # Close final streak
    if streak_dir and len(streak_changes) >= MIN_FRAMES:
        total_change = sum(streak_changes)
        if abs(total_change) >= MIN_CHANGE:
            events.append(ZoomEvent(
                time_range=[
                    round(quants[streak_start].timestamp, 2),
                    round(quants[-1].timestamp, 2),
                ],
                direction="zoom_in" if total_change > 0 else "zoom_out",
                scale_change=round(abs(total_change), 3),
            ))

    return events


# ── 10. Caption Layout Pattern ───────────────────────────────────────────────


def _analyse_caption_pattern(quants: list[FrameQuant]) -> CaptionPattern:
    """Track text_region position + area_ratio over time."""
    timeline: list[dict] = []
    positions: list[str] = []

    for q in quants:
        if q.text_region.detected:
            timeline.append({
                "timestamp": q.timestamp,
                "position": q.text_region.position,
                "area_ratio": q.text_region.area_ratio,
            })
            positions.append(q.text_region.position)

    if not positions:
        return CaptionPattern(
            position_preference="mixed",
            avg_area_ratio=0.0,
            position_timeline=[],
        )

    pos_counts = Counter(positions)
    top_pos = pos_counts.most_common(1)[0][0]

    pos_map = {
        "top_third": "top",
        "middle_third": "middle",
        "bottom_third": "bottom",
        "full": "mixed",
        "none": "mixed",
    }
    position_preference = pos_map.get(top_pos, "mixed")

    # If no single position dominates (>60%), mark as mixed
    if pos_counts.most_common(1)[0][1] < len(positions) * 0.6:
        position_preference = "mixed"

    avg_area = round(
        sum(t["area_ratio"] for t in timeline) / len(timeline), 3,
    )

    return CaptionPattern(
        position_preference=position_preference,
        avg_area_ratio=avg_area,
        position_timeline=timeline,
    )


# ── 11. Scene Transition Texture ─────────────────────────────────────────────


def _analyse_transitions(
    quants: list[FrameQuant],
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> TransitionTexture:
    """Classify transitions by edge_diff + color_diff + subject_area_ratio signature.

    When scene_boundaries is provided (from PySceneDetect), only look at
    frames near known scene cuts for transition classification. Otherwise
    falls back to threshold-based detection.
    """
    events: list[TransitionEvent] = []

    # Build set of known cut timestamps from scene boundaries
    cut_times: set[float] | None = None
    if scene_boundaries and len(scene_boundaries) > 1:
        cut_times = set()
        for i in range(1, len(scene_boundaries)):
            cut_times.add(scene_boundaries[i][0])

    for i in range(1, len(quants)):
        q = quants[i]
        prev = quants[i - 1]

        if cut_times is not None:
            # Only classify transitions at known cut points.
            # A 2fps frame is "near" a cut if the cut falls between
            # the previous frame's timestamp and this frame's timestamp.
            is_near_cut = any(
                prev.timestamp <= ct <= q.timestamp for ct in cut_times
            )
            if not is_near_cut:
                continue
        else:
            # Fallback: only consider frames with some visual change
            if q.edge_diff < 15 and q.color_diff < 0.3:
                continue

        area_change = abs(q.subject_area_ratio - prev.subject_area_ratio)

        # Classify transition type using frame data characteristics
        if q.edge_diff > 40 and q.color_diff > 0.6:
            t_type = "hard_cut"
        elif area_change > 0.1 and q.edge_diff > 20:
            t_type = "zoom_transition"
        elif q.color_diff > 0.4 and q.edge_diff < 25:
            t_type = "dissolve"
        elif prev.brightness < 0.15 or q.brightness < 0.15:
            t_type = "fade"
        elif q.edge_diff > 30 and q.color_diff > 0.4:
            t_type = "hard_cut"
        else:
            t_type = "dissolve"

        events.append(TransitionEvent(
            timestamp=q.timestamp,
            type=t_type,
            edge_diff=round(q.edge_diff, 2),
            color_diff=round(q.color_diff, 3),
        ))

    type_counts: Counter = Counter(e.type for e in events)

    if not type_counts:
        dominant_type = "hard_cut"
    elif len(type_counts) == 1:
        dominant_type = type_counts.most_common(1)[0][0]
    else:
        top = type_counts.most_common(1)[0]
        total = sum(type_counts.values())
        dominant_type = top[0] if top[1] > total * 0.6 else "mixed"

    return TransitionTexture(
        events=events,
        dominant_type=dominant_type,
        type_counts=dict(type_counts),
    )


# ── Public API ───────────────────────────────────────────────────────────────


class TemporalAnalyzer:
    """Analyses frame-level data as time series. No API calls — pure local computation."""

    def __init__(
        self,
        quants: list[FrameQuant],
        quals: list[FrameQual],
        cut_timestamps: list[float] | None = None,
        scene_boundaries: list[tuple[float, float]] | None = None,
    ) -> None:
        self.quants = quants
        self.quals = quals
        self.cut_timestamps = cut_timestamps
        self.scene_boundaries = scene_boundaries

    def analyse(self) -> TemporalAnalysis:
        """Run all 11 temporal analyses and return TemporalAnalysis."""
        return TemporalAnalysis(
            attention_curve=_analyse_attention(self.quants),
            cut_rhythm=_analyse_cut_rhythm(self.quants, self.cut_timestamps),
            playback_speed=_analyse_playback_speed(self.quants),
            text_dwell=_analyse_text_dwell(self.quals),
            visual_journey=_analyse_visual_journey(self.quals),
            exposure_curve=_analyse_exposure(self.quants, self.quals),
            color_change_curve=_analyse_color_change(self.quants),
            broll_segments=_detect_broll(self.quants, self.quals),
            zoom_events=_detect_zoom(self.quants),
            caption_pattern=_analyse_caption_pattern(self.quants),
            transition_texture=_analyse_transitions(self.quants, self.scene_boundaries),
        )


def run_temporal_analysis(
    quants: list[FrameQuant],
    quals: list[FrameQual],
    cut_timestamps: list[float] | None = None,
    scene_boundaries: list[tuple[float, float]] | None = None,
) -> TemporalAnalysis:
    """Convenience function: run all temporal analyses."""
    return TemporalAnalyzer(
        quants, quals,
        cut_timestamps=cut_timestamps,
        scene_boundaries=scene_boundaries,
    ).analyse()
