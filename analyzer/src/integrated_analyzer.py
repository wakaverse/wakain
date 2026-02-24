"""Phase C-9: 3-stage integrated analysis (Classification → Simultaneous → Diagnosis).

Combines all prior phase data into a unified diagnosis:
  Stage 1: Classification (from Phase 0/0.1)
  Stage 2: Simultaneous multi-axis analysis (weighted by style profile)
  Stage 3: Integrated diagnosis + prescriptions

Usage:
    from src.integrated_analyzer import run_integrated_analysis
    diagnosis = run_integrated_analysis(recipe_data, stt_result, style, caption_map)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class DimensionScore:
    """Score for one analysis dimension."""
    name: str
    name_ko: str
    value: float          # 0-100
    weight: float         # from style profile
    weighted: float = 0.0  # value * weight
    evidence: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "name_ko": self.name_ko,
            "value": round(self.value, 1),
            "weight": round(self.weight, 2),
            "weighted": round(self.weighted, 1),
            "evidence": self.evidence,
        }


@dataclass
class DiagnosisItem:
    """A single diagnostic finding."""
    time_range: str          # e.g. "14.0-16.0s"
    severity: str            # danger, warning, info, ok
    finding: str             # what was found (Korean)
    prescription: str        # what to do about it (Korean)
    dimension: str           # which dimension triggered this
    style_context: str = ""  # why this matters for this style

    def to_dict(self) -> dict:
        return {
            "time_range": self.time_range,
            "severity": self.severity,
            "finding": self.finding,
            "prescription": self.prescription,
            "dimension": self.dimension,
            "style_context": self.style_context,
        }


@dataclass
class IntegratedDiagnosis:
    """Full 3-stage integrated analysis result."""
    # Stage 1: Classification
    format_key: str
    format_ko: str
    intent_key: str
    intent_ko: str
    secondary_format: str | None = None
    narration_type: str = "voice"

    # Stage 2: Dimension scores
    dimensions: list[DimensionScore] = field(default_factory=list)
    engagement_score: float = 0.0  # internal weighted sum (not shown to user)

    # Stage 3: Diagnosis items
    diagnoses: list[DiagnosisItem] = field(default_factory=list)
    scene_analyses: list[dict] = field(default_factory=list)  # per-scene analysis
    hook_analysis: dict = field(default_factory=dict)  # first 3s hook analysis
    summary: str = ""  # 1-2 sentence overall diagnosis (Korean)
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "classification": {
                "format": self.format_key,
                "format_ko": self.format_ko,
                "intent": self.intent_key,
                "intent_ko": self.intent_ko,
                "secondary_format": self.secondary_format,
                "narration_type": self.narration_type,
            },
            "dimensions": [d.to_dict() for d in self.dimensions],
            "engagement_score": round(self.engagement_score, 1),
            "diagnoses": [d.to_dict() for d in self.diagnoses],
            "scene_analyses": self.scene_analyses,
            "hook_analysis": self.hook_analysis,
            "summary": self.summary,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
        }


# ── Dimension calculators ────────────────────────────────────────────────────

DIMENSION_KO = {
    "visual_stimulus": "시각적 자극도",
    "persuasion_density": "설득 밀도",
    "information_density": "정보 밀도",
    "edit_rhythm": "편집 리듬",
    "audio_stimulus": "청각 자극도",
}


def _calc_visual_stimulus(data: dict, scenes: list[dict]) -> tuple[float, str]:
    """Calculate visual stimulus score from multiple factors.

    Factors (weighted):
      1. Cut density (30%) — cuts per second, optimal range differs by style
      2. Scene diversity (25%) — unique roles / total scenes
      3. Attention peaks (20%) — high-attention scenes ratio
      4. Transition variety (10%) — mixed transitions boost
      5. Attention arc pattern (15%) — narrative arc quality
    """
    # Support both raw temporal (direct keys) and recipe (nested under temporal_profile)
    if "attention_curve" in data:
        temporal = data
    else:
        temporal = data.get("temporal_profile") or {}

    evidence_parts = []

    # --- Factor 1: Cut density (30%) ---
    cut_rhythm = (temporal.get("cut_rhythm") or {}) if temporal else {}
    total_cuts = cut_rhythm.get("total_cuts", len(scenes))
    duration = cut_rhythm.get("duration", 30)
    if duration <= 0:
        duration = 30
    cut_density = total_cuts / duration  # cuts per second

    # Optimal: 0.3~0.8/s = high stimulus, <0.15 = low, >1.2 = chaotic
    if cut_density >= 0.3 and cut_density <= 0.8:
        cut_score = 80 + min(20, (cut_density - 0.3) * 40)  # 80~100
    elif cut_density > 0.8:
        cut_score = max(60, 100 - (cut_density - 0.8) * 50)  # slight penalty for chaos
    elif cut_density >= 0.15:
        cut_score = 40 + (cut_density - 0.15) * 267  # 40~80
    else:
        cut_score = max(20, cut_density / 0.15 * 40)  # 0~40
    evidence_parts.append(f"컷 {total_cuts}개, 밀도 {cut_density:.2f}/s")

    # --- Factor 2: Scene diversity (25%) ---
    if scenes:
        roles = set()
        for s in scenes:
            role = s.get("role", "unknown")
            if role:
                roles.add(role)
        unique_ratio = len(roles) / max(len(scenes), 1)
        # More unique roles = more visual variety
        diversity_score = min(100, len(roles) * 15 + unique_ratio * 40)
        evidence_parts.append(f"역할 {len(roles)}종")
    else:
        diversity_score = 50

    # --- Factor 3: Attention peaks (20%) ---
    if scenes:
        def _get_attention(s):
            att = s.get("attention")
            if isinstance(att, dict):
                return att.get("attention_score", 0) or 0
            if isinstance(att, (int, float)):
                return att
            return s.get("attention_score", 0) or 0
        high_attention = sum(1 for s in scenes if _get_attention(s) >= 50)
        peak_ratio = high_attention / len(scenes)
        peak_score = min(100, peak_ratio * 120)  # 83%+ → 100
        evidence_parts.append(f"고집중 씬 {high_attention}/{len(scenes)}")
    else:
        peak_score = 50

    # --- Factor 4: Transition variety (10%) ---
    transition = (temporal.get("transition_texture") or {}) if temporal else {}
    dom_type = transition.get("dominant_type", "cut")
    trans_score = 60  # default for simple cuts
    if dom_type in ("dissolve", "mixed"):
        trans_score = 85
    elif dom_type == "wipe":
        trans_score = 75

    # --- Factor 5: Attention arc (15%) ---
    attention = (temporal.get("attention_curve") or {}) if temporal else {}
    attention_arc = attention.get("attention_arc", "unknown")
    arc_scores = {
        "strong_open": 85, "gradual_build": 70, "sustained": 75,
        "front_loaded": 65, "building": 70, "peak": 80,
        "declining": 40, "flat": 35,
    }
    # Handle compound arcs like "building→peak→fade"
    if attention_arc not in arc_scores:
        # Try matching sub-parts
        parts = [p.strip() for p in attention_arc.replace("→", ",").replace("->", ",").split(",")]
        matched = [arc_scores.get(p, 0) for p in parts if p in arc_scores]
        arc_score = max(matched) if matched else 55  # default moderate
    else:
        arc_score = arc_scores[attention_arc]
    evidence_parts.append(f"arc={attention_arc}")

    # --- Factor 6: Visual technique diversity (bonus, from scenes) ---
    visual_techs = set()
    for s in scenes:
        for ap in (s.get("appeal_points") or []):
            vp = ap.get("visual_proof", {})
            if isinstance(vp, dict):
                t = (vp.get("technique") or "").lower().strip()
                if t and t not in ("text_overlay", "none", ""):
                    visual_techs.add(t)
    technique_bonus = min(12, len(visual_techs) * 3)  # 0~12 bonus
    if visual_techs:
        evidence_parts.append(f"연출기법 {len(visual_techs)}종")

    # --- Weighted combination ---
    score = (
        cut_score * 0.30 +
        diversity_score * 0.20 +
        peak_score * 0.20 +
        trans_score * 0.10 +
        arc_score * 0.10 +
        technique_bonus  # flat bonus
    )

    return min(100, max(0, round(score, 1))), ", ".join(evidence_parts)


_CAPTION_TECHNIQUES = {"text_overlay", "none", ""}
"""Techniques that are just captions/subtitles in voice-narrated videos."""

_VISUAL_TECHNIQUES = {
    "closeup", "slow_motion", "split_screen", "before_after",
    "reaction_shot", "process_shot", "package_shot",
    "ingredient_shot", "location_shot", "graph_number",
}
"""Techniques that represent genuine visual production effort."""


def _classify_appeal_quality(appeal: dict, narration_type: str) -> str:
    """Classify an appeal as 'visual' or 'caption' based on its technique.

    In voice-narrated videos, text_overlay is just a subtitle (caption).
    In silent/caption-only videos, text_overlay IS the visual technique.
    """
    vp = appeal.get("visual_proof", {})
    if not isinstance(vp, dict):
        return "caption"
    technique = (vp.get("technique") or "").lower().strip()

    # In silent videos, text_overlay counts as visual
    if narration_type in ("silent", "caption"):
        return "visual" if technique else "caption"

    # In voice videos, text_overlay = just subtitles
    if technique in _CAPTION_TECHNIQUES:
        return "caption"
    return "visual"


def _calc_persuasion_density(recipe: dict, scenes: list[dict], duration: float,
                              narration_type: str = "silent") -> tuple[float, str]:
    """Calculate persuasion density with visual vs caption appeal distinction.

    Visual appeals (ingredient_shot, process_shot, etc.) score higher than
    caption-only appeals (text_overlay in voice videos = just subtitles).

    Falls back to scene-level appeal data if persuasion_analysis is missing.
    """
    persuasion = recipe.get("persuasion_analysis") or {}
    appeals = persuasion.get("appeal_points") or []

    # Fallback: extract appeals from scene_analysis if persuasion_analysis is empty
    if not appeals:
        scene_analysis = recipe.get("scene_analysis") or recipe.get("scenes") or []
        for scene in scene_analysis:
            scene_appeals = scene.get("appeal_points") or []
            for ap in scene_appeals:
                if isinstance(ap, dict) and ap.get("type"):
                    appeals.append(ap)

    if not appeals:
        return 20.0, "소구 포인트 없음"

    # Classify each appeal
    visual_appeals = []
    caption_appeals = []
    visual_techniques_used = set()
    for a in appeals:
        quality = _classify_appeal_quality(a, narration_type)
        if quality == "visual":
            visual_appeals.append(a)
            vp = a.get("visual_proof", {})
            if isinstance(vp, dict):
                t = (vp.get("technique") or "").lower().strip()
                if t and t not in _CAPTION_TECHNIQUES:
                    visual_techniques_used.add(t)
        else:
            caption_appeals.append(a)

    # Weighted appeal count: visual=1.0, caption=0.3
    weighted_count = len(visual_appeals) * 1.0 + len(caption_appeals) * 0.3
    density = weighted_count / max(duration, 1) * 10

    # Visual technique diversity bonus (0~15 points)
    technique_bonus = min(15, len(visual_techniques_used) * 4)

    # Visual ratio bonus (0~15 points): higher ratio of visual appeals = better
    total = len(visual_appeals) + len(caption_appeals)
    visual_ratio = len(visual_appeals) / max(total, 1)
    ratio_bonus = visual_ratio * 15

    # Scene-level appeal clustering penalty
    # Check if appeals are crammed into few scenes (bad) vs spread out (good)
    scene_appeal_counts = []
    for scene in (recipe.get("scenes") or []):
        scene_appeal_counts.append(len(scene.get("appeal_points", [])))
    clustering_penalty = 0
    if scene_appeal_counts:
        max_per_scene = max(scene_appeal_counts)
        if max_per_scene >= 4:
            clustering_penalty = (max_per_scene - 3) * 8  # -8 per extra beyond 3
        elif max_per_scene >= 3:
            clustering_penalty = 4

    # Base score from weighted density
    score = min(85, density * 12) + technique_bonus + ratio_bonus - clustering_penalty

    # First appeal timing
    first_appeal = None
    for a in appeals:
        vp = a.get("visual_proof", {})
        if isinstance(vp, dict) and vp.get("timestamp"):
            first_appeal = vp["timestamp"]
            break

    evidence = f"소구 {total}개(V:{len(visual_appeals)}/C:{len(caption_appeals)}), 연출 {len(visual_techniques_used)}종"
    if first_appeal is not None:
        evidence += f", 첫소구 {first_appeal:.1f}s"
        if first_appeal <= 2.0:
            score += 8
        elif first_appeal > 5.0:
            score -= 12

    return min(100, max(0, round(score, 1))), evidence


def _calc_information_density(
    recipe: dict,
    caption_map: dict | None,
    stt_data: dict | None,
    duration: float,
) -> tuple[float, str]:
    """Calculate information density from STT + captions."""
    parts = []
    score = 50.0

    # STT contribution
    if stt_data:
        speech_sec = stt_data.get("total_speech_sec", 0)
        seg_count = stt_data.get("segment_count", 0)
        speech_ratio = speech_sec / max(duration, 1)
        score = speech_ratio * 60 + min(seg_count * 3, 30)
        parts.append(f"음성 {speech_sec:.0f}s ({speech_ratio:.0%})")

    # Caption contribution
    if caption_map:
        cap_count = caption_map.get("caption_count", 0)
        cap_time = caption_map.get("total_caption_time", 0)
        cap_ratio = cap_time / max(duration, 1)
        cap_score = cap_ratio * 40 + min(cap_count * 2, 20)
        score = max(score, cap_score)  # take higher of voice/caption
        parts.append(f"캡션 {cap_count}개 ({cap_time:.0f}s)")

    if not parts:
        return 30.0, "STT/캡션 데이터 없음"

    return min(100, max(0, score)), ", ".join(parts)


def _calc_edit_rhythm(data: dict, duration: float) -> tuple[float, str]:
    """Calculate edit rhythm score with continuous curve + rhythm analysis.

    Factors:
      1. Cut density (50%) — bell curve centered on 0.5/s optimal
      2. Rhythm pattern (20%) — accelerating/decelerating/varied > flat
      3. Interval consistency (15%) — std dev of intervals (moderate variation best)
      4. Cut count adequacy (15%) — enough cuts for the duration
    """
    if "cut_rhythm" in data:
        cut_rhythm = data.get("cut_rhythm") or {}
    else:
        temporal = data.get("temporal_profile") or {}
        cut_rhythm = temporal.get("cut_rhythm") or {}

    total_cuts = cut_rhythm.get("total_cuts", 0)
    cut_density = total_cuts / max(duration, 1)
    intervals = cut_rhythm.get("intervals", [])
    pattern = cut_rhythm.get("pattern", "unknown")

    evidence_parts = [f"컷 {total_cuts}개, 밀도 {cut_density:.2f}/s"]

    # --- Factor 1: Density bell curve (50%) ---
    # Optimal: 0.5/s = 100, falls off as gaussian
    import math
    optimal = 0.55
    sigma = 0.35
    density_score = 100 * math.exp(-((cut_density - optimal) ** 2) / (2 * sigma ** 2))

    # --- Factor 2: Rhythm pattern (20%) ---
    pattern_scores = {
        "accelerating": 80, "decelerating": 75, "varied": 85,
        "rhythmic": 90, "regular": 70, "irregular": 55,
        "slow": 40, "flat": 35, "unknown": 50,
    }
    pattern_score = pattern_scores.get(pattern, 50)
    if pattern != "unknown":
        evidence_parts.append(f"패턴 {pattern}")

    # --- Factor 3: Interval consistency (15%) ---
    if len(intervals) >= 2:
        import statistics
        mean_iv = statistics.mean(intervals)
        std_iv = statistics.stdev(intervals)
        cv = std_iv / max(mean_iv, 0.01)  # coefficient of variation
        # Moderate variation (cv 0.3~0.7) is best — too uniform = boring, too chaotic = jarring
        if 0.3 <= cv <= 0.7:
            consistency_score = 85
        elif 0.15 <= cv < 0.3:
            consistency_score = 70  # a bit too uniform
        elif 0.7 < cv <= 1.0:
            consistency_score = 65  # a bit chaotic
        elif cv < 0.15:
            consistency_score = 55  # monotonous
        else:
            consistency_score = 45  # very chaotic
        evidence_parts.append(f"CV {cv:.2f}")
    else:
        consistency_score = 30  # not enough data

    # --- Factor 4: Cut count adequacy (30%) ---
    # Expect roughly 1 cut per 1.5-2 seconds for well-edited shortform
    expected_cuts = duration / 1.75
    adequacy = total_cuts / max(expected_cuts, 1)
    if adequacy >= 1.0:
        adequacy_score = 90 + min(10, (adequacy - 1.0) * 20)  # 90~100
    elif adequacy >= 0.6:
        adequacy_score = 50 + (adequacy - 0.6) * 100  # 50~90
    elif adequacy >= 0.3:
        adequacy_score = 20 + (adequacy - 0.3) * 100  # 20~50
    else:
        adequacy_score = max(5, adequacy / 0.3 * 20)  # 0~20
    adequacy_score = min(100, adequacy_score)
    evidence_parts.append(f"적정성 {adequacy:.0%}")

    # --- Weighted combination ---
    score = (
        density_score * 0.35 +
        pattern_score * 0.15 +
        consistency_score * 0.15 +
        adequacy_score * 0.35
    )

    return min(100, max(0, round(score, 1))), ", ".join(evidence_parts)


def _calc_audio_stimulus(recipe: dict) -> tuple[float, str]:
    """Calculate audio stimulus with granular scoring.

    Factors:
      1. BGM presence + quality (30%) — genre, energy profile, tempo match
      2. Voice quality (25%) — type (narration > tts > none), delivery
      3. Sound effects (20%) — count, variety, timing
      4. Audio dynamics (15%) — energy changes, beat sync
      5. Layer count (10%) — how many audio layers simultaneously
    """
    audio = recipe.get("audio") or {}
    parts = []

    # --- Factor 1: BGM (30%) ---
    music = audio.get("music", {})
    bgm_score = 0
    if music.get("present"):
        bgm_score = 50  # base for having BGM
        genre = music.get("genre", "unknown")
        parts.append(f"BGM {genre}")

        energy = music.get("energy_profile", "steady")
        energy_scores = {
            "building": 30, "calm_to_hype": 30, "dynamic": 28,
            "hype": 20, "calm": 15, "steady": 10,
        }
        bgm_score += energy_scores.get(energy, 10)

        tempo = music.get("tempo", "")
        if tempo in ("fast", "upbeat"):
            bgm_score += 10
        elif tempo in ("moderate",):
            bgm_score += 5

        bgm_score = min(100, bgm_score)
    else:
        parts.append("BGM 없음")

    # --- Factor 2: Voice (25%) ---
    voice = audio.get("voice", {})
    voice_type = voice.get("type", "none")
    voice_scores = {
        "narration": 80, "voiceover": 85, "presenter": 75,
        "tts": 50, "dialogue": 70, "none": 10,
    }
    voice_score = voice_scores.get(voice_type, 40)
    if voice_type and voice_type != "none":
        parts.append(f"음성 {voice_type}")

        # Delivery quality
        delivery = voice.get("delivery", "")
        if delivery in ("energetic", "enthusiastic", "professional"):
            voice_score += 15
        elif delivery in ("calm", "neutral"):
            voice_score += 5
        voice_score = min(100, voice_score)

    # --- Factor 3: Sound effects (20%) ---
    sfx = audio.get("sfx", [])
    if sfx:
        sfx_count = len(sfx)
        # Diminishing returns: 1=40, 2=60, 3=75, 4+=85
        sfx_score = min(85, 25 + sfx_count * 20)

        # Variety check
        sfx_types = set()
        for s in sfx:
            if isinstance(s, dict):
                sfx_types.add(s.get("type", "unknown"))
            elif isinstance(s, str):
                sfx_types.add(s)
        if len(sfx_types) >= 3:
            sfx_score += 10
        parts.append(f"효과음 {sfx_count}개")
        sfx_score = min(100, sfx_score)
    else:
        sfx_score = 15

    # --- Factor 4: Audio dynamics (15%) ---
    dynamics_score = 40  # default
    energy = music.get("energy_profile", "steady")
    if energy in ("building", "calm_to_hype", "dynamic"):
        dynamics_score = 80
    elif energy in ("hype",):
        dynamics_score = 60

    beat_sync = str(music.get("beat_sync", "")).lower()
    if "sync" in beat_sync or "match" in beat_sync:
        dynamics_score += 15
        parts.append("비트싱크")
    dynamics_score = min(100, dynamics_score)

    # --- Factor 5: Layer count (10%) ---
    layers = 0
    if music.get("present"):
        layers += 1
    if voice_type and voice_type != "none":
        layers += 1
    if sfx:
        layers += 1
    layer_score = {0: 10, 1: 40, 2: 70, 3: 95}.get(layers, 50)

    # --- Weighted combination ---
    score = (
        bgm_score * 0.30 +
        voice_score * 0.25 +
        sfx_score * 0.20 +
        dynamics_score * 0.15 +
        layer_score * 0.10
    )

    return min(100, max(0, round(score, 1))), ", ".join(parts) if parts else "오디오 정보 부족"


# ── Stage 3: Diagnosis engine ────────────────────────────────────────────────


def _generate_diagnoses(
    dimensions: list[DimensionScore],
    recipe: dict,
    profile: dict,
    stt_data: dict | None,
    caption_map: dict | None,
    duration: float,
    raw_temporal: dict | None = None,
) -> list[DiagnosisItem]:
    """Generate diagnostic items based on dimension scores and style thresholds."""
    diagnoses: list[DiagnosisItem] = []
    thresholds = profile.get("thresholds", {})
    prescriptions = profile.get("prescriptions", {})

    # Check first appeal timing
    persuasion = recipe.get("persuasion_analysis") or {}
    appeals = persuasion.get("appeal_points", [])
    first_appeal_time = None
    for a in appeals:
        vp = a.get("visual_proof", {})
        if isinstance(vp, dict) and vp.get("timestamp"):
            first_appeal_time = vp["timestamp"]
            break

    max_first = thresholds.get("first_appeal_max_sec", 3.0)
    if first_appeal_time is not None and first_appeal_time > max_first:
        rx = prescriptions.get("first_appeal_late", {})
        diagnoses.append(DiagnosisItem(
            time_range=f"0.0-{first_appeal_time:.1f}s",
            severity=rx.get("level", "warning"),
            finding=f"첫 소구가 {first_appeal_time:.1f}초에 등장 (기준: {max_first}초 이내)",
            prescription=rx.get("message", "첫 소구를 앞당기세요."),
            dimension="persuasion_density",
            style_context=f"{profile.get('format', '')} × {profile.get('intent', '')} 기준",
        ))

    # Check cut density
    if raw_temporal and "cut_rhythm" in raw_temporal:
        cut_rhythm = raw_temporal.get("cut_rhythm") or {}
    else:
        temporal = recipe.get("temporal_profile") or {}
        cut_rhythm = temporal.get("cut_rhythm") or {}
    total_cuts = cut_rhythm.get("total_cuts", 0)
    cut_density = total_cuts / max(duration, 1)

    min_cut = thresholds.get("cut_density_min", 0.15)
    max_cut = thresholds.get("cut_density_max", 1.0)

    if cut_density < min_cut:
        rx = prescriptions.get("cut_density_low", {})
        diagnoses.append(DiagnosisItem(
            time_range="전체",
            severity=rx.get("level", "warning"),
            finding=f"컷 밀도 {cut_density:.2f}/s (기준 최소: {min_cut}/s)",
            prescription=rx.get("message", "편집 속도를 올리세요."),
            dimension="edit_rhythm",
        ))
    elif cut_density > max_cut:
        rx = prescriptions.get("cut_density_high", {})
        diagnoses.append(DiagnosisItem(
            time_range="전체",
            severity=rx.get("level", "info"),
            finding=f"컷 밀도 {cut_density:.2f}/s (기준 최대: {max_cut}/s)",
            prescription=rx.get("message", "편집이 빠릅니다."),
            dimension="edit_rhythm",
        ))

    # Check appeal gaps (from dropoff analysis if available)
    dropoff = recipe.get("dropoff_analysis") or {}
    risk_zones = dropoff.get("risk_zones", [])
    max_gap = thresholds.get("appeal_gap_max_sec", 4.0)

    for zone in risk_zones:
        zone_start = zone.get("start", 0)
        zone_end = zone.get("end", 0)
        gap_duration = zone_end - zone_start
        if gap_duration >= max_gap:
            rx = prescriptions.get("appeal_gap_3s", {})
            diagnoses.append(DiagnosisItem(
                time_range=f"{zone_start:.1f}-{zone_end:.1f}s",
                severity=rx.get("level", "warning"),
                finding=f"소구 공백 {gap_duration:.1f}초 (기준: {max_gap}초 이내). 원인: {zone.get('reason', '불명')}",
                prescription=rx.get("message", "소구를 삽입하세요."),
                dimension="persuasion_density",
            ))

    # Check BGM
    audio = recipe.get("audio") or {}
    music = audio.get("music", {})
    if not music.get("present"):
        rx = prescriptions.get("no_bgm", {})
        if rx:
            diagnoses.append(DiagnosisItem(
                time_range="전체",
                severity=rx.get("level", "info"),
                finding="BGM 없음",
                prescription=rx.get("message", ""),
                dimension="audio_stimulus",
            ))

    # Check text heaviness (caption-heavy videos)
    if caption_map:
        cap_time = caption_map.get("total_caption_time", 0)
        cap_ratio = min(cap_time / max(duration, 1), 1.0)
        if cap_ratio > 0.8:
            rx = prescriptions.get("text_heavy", {})
            if rx:
                diagnoses.append(DiagnosisItem(
                    time_range="전체",
                    severity=rx.get("level", "info"),
                    finding=f"텍스트 오버레이 비율 {cap_time / duration:.0%}",
                    prescription=rx.get("message", ""),
                    dimension="information_density",
                ))

    return diagnoses


# ── Main entry point ─────────────────────────────────────────────────────────


def _evaluate_scene_appeals(
    scene_index: int,
    role: str,
    appeals: list[dict],
    s_dur: float,
    s_start: float,
    duration: float,
    effective_appeals: set,
    has_transcript: bool,
) -> str:
    """Generate a concise evaluation comment for a scene's appeals."""
    if not appeals and s_dur < 0.8:
        return ""  # Very short scene, skip

    # Role expectations
    role_expectations = {
        "hook": "시청자의 즉각적인 관심을 끌어야 하는 구간",
        "demo": "제품/기능을 구체적으로 보여줘야 하는 구간",
        "proof": "주장을 뒷받침할 증거가 필요한 구간",
        "solution": "문제의 해결책을 제시해야 하는 구간",
        "cta": "행동을 유도해야 하는 구간",
        "recap": "핵심 메시지를 정리하는 구간",
        "problem": "문제/공감을 제기하는 구간",
    }

    parts = []

    # 1. No appeals
    if not appeals:
        expectation = role_expectations.get(role, "")
        if role in ("hook", "cta", "demo"):
            parts.append(f"소구 없음 — {expectation}인데 설득 포인트가 빠져있습니다.")
            if role == "cta":
                parts.append("가격, 긴급성, 보장 등 행동 유도 소구를 추가하세요.")
            elif role == "hook":
                parts.append("문제제기, 충격적 수치, 강한 감정 등 즉각적인 소구가 필요합니다.")
        else:
            parts.append(f"소구 없음 — 정보 전달이나 전환 역할의 구간입니다.")
        return " ".join(parts)

    # 2. Appeal effectiveness
    appeal_types = [a.get("type", "") for a in appeals]
    effective_count = sum(1 for t in appeal_types if t in effective_appeals)
    ineffective = [a for a in appeals if a.get("type", "") not in effective_appeals and a.get("type", "")]

    if effective_count == len(appeals) and len(appeals) >= 2:
        parts.append(f"소구 {len(appeals)}개 모두 이 스타일에 효과적인 유형입니다.")
    elif effective_count > 0:
        parts.append(f"소구 {len(appeals)}개 중 {effective_count}개가 효과적.")
        if ineffective:
            ineff_names = [a.get("type_ko", a.get("type", "")) for a in ineffective[:2]]
            parts.append(f"{', '.join(ineff_names)}은(는) 이 스타일에서 효과가 낮을 수 있습니다.")
    elif appeals:
        parts.append(f"소구 {len(appeals)}개가 있으나 스타일에 최적화된 소구 유형이 아닙니다.")

    # 3. Source diversity
    sources = [a.get("source", "") for a in appeals]
    visual_only = all(s == "visual" for s in sources if s)
    script_only = all(s == "script" for s in sources if s)
    has_both = any(s == "both" for s in sources)

    if has_both:
        parts.append("화면+음성 동시 전달(복합 소구)이 있어 설득력이 높습니다.")
    elif visual_only and has_transcript:
        parts.append("비주얼만으로 전달 — 나레이션과 연동하면 설득력이 강화됩니다.")
    elif script_only:
        parts.append("음성으로만 전달 — 화면에 텍스트/이미지 증거를 추가하면 효과적입니다.")

    # 4. Role-specific advice
    if role == "hook" and len(appeals) < 2:
        parts.append("훅 구간은 최소 2개 이상의 빠른 소구가 권장됩니다.")
    elif role == "cta":
        cta_types = {"price", "urgency", "guarantee"}
        if not any(t in cta_types for t in appeal_types):
            parts.append("CTA 구간에 가격/긴급성/보장 소구가 없습니다 — 구매 전환을 위해 추가를 권장합니다.")

    return " ".join(parts)


