"""P5: TEMPORAL — 시간축·에너지 곡선 분석.

로컬 전용 (API 호출 없음).
P3(EXTRACT) 출력의 프레임별 정량 데이터 + 씬 경계를 기반으로
어텐션 곡선, 컷 리듬, 템포 레벨 등 6가지 시간축 분석을 수행한다.
"""

from __future__ import annotations

import logging

from core.schemas.enums import AttentionArc, CutRhythm, TempoLevel
from core.schemas.pipeline import (
    AttentionCurve,
    AttentionPoint,
    CutRhythmDetail,
    ExtractOutput,
    TemporalOutput,
)

logger = logging.getLogger(__name__)


# ── 1. Attention Curve ───────────────────────────────────────────────────────


def _compute_attention_curve(frames: list) -> AttentionCurve:
    """프레임별 어텐션 점수(0~100) 계산.

    score = edge_norm×0.4 + color_norm×0.4 + bright_norm×0.2
    """
    if not frames:
        return AttentionCurve(points=[], peak_timestamps=[], avg=0)

    points: list[AttentionPoint] = []
    for i, f in enumerate(frames):
        edge_norm = min(f.edge_diff / 60.0, 1.0)
        color_norm = min(f.color_diff / 1.5, 1.0)

        brightness_delta = 0.0
        if i > 0:
            brightness_delta = abs(f.brightness - frames[i - 1].brightness)
        bright_norm = min(brightness_delta / 0.3, 1.0)

        raw = edge_norm * 0.4 + color_norm * 0.4 + bright_norm * 0.2
        score = int(round(raw * 100))

        points.append(AttentionPoint(t=f.timestamp, score=score))

    scores = [p.score for p in points]
    avg = int(round(sum(scores) / len(scores)))

    # 피크 감지: 인접보다 크고 50 초과인 지점
    peak_timestamps: list[float] = []
    for i in range(1, len(scores) - 1):
        if scores[i] > scores[i - 1] and scores[i] > scores[i + 1] and scores[i] > 50:
            peak_timestamps.append(points[i].t)
    if len(scores) >= 2 and scores[0] > scores[1] and scores[0] > 50:
        peak_timestamps.insert(0, points[0].t)
    if len(scores) >= 2 and scores[-1] > scores[-2] and scores[-1] > 50:
        peak_timestamps.append(points[-1].t)

    return AttentionCurve(points=points, peak_timestamps=peak_timestamps, avg=avg)


# ── 2. Attention Arc ─────────────────────────────────────────────────────────


