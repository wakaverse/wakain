"""Phase C-10: Prescription engine — generates actionable, prioritized prescriptions.

Combines:
- Diagnosis engine (3-axis) results
- Appeal structure (scenes + groups)
- Recipe data (structure, audio, performance_metrics)
- Category profile (key_appeals, purchase_factors)
- STT / caption data

Usage:
    from src.prescription_engine import generate_prescriptions
    report = generate_prescriptions(recipe, profile, diagnosis=diagnosis_result,
                                     appeal_structure=appeal_structure, stt_data=stt, caption_map=cap)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Prescription:
    """A single actionable prescription."""
    category: str        # structure, appeal, visual, audio, text, timing, rhythm
    severity: str        # danger, warning, info
    symptom: str         # what was detected (Korean)
    recommendation: str  # what to do (Korean)
    impact: str          # expected impact (Korean)
    time_range: str = "" # optional timestamp reference
    priority: int = 0    # higher = more important (0-10)

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "severity": self.severity,
            "symptom": self.symptom,
            "recommendation": self.recommendation,
            "impact": self.impact,
            "time_range": self.time_range,
            "priority": self.priority,
        }


@dataclass
class PrescriptionReport:
    """Full prescription report for a video."""
    video_name: str
    category_label: str
    total_prescriptions: int = 0
    danger_count: int = 0
    warning_count: int = 0
    prescriptions: list[Prescription] = field(default_factory=list)
    top_3_actions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "video_name": self.video_name,
            "category_label": self.category_label,
            "total_prescriptions": self.total_prescriptions,
            "danger_count": self.danger_count,
            "warning_count": self.warning_count,
            "top_3_actions": self.top_3_actions,
            "prescriptions": [p.to_dict() for p in self.prescriptions],
        }


# ── Prescription checks ─────────────────────────────────────────────────────


def _check_hook_timing(recipe: dict, **_) -> Prescription | None:
    """Check if hook/first appeal appears within first 3 seconds."""
    structure = recipe.get("structure") or {}
    hook_time = structure.get("hook_time")
    perf = recipe.get("performance_metrics") or {}
    first_appeal = perf.get("time_to_first_appeal")

    # Use whichever is available
    t = None
    if first_appeal is not None and first_appeal > 0:
        t = first_appeal
    elif hook_time is not None and hook_time > 0:
        t = hook_time

    if t is None:
        return None

    if t > 5.0:
        return Prescription(
            category="timing", severity="danger",
            symptom=f"첫 소구/훅이 {t:.1f}초에 등장 — 5초 이상 지연",
            recommendation="첫 1~2초 안에 핵심 소구(질문, 충격 수치, 시각 임팩트)를 배치하세요.",
            impact="초반 이탈률 대폭 감소 (3초 룰)",
            time_range=f"0.0-{t:.1f}s",
            priority=10,
        )
    elif t > 3.0:
        return Prescription(
            category="timing", severity="warning",
            symptom=f"첫 소구가 {t:.1f}초에 등장 — 다소 느림",
            recommendation="첫 2초 안에 시선을 잡는 요소를 넣으면 더 효과적입니다.",
            impact="초반 이탈 방지",
            time_range=f"0.0-{t:.1f}s",
            priority=8,
        )
    return None


def _check_no_cta(recipe: dict, **_) -> Prescription | None:
    """Check if CTA scene exists."""
    scenes = recipe.get("scenes") or recipe.get("scene_cards") or []
    has_cta = any(
        (s.get("role") or "").lower() == "cta"
        for s in scenes if isinstance(s, dict)
    )
    if not has_cta:
        return Prescription(
            category="structure", severity="danger",
            symptom="CTA(행동 유도) 씬이 없습니다",
            recommendation="영상 마지막에 명확한 CTA를 추가하세요 — 구매 링크, 할인 코드, '프로필 링크 클릭' 등.",
            impact="전환율 직접 영향 — CTA 없는 영상은 광고비 낭비",
            priority=10,
        )
    return None


def _check_appeal_gaps_from_structure(appeal_structure: dict, **_) -> list[Prescription]:
    """Check for persuasion gaps from appeal structure scenes."""
    results = []
    scenes = appeal_structure.get("scenes") or []
    if len(scenes) < 2:
        return results

    sorted_scenes = sorted(scenes, key=lambda s: s.get("time_range", [0, 0])[0])
    for i in range(len(sorted_scenes) - 1):
        end_prev = sorted_scenes[i].get("time_range", [0, 0])[1]
        start_next = sorted_scenes[i + 1].get("time_range", [0, 0])[0]
        gap = start_next - end_prev

        if gap > 4.0:
            results.append(Prescription(
                category="appeal", severity="danger",
                symptom=f"소구 공백 {gap:.1f}초 — 이탈 위험 구간",
                recommendation=f"{end_prev:.1f}-{start_next:.1f}초 구간에 소구 포인트(제품 혜택, 사회적 증거, 감성 자극)를 삽입하세요.",
                impact="이탈 위험 구간 해소",
                time_range=f"{end_prev:.1f}-{start_next:.1f}s",
                priority=9,
            ))
        elif gap > 2.5:
            results.append(Prescription(
                category="appeal", severity="warning",
                symptom=f"소구 간격 {gap:.1f}초 — 주의 필요",
                recommendation=f"{end_prev:.1f}-{start_next:.1f}초 구간에 가벼운 소구나 전환 요소를 넣어보세요.",
                impact="시청 흐름 유지",
                time_range=f"{end_prev:.1f}-{start_next:.1f}s",
                priority=5,
            ))

    return results


def _check_missing_appeals(diagnosis: dict, profile: dict, **_) -> list[Prescription]:
    """Check for missing must/recommended appeals from diagnosis axis2."""
    results = []
    axes = diagnosis.get("axes") or []

    # Find appeal_points axis
    axis2 = None
    for ax in axes:
        if ax.get("id") == "appeal_points":
            axis2 = ax
            break
    if not axis2:
        return results

    facts = axis2.get("facts") or {}
    must_cov = facts.get("must_coverage") or {}
    rec_cov = facts.get("recommended_coverage") or {}
    category = facts.get("category", "general")

    APPEAL_KO = {
        "ingredient": "원재료/성분", "manufacturing": "제조 공정", "feature_demo": "기능 시연",
        "spec_data": "스펙/수치", "design_aesthetic": "디자인/심미", "social_proof": "사회적 증거",
        "price": "가격/혜택", "comparison": "비교", "guarantee": "보장/보증",
        "origin": "원산지", "authenticity": "진정성", "authority": "전문성/권위",
        "track_record": "실적/후기", "lifestyle": "라이프스타일",
    }

    for appeal, covered in must_cov.items():
        if not covered:
            ko = APPEAL_KO.get(appeal, appeal)
            results.append(Prescription(
                category="appeal", severity="danger",
                symptom=f"{category} 카테고리 필수 소구 '{ko}' 누락",
                recommendation=f"'{ko}' 소구를 영상에 추가하세요. 이 카테고리에서 구매 결정에 핵심적인 요소입니다.",
                impact=f"{category} 카테고리 구매 전환의 핵심 소구",
                priority=9,
            ))

    missing_rec = [k for k, v in rec_cov.items() if not v]
    if len(missing_rec) >= 2:
        ko_list = [APPEAL_KO.get(a, a) for a in missing_rec[:3]]
        results.append(Prescription(
            category="appeal", severity="warning",
            symptom=f"권장 소구 {len(missing_rec)}개 미활용: {', '.join(ko_list)}",
            recommendation=f"추가하면 설득력이 강화됩니다: {', '.join(ko_list)}",
            impact="설득 다양성 향상",
            priority=5,
        ))

    return results


def _check_product_name_mentions(diagnosis: dict, **_) -> Prescription | None:
    """Check if product name is mentioned enough."""
    axes = diagnosis.get("axes") or []
    axis2 = None
    for ax in axes:
        if ax.get("id") == "appeal_points":
            axis2 = ax
            break
    if not axis2:
        return None

    facts = axis2.get("facts") or {}
    product_name = facts.get("product_name", "")
    mentions = facts.get("product_name_mentions") or {}
    total = (mentions.get("script") or 0) + (mentions.get("caption") or 0)

    if product_name and total < 2:
        return Prescription(
            category="appeal", severity="warning",
            symptom=f"제품명 '{product_name}' 언급 {total}회 — 부족",
            recommendation=f"대본과 자막에서 제품명을 최소 3회 이상 노출하세요. 반복 노출이 기억과 검색에 유리합니다.",
            impact="브랜드/제품 인지도 향상",
            priority=6,
        )
    return None


def _check_aida_coverage(diagnosis: dict, **_) -> list[Prescription]:
    """Check AIDA structure completeness from diagnosis axis1."""
    results = []
    axes = diagnosis.get("axes") or []
    axis1 = None
    for ax in axes:
        if ax.get("id") == "appeal_structure":
            axis1 = ax
            break
    if not axis1:
        return results

    facts = axis1.get("facts") or {}
    aida = facts.get("aida_coverage") or {}

    STAGE_KO = {
        "attention": "Attention(주의 환기)",
        "interest": "Interest(흥미 유발)",
        "desire": "Desire(욕구 자극)",
        "action": "Action(행동 유도)",
    }
    STAGE_REC = {
        "attention": "첫 1-3초에 문제제기, 충격적 수치, 강한 질문으로 시선을 잡으세요.",
        "interest": "제품의 독특한 포인트나 의외의 사실로 호기심을 유발하세요.",
        "desire": "사용 후기, 비포/애프터, 전문가 인정 등으로 '갖고 싶다'는 욕구를 만드세요.",
        "action": "마지막에 명확한 행동 지시(구매 링크, 할인 코드, 댓글 유도)를 넣으세요.",
    }

    missing = [k for k, v in aida.items() if not v]
    for stage in missing:
        results.append(Prescription(
            category="structure", severity="warning",
            symptom=f"AIDA 중 {STAGE_KO.get(stage, stage)} 단계 누락",
            recommendation=STAGE_REC.get(stage, f"{stage} 단계를 추가하세요."),
            impact="설득 프레임워크 완성 → 전환율 향상",
            priority=7,
        ))

    return results


def _check_source_imbalance(diagnosis: dict, **_) -> Prescription | None:
    """Check script vs visual appeal balance."""
    axes = diagnosis.get("axes") or []
    axis1 = None
    for ax in axes:
        if ax.get("id") == "appeal_structure":
            axis1 = ax
            break
    if not axis1:
        return None

    facts = axis1.get("facts") or {}
    sr = facts.get("source_ratio") or {}
    script_ratio = sr.get("script", 0.5)

    if script_ratio > 0.8:
        return Prescription(
            category="appeal", severity="warning",
            symptom=f"소구의 {int(script_ratio * 100)}%가 대본(음성)에만 의존",
            recommendation="핵심 소구를 텍스트 오버레이나 시각적 증거(비포/애프터, 수치, 제품 클로즈업)로 보강하세요.",
            impact="무음 시청자(~80%)에게도 소구 전달",
            priority=7,
        )
    elif script_ratio < 0.2:
        return Prescription(
            category="appeal", severity="info",
            symptom=f"소구의 {int((1 - script_ratio) * 100)}%가 비주얼에만 의존",
            recommendation="나레이션이나 자막으로 핵심 메시지를 보강하면 설득력이 높아집니다.",
            impact="멀티채널 소구로 기억률 향상",
            priority=4,
        )
    return None


def _check_rhythm_issues(diagnosis: dict, **_) -> list[Prescription]:
    """Check rhythm diagnoses from axis3."""
    results = []
    axes = diagnosis.get("axes") or []
    axis3 = None
    for ax in axes:
        if ax.get("id") == "rhythm_profile":
            axis3 = ax
            break
    if not axis3:
        return results

    facts = axis3.get("facts") or {}

    # Overload scenes
    for ov in (facts.get("overload_scenes") or []):
        results.append(Prescription(
            category="rhythm", severity="danger",
            symptom=f"씬{ov['scene_id']} 정보 과부하 — 텍스트 {ov['text_changes']}회 변경 + 빠른 컷",
            recommendation="텍스트 변경 횟수를 줄이거나 컷 간격을 넓혀 가독성을 확보하세요.",
            impact="시청자 인지 부하 감소, 핵심 메시지 전달력 향상",
            priority=8,
        ))

    # No dynamic changes
    dynamic = facts.get("dynamic_changes", 0)
    if dynamic == 0 and len(facts.get("tempo_sequence", [])) >= 3:
        results.append(Prescription(
            category="rhythm", severity="warning",
            symptom="영상 전체가 동일 템포 — 완급 조절 없음",
            recommendation="훅 구간은 빠르게, CTA 구간은 느리게 등 구간별 리듬 변화를 주세요.",
            impact="시청자 몰입도와 리텐션 향상",
            priority=6,
        ))

    return results


def _check_audio(recipe: dict, **_) -> Prescription | None:
    """Check BGM presence."""
    audio = recipe.get("audio") or {}
    music = audio.get("music") or {}
    if not music.get("present"):
        return Prescription(
            category="audio", severity="warning",
            symptom="BGM 없음",
            recommendation="분위기에 맞는 BGM을 추가하세요. 숏폼에서 BGM은 감정 몰입과 리텐션에 큰 영향을 줍니다.",
            impact="청각 자극 + 감정 몰입도 향상",
            priority=6,
        )
    return None


def _check_low_attention_scenes(recipe: dict, **_) -> list[Prescription]:
    """Check for scenes with very low attention."""
    results = []
    scenes = recipe.get("scenes") or recipe.get("scene_cards") or []

    for i, sc in enumerate(scenes):
        if not isinstance(sc, dict):
            continue
        attn = sc.get("attention_score") or sc.get("attention_avg") or 50
        role = (sc.get("role") or "body").lower()
        tr = sc.get("time_range", [0, 0])

        if isinstance(attn, (int, float)) and attn < 25 and role not in ("transition", "brand_close"):
            s_start = tr[0] if isinstance(tr, list) and len(tr) >= 2 else 0
            s_end = tr[1] if isinstance(tr, list) and len(tr) >= 2 else 0
            results.append(Prescription(
                category="visual", severity="warning",
                symptom=f"씬{i + 1}({role}) 집중도 {attn}점 — 시청자가 이탈할 수 있는 구간",
                recommendation=f"{s_start:.1f}-{s_end:.1f}초에 시각 자극(컷 전환, 텍스트 팝업, 줌인)을 추가하세요.",
                impact="이탈 방지 및 시청 완주율 향상",
                time_range=f"{s_start:.1f}-{s_end:.1f}s",
                priority=5,
            ))

    return results


def _check_appeal_diversity(diagnosis: dict, **_) -> Prescription | None:
    """Check if appeal types are too monotonous."""
    axes = diagnosis.get("axes") or []
    axis2 = None
    for ax in axes:
        if ax.get("id") == "appeal_points":
            axis2 = ax
            break
    if not axis2:
        return None

    facts = axis2.get("facts") or {}
    diversity = facts.get("type_diversity", 0)
    total = facts.get("total_appeals", 0)

    if total >= 3 and diversity <= 2:
        return Prescription(
            category="appeal", severity="warning",
            symptom=f"소구 {total}개가 {diversity}종 유형에 집중 — 단조로움",
            recommendation="감성, 가격, 비교, 사회적 증거 등 다양한 소구 유형을 섞으면 설득력이 높아집니다.",
            impact="다각도 설득으로 다양한 구매 동기 자극",
            priority=5,
        )
    return None


# ── Main entry point ─────────────────────────────────────────────────────────


def generate_prescriptions(
    recipe: dict,
    profile: dict,
    diagnosis: dict | None = None,
    appeal_structure: dict | None = None,
    stt_data: dict | None = None,
    caption_map: dict | None = None,
    video_name: str = "unknown",
) -> PrescriptionReport:
    """Generate prioritized prescriptions from diagnosis + recipe + appeal structure.

    Args:
        recipe: VideoRecipe dict (nested under "video_recipe" key or flat)
        profile: Category profile from get_category_profile()
        diagnosis: Diagnosis engine result (3-axis) — {axes, overall_score, top_3_actions}
        appeal_structure: Phase 5.5 output — {scenes, groups}
        stt_data: Phase 0 STT result
        caption_map: C-8 caption map
        video_name: for reporting
    """
    # Unwrap recipe if nested
    r = recipe.get("video_recipe", recipe)
    diag = diagnosis or {}
    appeal = appeal_structure or {}
    category_ko = profile.get("category_ko", profile.get("category", "일반"))

    all_rx: list[Prescription] = []

    # 1. Hook timing
    p = _check_hook_timing(recipe=r)
    if p:
        all_rx.append(p)

    # 2. No CTA
    p = _check_no_cta(recipe=r)
    if p:
        all_rx.append(p)

    # 3. Appeal gaps from appeal structure
    all_rx.extend(_check_appeal_gaps_from_structure(appeal_structure=appeal))

    # 4. Missing must/recommended appeals
    all_rx.extend(_check_missing_appeals(diagnosis=diag, profile=profile))

    # 5. Product name mentions
    p = _check_product_name_mentions(diagnosis=diag)
    if p:
        all_rx.append(p)

    # 6. AIDA coverage
    all_rx.extend(_check_aida_coverage(diagnosis=diag))

    # 7. Source imbalance
    p = _check_source_imbalance(diagnosis=diag)
    if p:
        all_rx.append(p)

    # 8. Rhythm issues
    all_rx.extend(_check_rhythm_issues(diagnosis=diag))

    # 9. Audio
    p = _check_audio(recipe=r)
    if p:
        all_rx.append(p)

    # 10. Low attention scenes
    all_rx.extend(_check_low_attention_scenes(recipe=r))

    # 11. Appeal diversity
    p = _check_appeal_diversity(diagnosis=diag)
    if p:
        all_rx.append(p)

    # Sort by priority descending
    all_rx.sort(key=lambda x: x.priority, reverse=True)

    top3 = [p.recommendation for p in all_rx[:3]]
    danger_count = sum(1 for p in all_rx if p.severity == "danger")
    warning_count = sum(1 for p in all_rx if p.severity == "warning")

    return PrescriptionReport(
        video_name=video_name,
        category_label=category_ko,
        total_prescriptions=len(all_rx),
        danger_count=danger_count,
        warning_count=warning_count,
        prescriptions=all_rx,
        top_3_actions=top3,
    )
