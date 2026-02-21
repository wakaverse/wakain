"""Phase C-10: Style-specific prescription engine.

Generates actionable, style-aware prescriptions from analysis results.
The key insight: same symptom → different prescription depending on style.

Usage:
    from src.prescription_engine import generate_prescriptions
    prescriptions = generate_prescriptions(diagnosis, recipe, profile)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Prescription:
    """A single actionable prescription."""
    category: str        # structure, appeal, visual, audio, text, timing
    severity: str        # danger, warning, info, ok
    symptom: str         # what was detected (Korean)
    recommendation: str  # what to do (Korean)
    impact: str          # expected impact (Korean)
    priority: int = 0    # higher = more important (0-10)

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "severity": self.severity,
            "symptom": self.symptom,
            "recommendation": self.recommendation,
            "impact": self.impact,
            "priority": self.priority,
        }


@dataclass
class PrescriptionReport:
    """Full prescription report for a video."""
    video_name: str
    style_label: str  # e.g. "진행자형 × 커머스"
    total_prescriptions: int = 0
    danger_count: int = 0
    warning_count: int = 0
    prescriptions: list[Prescription] = field(default_factory=list)
    top_3_actions: list[str] = field(default_factory=list)  # top 3 actionable items

    def to_dict(self) -> dict:
        return {
            "video_name": self.video_name,
            "style_label": self.style_label,
            "total_prescriptions": self.total_prescriptions,
            "danger_count": self.danger_count,
            "warning_count": self.warning_count,
            "top_3_actions": self.top_3_actions,
            "prescriptions": [p.to_dict() for p in self.prescriptions],
        }


# ── Prescription rules ──────────────────────────────────────────────────────
# Each rule: (condition_fn, prescription_factory)
# condition_fn(recipe, profile, stt_data, caption_map) -> bool
# prescription_factory(recipe, profile, ...) -> Prescription | None


def _check_no_hook(recipe: dict, profile: dict, **_) -> Prescription | None:
    """No clear hook in first 2 seconds."""
    structure = recipe.get("structure") or {}
    hook_time = structure.get("hook_time")
    if hook_time is None:
        return None

    max_hook = profile.get("thresholds", {}).get("first_appeal_max_sec", 3.0)
    if hook_time > max_hook:
        fmt = profile.get("format", "unknown")
        intent = profile.get("intent", "unknown")

        # Style-specific recommendation
        if intent == "commerce":
            rec = f"첫 {max_hook:.0f}초 안에 가격/혜택/핵심 소구를 보여주세요. 커머스 영상은 즉각적 관심 유도가 필수입니다."
            impact = "CTR 개선 기대 (Hook이 빠를수록 스크롤 방지)"
            severity = "danger"
        elif fmt in ("ugc_vlog", "asmr_mood"):
            rec = f"일상 도입부가 {hook_time:.1f}초이므로, 자연스러운 전환이 되는지 확인하세요."
            impact = "시청 유지율 유지"
            severity = "info"
        else:
            rec = f"첫 {max_hook:.0f}초 안에 시청자의 관심을 잡는 요소(질문, 반전, 시각 자극)를 넣으세요."
            impact = "초반 이탈 방지"
            severity = "warning"

        return Prescription(
            category="timing",
            severity=severity,
            symptom=f"Hook이 {hook_time:.1f}초에 시작 (기준: {max_hook:.0f}초 이내)",
            recommendation=rec,
            impact=impact,
            priority=9,
        )
    return None


def _check_appeal_gaps(recipe: dict, profile: dict, **_) -> list[Prescription]:
    """Check for persuasion gaps (no appeal for too long)."""
    results = []
    dropoff = recipe.get("dropoff_analysis") or {}
    risk_zones = dropoff.get("risk_zones", [])
    max_gap = profile.get("thresholds", {}).get("appeal_gap_max_sec", 4.0)
    intent = profile.get("intent", "")

    for zone in risk_zones:
        gap = zone.get("end", 0) - zone.get("start", 0)
        if gap >= max_gap:
            reason = zone.get("reason", "")

            if intent == "commerce":
                rec = f"{zone['start']:.0f}-{zone['end']:.0f}초 구간에 가격, 혜택, 또는 사회적 증거 소구를 삽입하세요."
                severity = "danger"
                priority = 8
            elif intent == "branding":
                rec = f"감성 여백 구간일 수 있지만, {gap:.0f}초는 길 수 있습니다. 브랜드 이미지 요소를 가볍게 넣어보세요."
                severity = "info"
                priority = 4
            else:
                rec = f"{zone['start']:.0f}-{zone['end']:.0f}초 구간에 적절한 소구를 추가하세요."
                severity = "warning"
                priority = 6

            results.append(Prescription(
                category="appeal",
                severity=severity,
                symptom=f"소구 공백 {gap:.1f}초 ({zone['start']:.0f}-{zone['end']:.0f}s). {reason}",
                recommendation=rec,
                impact="이탈 위험 구간 해소",
                priority=priority,
            ))
    return results


def _check_structure_match(recipe: dict, profile: dict, **_) -> Prescription | None:
    """Check if video structure matches recommended structure."""
    rec_structure = profile.get("recommended_structure", [])
    if not rec_structure:
        return None

    # Get scene roles from recipe
    scene_cards = recipe.get("scene_cards", [])
    actual_roles = [sc.get("role", "") for sc in scene_cards if sc.get("role")]

    if not actual_roles:
        scenes = recipe.get("scenes", [])
        actual_roles = [s.get("role", "") for s in scenes if isinstance(s, dict) and s.get("role")]

    if not actual_roles:
        return None

    # Check if CTA exists for commerce
    intent = profile.get("intent", "")
    has_cta = any("cta" in r.lower() for r in actual_roles)

    if intent == "commerce" and not has_cta:
        return Prescription(
            category="structure",
            severity="danger",
            symptom="CTA 씬이 없습니다",
            recommendation="영상 마지막에 명확한 CTA(구매 링크, 할인 코드, 행동 유도)를 추가하세요.",
            impact="전환율 직접 영향",
            priority=10,
        )

    # Check recommended flow
    rec_str = " → ".join(rec_structure)
    actual_str = " → ".join(actual_roles[:len(rec_structure)])

    if len(actual_roles) < len(rec_structure) * 0.5:
        return Prescription(
            category="structure",
            severity="warning",
            symptom=f"구조가 권장 패턴보다 단순합니다 (현재 {len(actual_roles)}씬, 권장 {len(rec_structure)}씬)",
            recommendation=f"권장 구조: {rec_str}. 빠진 씬을 추가해보세요.",
            impact="설득 흐름 강화",
            priority=6,
        )
    return None


def _check_appeal_effectiveness(recipe: dict, profile: dict, **_) -> list[Prescription]:
    """Check if used appeals match style's effective/weak appeals."""
    results = []
    persuasion = recipe.get("persuasion_analysis") or {}
    appeals = persuasion.get("appeal_points", [])

    effective = set(profile.get("effective_appeals", []))
    weak = set(profile.get("weak_appeals", []))

    used_types = set()
    weak_used = []
    for a in appeals:
        atype = a.get("type", "")
        used_types.add(atype)
        if atype in weak:
            weak_used.append(atype)

    # Strong appeals not used
    unused_effective = effective - used_types
    if unused_effective and len(unused_effective) > len(effective) * 0.5:
        rec = f"이 스타일에 효과적인 소구를 활용하세요: {', '.join(list(unused_effective)[:3])}"
        results.append(Prescription(
            category="appeal",
            severity="info",
            symptom=f"효과적 소구 미활용 ({', '.join(list(unused_effective)[:3])})",
            recommendation=rec,
            impact="설득력 강화 가능",
            priority=5,
        ))

    # Weak appeals used prominently
    if weak_used:
        results.append(Prescription(
            category="appeal",
            severity="info",
            symptom=f"이 스타일에서 약한 소구 사용: {', '.join(weak_used)}",
            recommendation=f"해당 소구는 {profile.get('format', '')}×{profile.get('intent', '')} 스타일에서 효과가 낮을 수 있습니다. 대체를 고려하세요.",
            impact="소구 효율 개선",
            priority=3,
        ))

    return results