def _analyze_scenes(recipe: dict, profile: dict, duration: float, stt_data: dict | None = None) -> list[dict]:
    from .appeal_labels import appeal_ko, technique_ko, format_appeal
    """Analyze each scene individually, generating per-scene diagnostics.

    Returns list of scene analysis dicts with:
      scene_id, time_range, role, attention, appeal_count, diagnoses[]
    """
    scene_cards = recipe.get("scene_cards", [])
    if not scene_cards:
        # Fall back to scenes
        scene_cards = recipe.get("scenes", [])
    if not scene_cards:
        return []

    thresholds = profile.get("thresholds", {})
    effective_appeals = set(profile.get("effective_appeals", []))
    max_gap = thresholds.get("appeal_gap_max_sec", 4.0)

    results = []
    prev_appeal_end = 0.0  # track last appeal time for gap detection

    for i, sc in enumerate(scene_cards):
        tr = sc.get("time_range", [0, 0])
        s_start = tr[0] if isinstance(tr, list) and len(tr) >= 2 else 0
        s_end = tr[1] if isinstance(tr, list) and len(tr) >= 2 else 0
        s_dur = s_end - s_start
        role = sc.get("role", "unknown")
        attn = sc.get("attention_score") or sc.get("attention_avg", 50)

        appeals = sc.get("appeal_points", [])
        appeal_types = [a.get("type", "") for a in appeals if isinstance(a, dict)]
        text_overlays = sc.get("text_overlays", []) or sc.get("text_effects", [])

        scene_diags = []

        # 1. Low attention scene
        if isinstance(attn, (int, float)) and attn < 30 and role not in ("transition", "brand_close"):
            scene_diags.append({
                "time_range": f"{s_start:.1f}-{s_end:.1f}s",
                "severity": "warning",
                "finding": f"씬 {i+1} ({role}): 집중도 {attn}점으로 매우 낮음",
                "prescription": f"이 구간({s_start:.1f}-{s_end:.1f}s)에 시각 자극이나 소구를 추가하세요.",
                "dimension": "visual_stimulus",
                "style_context": "",
            })

        # 2. Appeal gap detection
        if appeals:
            first_appeal_time = None
            for a in appeals:
                vp = a.get("visual_proof", {}) if isinstance(a, dict) else {}
                ts = vp.get("timestamp") if isinstance(vp, dict) else None
                if ts is not None:
                    first_appeal_time = float(ts)
                    break
            if first_appeal_time is None:
                first_appeal_time = s_start

            gap = first_appeal_time - prev_appeal_end
            if gap > max_gap and i > 0:
                scene_diags.append({
                    "time_range": f"{prev_appeal_end:.1f}-{first_appeal_time:.1f}s",
                    "severity": "warning",
                    "finding": f"소구 공백 {gap:.1f}초 (씬 {i}→{i+1} 사이)",
                    "prescription": f"{prev_appeal_end:.1f}-{first_appeal_time:.1f}초 구간에 소구를 삽입하세요.",
                    "dimension": "persuasion_density",
                    "style_context": "",
                })

            # Update last appeal time
            last_ts = s_end
            for a in appeals:
                vp = a.get("visual_proof", {}) if isinstance(a, dict) else {}
                ts = vp.get("timestamp") if isinstance(vp, dict) else None
                if ts is not None:
                    last_ts = max(last_ts, float(ts))
            prev_appeal_end = last_ts
        else:
            # No appeals in this scene — check if it's long enough to matter
            if s_dur > max_gap and role not in ("transition", "brand_intro", "brand_close"):
                scene_diags.append({
                    "time_range": f"{s_start:.1f}-{s_end:.1f}s",
                    "severity": "info",
                    "finding": f"씬 {i+1} ({role}, {s_dur:.1f}초): 소구 없음",
                    "prescription": f"이 구간에 적절한 소구를 추가하면 설득력이 높아집니다.",
                    "dimension": "persuasion_density",
                    "style_context": "",
                })

        # 3. Weak appeal usage in this scene
        weak_appeals = set(profile.get("weak_appeals", []))
        used_weak = [t for t in appeal_types if t in weak_appeals]
        if used_weak:
            scene_diags.append({
                "time_range": f"{s_start:.1f}-{s_end:.1f}s",
                "severity": "info",
                "finding": f"씬 {i+1}: 이 스타일에서 약한 소구 사용 ({', '.join(used_weak)})",
                "prescription": f"더 효과적인 소구로 교체를 고려하세요: {', '.join(list(effective_appeals)[:3])}",
                "dimension": "persuasion_density",
                "style_context": "",
            })

        # 4. Long scene without visual change (stagnation risk)
        if s_dur > 5.0 and role not in ("hook", "cta"):
            scene_diags.append({
                "time_range": f"{s_start:.1f}-{s_end:.1f}s",
                "severity": "info",
                "finding": f"씬 {i+1} ({role}): {s_dur:.1f}초로 길어 정체 위험",
                "prescription": "중간에 컷 전환이나 시각 변화를 넣어 지루함을 방지하세요.",
                "dimension": "edit_rhythm",
                "style_context": "",
            })

        # Build appeal details with Korean labels and visual proof
        appeal_details = []
        for a in appeals:
            if isinstance(a, dict):
                detail = {
                    "type": a.get("type", ""),
                    "type_ko": appeal_ko(a.get("type", "")),
                    "claim": a.get("claim", ""),
                    "strength": a.get("strength", ""),
                    "formatted": format_appeal(a),
                }
                vp = a.get("visual_proof", {})
                if isinstance(vp, dict):
                    detail["technique"] = vp.get("technique", "")
                    detail["technique_ko"] = technique_ko(vp.get("technique", ""))
                    detail["visual_description"] = vp.get("description", "")
                appeal_details.append(detail)

        # Extract transcript segments from Phase 0 Soniox STT
        transcript_texts = []
        if stt_data:
            for seg in stt_data.get("segments", []):
                seg_start = seg.get("start", 0)
                seg_end = seg.get("end", 0)
                # Overlap check with scene boundaries
                if seg_end > s_start and seg_start < s_end and seg.get("text", "").strip():
                    transcript_texts.append({
                        "start": seg_start,
                        "end": seg_end,
                        "text": seg.get("text", ""),
                    })

        # Extract source from appeals
        for detail in appeal_details:
            # Find matching appeal to get source
            for a in appeals:
                if isinstance(a, dict) and a.get("type") == detail.get("type") and a.get("claim") == detail.get("claim"):
                    detail["source"] = a.get("source", "")
                    detail["timestamp"] = a.get("visual_proof", {}).get("timestamp") if isinstance(a.get("visual_proof"), dict) else None
                    break

        # Scene evaluation comment
        eval_comment = _evaluate_scene_appeals(
            scene_index=i + 1,
            role=role,
            appeals=appeal_details,
            s_dur=s_dur,
            s_start=s_start,
            duration=duration,
            effective_appeals=effective_appeals,
            has_transcript=len(transcript_texts) > 0,
        )

        results.append({
            "scene_index": i + 1,
            "time_range": f"{s_start:.1f}-{s_end:.1f}s",
            "role": role,
            "attention": attn,
            "appeal_count": len(appeals),
            "appeal_types": appeal_types,
            "appeal_types_ko": [appeal_ko(t) for t in appeal_types],
            "appeal_details": appeal_details,
            "transcript": transcript_texts,
            "text_count": len(text_overlays),
            "duration": round(s_dur, 2),
            "diagnoses": scene_diags,
            "evaluation": eval_comment,
        })

    return results