def _classify_attention_arc(curve: AttentionCurve) -> AttentionArc:
    """어텐션 곡선 형태 분류."""
    scores = [p.score for p in curve.points]
    n = len(scores)

    if n < 4:
        return AttentionArc.FLAT

    first_quarter = sum(scores[: n // 4]) / max(n // 4, 1)
    last_quarter = sum(scores[3 * n // 4 :]) / max(n - 3 * n // 4, 1)
    mid_peak = max(scores[n // 4 : 3 * n // 4])

    if mid_peak > first_quarter * 1.5 and mid_peak > last_quarter * 1.5:
        return AttentionArc.BUILDING_PEAK_FADE
    if last_quarter > first_quarter * 1.3:
        return AttentionArc.BUILDING
    if first_quarter > last_quarter * 1.3:
        return AttentionArc.FADING
    if curve.avg > 45:
        return AttentionArc.SUSTAINED_HIGH
    if curve.avg < 20:
        return AttentionArc.SUSTAINED_LOW
    return AttentionArc.FLAT


# ── 3. Cut Rhythm ────────────────────────────────────────────────────────────


def _compute_cut_rhythm(
    scene_boundaries: list[list[float]],
    total_duration: float,
) -> CutRhythmDetail:
    """씬 경계 기반 컷 간격 분석 + 3초 슬라이딩 윈도우 밀도."""
    if len(scene_boundaries) < 2:
        return CutRhythmDetail(
            intervals=[],
            pattern=CutRhythm.REGULAR,
            density_timeline=[],
        )

    # 컷 타임스탬프 = 각 씬 경계의 시작점 (첫 번째 제외)
    cut_timestamps = [seg[0] for seg in scene_boundaries[1:]]

    # 컷 간격
    intervals = [
        round(cut_timestamps[i + 1] - cut_timestamps[i], 2)
        for i in range(len(cut_timestamps) - 1)
    ]

    # 패턴 분류
    if not intervals:
        pattern = CutRhythm.REGULAR
    else:
        mid = len(intervals) // 2
        if mid == 0:
            pattern = CutRhythm.REGULAR
        else:
            first_half_avg = sum(intervals[:mid]) / mid
            second_half_avg = sum(intervals[mid:]) / max(len(intervals) - mid, 1)

            if first_half_avg > second_half_avg * 1.3:
                pattern = CutRhythm.ACCELERATING
            elif second_half_avg > first_half_avg * 1.3:
                pattern = CutRhythm.DECELERATING
            else:
                avg_interval = sum(intervals) / len(intervals)
                max_interval = max(intervals)
                if max_interval > avg_interval * 2.0:
                    pattern = CutRhythm.IRREGULAR
                else:
                    pattern = CutRhythm.REGULAR

    # 3초 슬라이딩 윈도우 밀도
    density_timeline: list[float] = []
    if total_duration > 0 and cut_timestamps:
        window = 3.0
        step = 1.0
        t = 0.0
        while t + window <= total_duration + step:
            count = sum(1 for ct in cut_timestamps if t <= ct < t + window)
            density_timeline.append(round(count / window, 2))
            t += step
            if t > total_duration:
                break

    return CutRhythmDetail(
        intervals=intervals,
        pattern=pattern,
        density_timeline=density_timeline,
    )


# ── 4~6. Aggregates ─────────────────────────────────────────────────────────


def _compute_tempo_level(avg_cut_duration: float) -> TempoLevel:
    """평균 컷 길이로 템포 레벨 결정."""
    if avg_cut_duration < 2.0:
        return TempoLevel.HIGH
    if avg_cut_duration <= 4.0:
        return TempoLevel.MEDIUM
    return TempoLevel.LOW


# ── Public API ───────────────────────────────────────────────────────────────


async def run(extract_output: ExtractOutput) -> TemporalOutput:
    """P5 실행: P3 ExtractOutput → TemporalOutput.

    Args:
        extract_output: P3의 ExtractOutput (frames + scene_boundaries)

    Returns:
        TemporalOutput
    """
    logger.info("P5 TEMPORAL 시작: %d frames, %d scenes",
                len(extract_output.frames), len(extract_output.scene_boundaries))

    # 1. Attention Curve
    attention_curve = _compute_attention_curve(extract_output.frames)

    # 2. Attention Arc
    attention_arc = _classify_attention_arc(attention_curve)

    # 3. Cut Rhythm
    total_duration = 0.0
    if extract_output.scene_boundaries:
        total_duration = extract_output.scene_boundaries[-1][-1]
    cut_rhythm = _compute_cut_rhythm(extract_output.scene_boundaries, total_duration)

    # 4. Total Cuts
    total_cuts = len(extract_output.scene_boundaries)

    # 5. Avg Cut Duration
    if total_cuts > 0:
        avg_cut_duration = round(total_duration / total_cuts, 2)
    else:
        avg_cut_duration = 0.0

    # 6. Tempo Level
    tempo_level = _compute_tempo_level(avg_cut_duration)

    result = TemporalOutput(
        attention_curve=attention_curve,
        attention_arc=attention_arc,
        cut_rhythm=cut_rhythm,
        total_cuts=total_cuts,
        avg_cut_duration=avg_cut_duration,
        tempo_level=tempo_level,
    )

    logger.info("P5 TEMPORAL 완료: arc=%s, cuts=%d, tempo=%s",
                attention_arc, total_cuts, tempo_level)

    return result