def _check_audio(recipe: dict, profile: dict, **_) -> Prescription | None:
    """Check audio quality/presence."""
    audio = recipe.get("audio") or {}
    music = audio.get("music", {})
    fmt = profile.get("format", "")

    if not music.get("present"):
        prescriptions = profile.get("prescriptions", {})
        rx = prescriptions.get("no_bgm", {})
        if rx and rx.get("level") in ("danger", "warning"):
            return Prescription(
                category="audio",
                severity=rx["level"],
                symptom="BGM 없음",
                recommendation=rx.get("message", "BGM을 추가하세요."),
                impact="청각 자극도 향상, 몰입감 증대",
                priority=7 if rx["level"] == "danger" else 4,
            )
    return None


# ── Main entry point ─────────────────────────────────────────────────────────


def generate_prescriptions(
    recipe: dict,
    profile: dict,
    stt_data: dict | None = None,
    caption_map: dict | None = None,
    video_name: str = "unknown",
) -> PrescriptionReport:
    """Generate style-aware prescriptions from analysis results.

    Args:
        recipe: VideoRecipe dict
        profile: merged style profile (from get_merged_profile)
        stt_data: Phase 0 STT result
        caption_map: C-8 caption map
        video_name: for reporting

    Returns:
        PrescriptionReport with prioritized, actionable prescriptions.
    """
    fmt_ko = profile.get("format", "")
    int_ko = profile.get("intent", "")
    style_label = f"{fmt_ko} × {int_ko}"

    all_prescriptions: list[Prescription] = []
    kwargs = dict(recipe=recipe, profile=profile, stt_data=stt_data, caption_map=caption_map)

    # Run all checks
    p = _check_no_hook(**kwargs)
    if p:
        all_prescriptions.append(p)

    all_prescriptions.extend(_check_appeal_gaps(**kwargs))

    p = _check_structure_match(**kwargs)
    if p:
        all_prescriptions.append(p)

    all_prescriptions.extend(_check_appeal_effectiveness(**kwargs))

    p = _check_audio(**kwargs)
    if p:
        all_prescriptions.append(p)

    # Sort by priority descending
    all_prescriptions.sort(key=lambda x: x.priority, reverse=True)

    # Top 3 actions
    top3 = [p.recommendation for p in all_prescriptions[:3]]

    danger_count = sum(1 for p in all_prescriptions if p.severity == "danger")
    warning_count = sum(1 for p in all_prescriptions if p.severity == "warning")

    return PrescriptionReport(
        video_name=video_name,
        style_label=style_label,
        total_prescriptions=len(all_prescriptions),
        danger_count=danger_count,
        warning_count=warning_count,
        prescriptions=all_prescriptions,
        top_3_actions=top3,
    )