def run_integrated_analysis(
    recipe: dict,
    stt_data: dict | None = None,
    style_data: dict | None = None,
    caption_map: dict | None = None,
    raw_temporal: dict | None = None,
) -> IntegratedDiagnosis:
    """Run 3-stage integrated analysis.

    Args:
        recipe: VideoRecipe dict (from Phase 6 or partial)
        stt_data: Phase 0 STT result dict
        style_data: Phase 0.1 style classification dict
        caption_map: C-8 caption map dict

    Returns:
        IntegratedDiagnosis with all three stages.
    """
    from .style_classifier import FORMAT_LABELS_KO, INTENT_LABELS_KO
    from .style_profiles import get_merged_profile

    # ── Stage 1: Classification ──────────────────────────────────────────
    fmt_key = (style_data or {}).get("primary_format", "caption_text")
    int_key = (style_data or {}).get("primary_intent", "commerce")
    fmt_ko = FORMAT_LABELS_KO.get(fmt_key, fmt_key)
    int_ko = INTENT_LABELS_KO.get(int_key, int_key)
    sec_fmt = (style_data or {}).get("secondary_format")
    nar_type = (stt_data or {}).get("narration_type", "silent")

    profile = get_merged_profile(fmt_key, int_key)
    weights = profile.get("dimension_weights", {})

    duration = (recipe.get("meta") or {}).get("duration", 30)
    scenes = recipe.get("scenes", [])
    scenes_dicts = [s if isinstance(s, dict) else s for s in scenes]

    # ── Stage 2: Simultaneous multi-axis analysis ────────────────────────
    # Use raw_temporal if available (has more detail than recipe.temporal_profile)
    temporal_source = raw_temporal if raw_temporal else recipe

    calculators = {
        "visual_stimulus": lambda: _calc_visual_stimulus(temporal_source, scenes_dicts),
        "persuasion_density": lambda: _calc_persuasion_density(recipe, scenes_dicts, duration, nar_type),
        "information_density": lambda: _calc_information_density(recipe, caption_map, stt_data, duration),
        "edit_rhythm": lambda: _calc_edit_rhythm(temporal_source, duration),
        "audio_stimulus": lambda: _calc_audio_stimulus(recipe),
    }

    dimensions: list[DimensionScore] = []
    for dim_name, calc_fn in calculators.items():
        value, evidence = calc_fn()
        w = weights.get(dim_name, 0.2)
        dim = DimensionScore(
            name=dim_name,
            name_ko=DIMENSION_KO.get(dim_name, dim_name),
            value=value,
            weight=w,
            weighted=value * w,
            evidence=evidence,
        )
        dimensions.append(dim)

    engagement = sum(d.weighted for d in dimensions)

    # ── Stage 3: Integrated diagnosis ────────────────────────────────────
    diagnoses = _generate_diagnoses(dimensions, recipe, profile, stt_data, caption_map, duration, raw_temporal=raw_temporal)

    # ── Scene-level analysis ─────────────────────────────────────────
    scene_analyses = _analyze_scenes(recipe, profile, duration, stt_data=stt_data)
    # Merge scene-level diagnoses into main list
    for sa in scene_analyses:
        for dx in sa.get("diagnoses", []):
            diagnoses.append(DiagnosisItem(**dx))

    # Hook analysis (first 3 seconds)
    hook_analysis = _analyze_hook(scene_analyses, recipe, duration)

    # Strip per-scene diagnoses from scene_analyses (avoid duplication in output)
    scene_analyses_clean = []
    for sa in scene_analyses:
        sa_copy = {k: v for k, v in sa.items() if k != "diagnoses"}
        sa_copy["diagnosis_count"] = len(sa.get("diagnoses", []))
        scene_analyses_clean.append(sa_copy)

    # Generate summary
    strengths = []
    weaknesses = []
    for d in dimensions:
        if d.value >= 70:
            strengths.append(f"{d.name_ko} 우수 ({d.value:.0f}점)")
        elif d.value < 40:
            weaknesses.append(f"{d.name_ko} 부족 ({d.value:.0f}점)")

    danger_count = sum(1 for dx in diagnoses if dx.severity == "danger")
    warning_count = sum(1 for dx in diagnoses if dx.severity == "warning")

    if danger_count > 0:
        summary = f"{fmt_ko}×{int_ko} 영상으로, 즉시 개선이 필요한 위험 요소가 {danger_count}건 발견되었습니다."
    elif warning_count > 0:
        summary = f"{fmt_ko}×{int_ko} 영상으로, {warning_count}건의 개선 포인트가 있습니다."
    else:
        summary = f"{fmt_ko}×{int_ko} 영상으로, 전반적으로 양호합니다."

    if strengths:
        summary += f" 강점: {', '.join(strengths[:2])}."

    return IntegratedDiagnosis(
        format_key=fmt_key,
        format_ko=fmt_ko,
        intent_key=int_key,
        intent_ko=int_ko,
        secondary_format=sec_fmt,
        narration_type=nar_type,
        dimensions=dimensions,
        engagement_score=engagement,
        diagnoses=diagnoses,
        scene_analyses=scene_analyses_clean,
        hook_analysis=hook_analysis,
        summary=summary,
        strengths=strengths,
        weaknesses=weaknesses,
    )


