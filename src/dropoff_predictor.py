"""Drop-off prediction engine — local computation, zero API cost.

Scans scenes in 1-second windows and scores each second for viewer
drop-off risk based on four factors:
  1. Attention drop  (attention_score < 20 for 3+ seconds → +40)
  2. Appeal gap      (no new appeal point for 5+ seconds → +30)
  3. Content vacuum  (no text overlay AND no narration for 4+ seconds → +20)
  4. Scene stall     (same scene for 4+ seconds → +10)
"""

from __future__ import annotations

from .schemas import DropOffAnalysis, DropOffZone, Scene


def _next_appeal_type(scenes: list[Scene], after_time: float) -> str:
    """Return the type of the next appeal point after `after_time`."""
    best_t = float("inf")
    best_type = "sensory"
    for scene in scenes:
        for ap in scene.appeal_points:
            vp = ap.get("visual_proof", {})
            ts = vp.get("timestamp")
            if ts is not None and float(ts) > after_time and float(ts) < best_t:
                best_t = float(ts)
                best_type = ap.get("type", "sensory")
    return best_type


def predict_dropoff(scenes: list[Scene]) -> DropOffAnalysis:
    """Analyse scenes and return drop-off risk zones."""
    if not scenes:
        return DropOffAnalysis(
            risk_zones=[],
            safe_zones=[],
            overall_retention_score=100,
            worst_zone=None,
            improvement_priority=[],
        )

    total_duration = max(s.time_range[1] for s in scenes)

    # Build second-by-second lookup maps
    # attention_by_second[t] = attention_score at second t
    attention_by_second: dict[int, int] = {}
    scene_by_second: dict[int, int] = {}        # second → scene_id
    has_text_by_second: dict[int, bool] = {}    # second → True if text overlay present
    has_narration_by_second: dict[int, bool] = {}  # second → True if narration present
    appeal_timestamps: list[float] = []

    for scene in scenes:
        s_start = int(scene.time_range[0])
        s_end = int(scene.time_range[1])
        attn_score = scene.attention.attention_score if scene.attention else 30
        has_text = bool(scene.content_summary.text_overlays)
        has_narr = bool(scene.transcript_segments)

        # text_effects give per-timestamp presence
        text_times: set[int] = set()
        for te in scene.text_effects:
            ts = te.get("time", 0)
            text_times.add(int(float(ts)))

        narr_times: set[int] = set()
        for seg in scene.transcript_segments:
            for t in range(int(seg.start), int(seg.end) + 1):
                narr_times.add(t)

        for t in range(s_start, s_end + 1):
            attention_by_second[t] = attn_score
            scene_by_second[t] = scene.scene_id
            has_text_by_second[t] = (t in text_times) or has_text
            has_narration_by_second[t] = (t in narr_times) or has_narr

        for ap in scene.appeal_points:
            vp = ap.get("visual_proof", {})
            ts = vp.get("timestamp")
            if ts is not None:
                appeal_timestamps.append(float(ts))

    appeal_timestamps.sort()

    # Slide a 1-second window and compute risk score per second
    second_risks: dict[int, tuple[int, list[str]]] = {}

    for t in range(int(total_duration) + 1):
        factors: list[str] = []
        risk = 0

        # Factor 1: attention drop — attention < 20 for 3+ seconds
        low_attn_streak = sum(
            1 for s in range(max(0, t - 2), t + 1)
            if attention_by_second.get(s, 30) < 20
        )
        if low_attn_streak >= 3:
            attn_val = attention_by_second.get(t, 30)
            factors.append(f"집중도 급락 ({attn_val}%)")
            risk += 40

        # Factor 2: appeal gap — no new appeal for 5+ seconds
        last_appeal = max((a for a in appeal_timestamps if a <= t), default=None)
        appeal_gap = (t - last_appeal) if last_appeal is not None else t
        if appeal_gap >= 5:
            factors.append(f"소구 공백 {int(appeal_gap)}초")
            risk += 30

        # Factor 3: content vacuum — no text AND no narration for 4+ seconds
        no_content_streak = sum(
            1 for s in range(max(0, t - 3), t + 1)
            if not has_text_by_second.get(s, False) and not has_narration_by_second.get(s, False)
        )
        if no_content_streak >= 4:
            factors.append("텍스트/나레이션 공백")
            risk += 20

        # Factor 4: scene stall — same scene for 4+ seconds
        current_scene = scene_by_second.get(t, -1)
        stall_streak = sum(
            1 for s in range(max(0, t - 3), t + 1)
            if scene_by_second.get(s, -1) == current_scene
        )
        if stall_streak >= 4:
            factors.append("씬 정체 (동일 씬 4초+)")
            risk += 10

        risk = min(risk, 100)
        if risk > 0:
            second_risks[t] = (risk, factors)

    # Group consecutive high-risk seconds into zones (risk > 0)
    risk_zones: list[DropOffZone] = []
    zone_start: int | None = None
    zone_seconds: list[tuple[int, int, list[str]]] = []

    def _flush_zone() -> None:
        if not zone_seconds:
            return
        z_start = zone_seconds[0][0]
        z_end = zone_seconds[-1][0] + 1
        max_risk = max(r for _, r, _ in zone_seconds)
        all_factors: list[str] = []
        seen: set[str] = set()
        for _, _, facs in zone_seconds:
            for f in facs:
                if f not in seen:
                    seen.add(f)
                    all_factors.append(f)

        if max_risk >= 80:
            risk_level = "critical"
        elif max_risk >= 50:
            risk_level = "high"
        elif max_risk >= 30:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Build suggestion from factors
        suggestion_parts: list[str] = []
        for f in all_factors:
            if "집중도" in f:
                suggestion_parts.append("시각적 전환(컷/모션) 추가")
            elif "소구 공백" in f:
                next_type = _next_appeal_type(scenes, z_end)
                suggestion_parts.append(f"이 구간에 {next_type} 소구 삽입 권장")
            elif "텍스트" in f:
                suggestion_parts.append("핵심 메시지 텍스트 오버레이 추가")
            elif "씬 정체" in f:
                suggestion_parts.append("컷 분할 또는 앵글 전환")
        suggestion = " / ".join(dict.fromkeys(suggestion_parts)) or "전반적 리듬 개선 필요"

        risk_zones.append(DropOffZone(
            time_range=(float(z_start), float(z_end)),
            risk_score=max_risk,
            risk_level=risk_level,
            risk_factors=all_factors,
            suggestion=suggestion,
        ))

    for t in range(int(total_duration) + 1):
        if t in second_risks:
            risk, factors = second_risks[t]
            zone_seconds.append((t, risk, factors))
        else:
            _flush_zone()
            zone_seconds = []

    _flush_zone()

    # Safe zones = gaps between risk zones (and before first / after last)
    safe_zones: list[tuple[float, float]] = []
    prev_end = 0.0
    for z in risk_zones:
        if z.time_range[0] > prev_end:
            safe_zones.append((prev_end, z.time_range[0]))
        prev_end = z.time_range[1]
    if prev_end < total_duration:
        safe_zones.append((prev_end, total_duration))

    # Overall retention score (inverse of avg risk)
    total_seconds = int(total_duration) + 1
    risk_seconds = len(second_risks)
    avg_risk_per_second = (
        sum(r for r, _ in second_risks.values()) / total_seconds
        if second_risks else 0
    )
    overall_retention_score = max(0, int(100 - avg_risk_per_second))

    worst_zone = max(risk_zones, key=lambda z: z.risk_score) if risk_zones else None

    # Improvement priority
    factor_counts: dict[str, int] = {}
    for _, (_, facs) in second_risks.items():
        for f in facs:
            key = f.split(" ")[0]
            factor_counts[key] = factor_counts.get(key, 0) + 1

    priority_map = {
        "집중도": "집중도 저하 구간 시각적 전환 추가",
        "소구": "소구 공백 구간에 적절한 소구 포인트 삽입",
        "텍스트/나레이션": "콘텐츠 공백 구간에 텍스트 오버레이 추가",
        "씬": "장기 정체 씬 분할 편집",
    }
    improvement_priority = [
        priority_map[k] for k, _ in sorted(factor_counts.items(), key=lambda x: -x[1])
        if k in priority_map
    ]

    return DropOffAnalysis(
        risk_zones=risk_zones,
        safe_zones=safe_zones,
        overall_retention_score=overall_retention_score,
        worst_zone=worst_zone,
        improvement_priority=improvement_priority,
    )