def _analyze_hook(scene_analyses: list[dict], recipe: dict, duration: float) -> dict:
    """Analyze the first 3 seconds (hook) — appeal structure, timing, verdict."""
    HOOK_WINDOW = 3.0  # seconds

    # Collect all appeals within first 3s
    hook_appeals = []
    hook_transcript = []
    hook_scenes = []

    for sa in scene_analyses:
        tr = sa.get("time_range", "0.0-0.0s")
        match = __import__("re").match(r"([\d.]+)-([\d.]+)", tr)
        if not match:
            continue
        s_start, s_end = float(match.group(1)), float(match.group(2))

        # Scene overlaps with first 3 seconds?
        if s_start >= HOOK_WINDOW:
            continue

        hook_scenes.append(sa)

        for a in (sa.get("appeal_details") or []):
            ts = a.get("timestamp")
            if ts is not None and float(ts) <= HOOK_WINDOW:
                hook_appeals.append(a)
            elif ts is None and s_start < HOOK_WINDOW:
                hook_appeals.append(a)

        for seg in (sa.get("transcript") or []):
            if seg.get("start", 0) < HOOK_WINDOW:
                hook_transcript.append(seg)

    # First appeal time
    first_appeal_time = None
    for a in hook_appeals:
        ts = a.get("timestamp")
        if ts is not None:
            if first_appeal_time is None or float(ts) < first_appeal_time:
                first_appeal_time = float(ts)

    # Appeal sequence
    appeal_sequence = []
    sorted_appeals = sorted(hook_appeals, key=lambda a: float(a.get("timestamp", 0) or 0))
    for a in sorted_appeals:
        appeal_sequence.append({
            "type": a.get("type", ""),
            "type_ko": a.get("type_ko", ""),
            "source": a.get("source", ""),
            "timestamp": a.get("timestamp"),
            "claim": a.get("claim", "")[:60],
        })

    # Hook type detection
    hook_type = "unknown"
    hook_type_ko = "미분류"
    if hook_appeals:
        first_type = sorted_appeals[0].get("type", "") if sorted_appeals else ""
        first_claim = (sorted_appeals[0].get("claim", "") if sorted_appeals else "").lower()

        if first_type == "myth_bust" or "?" in first_claim or "진짜" in first_claim:
            hook_type, hook_type_ko = "question", "질문/문제제기형"
        elif first_type == "emotional" or first_type == "nostalgia":
            hook_type, hook_type_ko = "emotion", "감정/공감형"
        elif first_type in ("price", "urgency", "guarantee"):
            hook_type, hook_type_ko = "benefit", "혜택/긴급형"
        elif first_type in ("spec_data", "track_record", "social_proof"):
            hook_type, hook_type_ko = "proof", "증거/수치형"
        elif first_type in ("feature_demo", "ingredient", "manufacturing"):
            hook_type, hook_type_ko = "demo", "시연/소개형"
        else:
            hook_type, hook_type_ko = "visual", "비주얼 임팩트형"

    # Source breakdown
    visual_count = sum(1 for a in hook_appeals if a.get("source") == "visual")
    script_count = sum(1 for a in hook_appeals if a.get("source") == "script")
    both_count = sum(1 for a in hook_appeals if a.get("source") == "both")

    # Verdict
    verdict = "weak"
    verdict_ko = "⚠️ 약함"
    verdict_detail = ""

    if len(hook_appeals) >= 3 and first_appeal_time is not None and first_appeal_time <= 1.0:
        verdict = "strong"
        verdict_ko = "🟢 강력"
        verdict_detail = f"1초 내 첫 소구, 3초 내 {len(hook_appeals)}개 소구로 강력하게 시청자를 잡습니다."
    elif len(hook_appeals) >= 2 and first_appeal_time is not None and first_appeal_time <= 2.0:
        verdict = "good"
        verdict_ko = "🟡 양호"
        verdict_detail = f"2초 내 첫 소구, {len(hook_appeals)}개 소구. 충분하지만 더 빠른 어필이 가능합니다."
    elif len(hook_appeals) >= 1:
        verdict = "moderate"
        verdict_ko = "🟡 보통"
        verdict_detail = f"3초 내 {len(hook_appeals)}개 소구. 첫 소구가 {first_appeal_time:.1f}초로 다소 늦습니다."
    else:
        verdict_detail = "3초 내 감지된 소구가 없습니다. 훅 구간에 강력한 소구를 추가하세요."

    # Product visibility in first 3s
    product_first = recipe.get("persuasion_analysis", {}).get("product_emphasis", {}).get("first_appear")
    product_in_hook = product_first is not None and float(product_first) <= HOOK_WINDOW

    return {
        "window_sec": HOOK_WINDOW,
        "appeal_count": len(hook_appeals),
        "first_appeal_time": first_appeal_time,
        "appeal_sequence": appeal_sequence,
        "hook_type": hook_type,
        "hook_type_ko": hook_type_ko,
        "source_breakdown": {
            "visual": visual_count,
            "script": script_count,
            "both": both_count,
        },
        "product_in_hook": product_in_hook,
        "product_first_appear": float(product_first) if product_first is not None else None,
        "transcript": hook_transcript,
        "verdict": verdict,
        "verdict_ko": verdict_ko,
        "verdict_detail": verdict_detail,
    }
