"""Phase 7 Diagnosis Engine — 3-axis marketing video diagnosis.

Axes:
  1. Appeal Structure (소구 구성) — strategic level
  2. Appeal Points (소구 포인트/키워드) — content level
  3. Rhythm Profile (리듬 프로파일) — execution level

Each axis outputs: score (0-100) + quantitative facts + qualitative diagnoses.
"""

from __future__ import annotations

import re
from typing import Any

# ── Constants ────────────────────────────────────────────────────────────────

AIDA_KEYWORDS: dict[str, list[str]] = {
    "attention": ["주의", "환기", "후킹", "hook", "attention", "문제", "공감"],
    "interest": ["흥미", "호기심", "관심", "interest", "해결책"],
    "desire": ["효능", "입증", "신뢰", "desire", "증명", "시연", "데모"],
    "action": ["행동", "유도", "cta", "action", "구매", "전환"],
}

AIDA_ORDER = ["attention", "interest", "desire", "action"]

CATEGORY_CORE_APPEALS: dict[str, dict[str, list[str]]] = {
    "food": {
        "must": ["ingredient", "manufacturing"],
        "recommended": ["origin", "feature_demo", "authenticity"],
    },
    "beauty": {
        "must": ["feature_demo", "design_aesthetic"],
        "recommended": ["ingredient", "social_proof", "authenticity"],
    },
    "electronics": {
        "must": ["feature_demo", "spec_data"],
        "recommended": ["comparison", "price", "guarantee"],
    },
    "living": {
        "must": ["feature_demo"],
        "recommended": ["price", "comparison", "design_aesthetic"],
    },
    "health": {
        "must": ["ingredient", "authority"],
        "recommended": ["track_record", "authenticity", "feature_demo"],
    },
    "fashion": {
        "must": ["design_aesthetic", "lifestyle"],
        "recommended": ["social_proof", "authenticity"],
    },
    "service": {
        "must": ["feature_demo", "price"],
        "recommended": ["guarantee", "social_proof", "comparison"],
    },
    "general": {
        "must": ["feature_demo"],
        "recommended": ["price", "social_proof"],
    },
}

ROLE_EXPECTED_TEMPO: dict[str, str] = {
    "hook": "high",
    "problem": "medium",
    "solution": "medium",
    "demo": "medium",
    "proof": "medium",
    "brand_intro": "medium",
    "recap": "medium",
    "cta": "low",
    "transition": "any",
    "body": "medium",
}


# ── Public API ───────────────────────────────────────────────────────────────

def run_diagnosis(
    appeal_structure: dict,
    product_info: dict,
    recipe: dict,
    stt_data: dict | None,
    caption_map: dict | None,
) -> dict:
    """Run 3-axis diagnosis and return result dict."""
    axis1 = _diagnose_appeal_structure(appeal_structure, stt_data)
    axis2 = _diagnose_appeal_points(appeal_structure, product_info, stt_data, caption_map)
    axis3 = _diagnose_rhythm(recipe, appeal_structure)

    axes = [axis1, axis2, axis3]
    overall = round(axis1["score"] * 0.35 + axis2["score"] * 0.35 + axis3["score"] * 0.30)

    # Collect top actions from all diagnoses (warnings/dangers first)
    all_diags: list[dict] = []
    for ax in axes:
        for d in ax["diagnoses"]:
            all_diags.append(d)
    # Sort: danger first, then warning
    severity_order = {"danger": 0, "warning": 1, "ok": 2}
    all_diags.sort(key=lambda d: severity_order.get(d["severity"], 9))
    top_3 = [d["recommendation"] for d in all_diags[:3]]

    return {
        "axes": axes,
        "overall_score": overall,
        "top_3_actions": top_3,
    }


# ── Axis 1: Appeal Structure ────────────────────────────────────────────────

def _diagnose_appeal_structure(appeal_structure: dict, stt_data: dict | None) -> dict:
    groups = appeal_structure.get("groups", [])
    scenes = appeal_structure.get("scenes", [])

    # AIDA mapping
    aida_coverage: dict[str, bool] = {k: False for k in AIDA_ORDER}
    group_aida_map: list[tuple[int, str]] = []  # (group_id, aida_stage)

    for g in groups:
        text = f"{g.get('name', '')} {g.get('description', '')}".lower()
        for stage, keywords in AIDA_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                aida_coverage[stage] = True
                group_aida_map.append((g.get("group_id", 0), stage))
                break

    covered_count = sum(1 for v in aida_coverage.values() if v)

    # Time distribution per group
    group_durations: dict[str, float] = {}
    total_duration = 0.0
    for g in groups:
        dur = 0.0
        for s in scenes:
            if s.get("scene_id") in g.get("scene_ids", []):
                tr = s.get("time_range", [0, 0])
                dur += tr[1] - tr[0] if len(tr) >= 2 else 0
        group_durations[g.get("name", f"group_{g.get('group_id', 0)}")] = dur
        total_duration += dur

    time_distribution = []
    for name, dur in group_durations.items():
        ratio = round(dur / total_duration, 2) if total_duration > 0 else 0
        time_distribution.append({"name": name, "ratio": ratio})

    # Empty gaps detection
    scene_ranges = sorted(
        [(s["time_range"][0], s["time_range"][1]) for s in scenes if s.get("time_range") and len(s["time_range"]) >= 2],
        key=lambda x: x[0],
    )
    empty_gaps = []
    for i in range(len(scene_ranges) - 1):
        gap_start = scene_ranges[i][1]
        gap_end = scene_ranges[i + 1][0]
        if gap_end - gap_start > 0.5:
            empty_gaps.append({"time_range": [round(gap_start, 1), round(gap_end, 1)], "duration": round(gap_end - gap_start, 1)})

    # Source ratio
    script_count = 0
    visual_count = 0
    for s in scenes:
        for ap in s.get("appeals", s.get("appeal_points", [])):
            src = ap.get("source", "both")
            if src == "script":
                script_count += 1
            elif src == "visual":
                visual_count += 1
            else:
                script_count += 0.5
                visual_count += 0.5
    total_src = script_count + visual_count
    source_ratio = {
        "script": round(script_count / total_src, 2) if total_src > 0 else 0.5,
        "visual": round(visual_count / total_src, 2) if total_src > 0 else 0.5,
    }

    total_appeals = sum(len(s.get("appeals", s.get("appeal_points", []))) for s in scenes)
    scene_count = len(scenes)
    avg_appeals = round(total_appeals / scene_count, 1) if scene_count > 0 else 0

    # ── Score calculation ──
    # 1. AIDA coverage (30pts)
    score_aida = (covered_count / 4) * 30

    # 2. Balance (20pts)
    ratios = [td["ratio"] for td in time_distribution] if time_distribution else [1.0]
    max_ratio = max(ratios) if ratios else 0.25
    score_balance = max(0, min(20, (1 - (max_ratio - 0.25) * 2) * 20))

    # 3. AIDA order (20pts)
    actual_order = [stage for _, stage in sorted(group_aida_map)]
    # Count longest increasing subsequence matching AIDA_ORDER
    if actual_order:
        order_matches = 0
        last_idx = -1
        for stage in actual_order:
            if stage in AIDA_ORDER:
                idx = AIDA_ORDER.index(stage)
                if idx >= last_idx:
                    order_matches += 1
                    last_idx = idx
        score_order = (order_matches / len(actual_order)) * 20 if actual_order else 20
    else:
        score_order = 10  # no data, neutral

    # 4. No empty gaps (15pts)
    total_gap_time = sum(g["duration"] for g in empty_gaps)
    gap_ratio = total_gap_time / total_duration if total_duration > 0 else 0
    score_gaps = max(0, (1 - gap_ratio * 5) * 15)

    # 5. Source balance (15pts)
    sr = source_ratio["script"]
    if 0.4 <= sr <= 0.6:
        score_source = 15
    else:
        deviation = max(abs(sr - 0.5) - 0.1, 0)
        score_source = max(0, (1 - deviation * 5) * 15)

    score = round(score_aida + score_balance + score_order + score_gaps + score_source)
    score = max(0, min(100, score))

    # ── Diagnoses ──
    diagnoses: list[dict] = []
    for stage in AIDA_ORDER:
        if not aida_coverage[stage]:
            stage_names = {"attention": "Attention(주의 환기)", "interest": "Interest(흥미 유발)",
                           "desire": "Desire(욕구 자극)", "action": "Action(행동 유도)"}
            diagnoses.append({
                "severity": "warning",
                "finding": f"{stage_names[stage]} 단계 누락",
                "recommendation": f"{stage_names[stage]} 단계를 추가하여 AIDA 구조 완성 권장",
            })

    if max_ratio > 0.5 and time_distribution:
        dominant = max(time_distribution, key=lambda x: x["ratio"])
        diagnoses.append({
            "severity": "warning",
            "finding": f"'{dominant['name']}' 그룹 편중 ({int(dominant['ratio'] * 100)}%)",
            "recommendation": "다른 구간의 비중을 늘려 균형 잡힌 구성 권장",
        })

    for gap in empty_gaps:
        diagnoses.append({
            "severity": "danger" if gap["duration"] > 3 else "warning",
            "finding": f"{gap['time_range'][0]}-{gap['time_range'][1]}s 소구 공백 ({gap['duration']}s)",
            "recommendation": "해당 구간에 소구 포인트 또는 전환 요소 추가",
        })

    if sr < 0.3 or sr > 0.7:
        diagnoses.append({
            "severity": "warning",
            "finding": f"대본/비주얼 불균형 (대본 {int(sr * 100)}%)",
            "recommendation": "대본과 비주얼 소구의 균형 조정 권장 (40-60% 적정)",
        })

    if not diagnoses:
        diagnoses.append({"severity": "ok", "finding": "소구 구성이 균형 잡혀 있음", "recommendation": ""})

    return {
        "id": "appeal_structure",
        "name": "소구 구성",
        "score": score,
        "facts": {
            "group_count": len(groups),
            "aida_coverage": aida_coverage,
            "time_distribution": time_distribution,
            "empty_gaps": empty_gaps,
            "source_ratio": source_ratio,
            "scene_count": scene_count,
            "total_appeals": total_appeals,
            "appeals_per_scene_avg": avg_appeals,
        },
        "diagnoses": diagnoses,
    }


# ── Axis 2: Appeal Points ───────────────────────────────────────────────────

def _diagnose_appeal_points(
    appeal_structure: dict,
    product_info: dict,
    stt_data: dict | None,
    caption_map: dict | None,
) -> dict:
    scenes = appeal_structure.get("scenes", [])
    category = product_info.get("category", "general").lower()
    product_name = product_info.get("product_name", "")

    # Collect all appeal types
    type_counts: dict[str, int] = {}
    strength_counts: dict[str, int] = {"strong": 0, "moderate": 0, "weak": 0}
    for s in scenes:
        for ap in s.get("appeals", s.get("appeal_points", [])):
            t = ap.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1
            st = ap.get("strength", "moderate")
            if st in strength_counts:
                strength_counts[st] += 1

    total_appeals = sum(strength_counts.values())
    strength_dist = {
        k: round(v / total_appeals, 2) if total_appeals > 0 else 0
        for k, v in strength_counts.items()
    }

    # Category core appeals
    core = CATEGORY_CORE_APPEALS.get(category, CATEGORY_CORE_APPEALS["general"])
    must_coverage = {m: m in type_counts for m in core["must"]}
    recommended_coverage = {r: r in type_counts for r in core["recommended"]}

    # Product name mentions
    script_mentions = 0
    caption_mentions = 0
    if product_name:
        pn_lower = product_name.lower()
        if stt_data:
            transcript = stt_data.get("full_transcript", "")
            script_mentions = transcript.lower().count(pn_lower)
        if caption_map:
            for ev in caption_map.get("events", []):
                if pn_lower in ev.get("text", "").lower() or pn_lower in ev.get("full_text", "").lower():
                    caption_mentions += 1

    used_types = len(type_counts)
    total_possible = 18

    # ── Score ──
    must_covered = sum(1 for v in must_coverage.values() if v)
    must_total = len(must_coverage) or 1
    score_must = (must_covered / must_total) * 40

    rec_covered = sum(1 for v in recommended_coverage.values() if v)
    rec_total = len(recommended_coverage) or 1
    score_rec = (rec_covered / rec_total) * 20

    score_diversity = min(15, (used_types / 10) * 15)

    total_mentions = script_mentions + caption_mentions
    score_mentions = min(15, (total_mentions / 3) * 15)

    score_strong = strength_dist.get("strong", 0) * 10

    score = round(score_must + score_rec + score_diversity + score_mentions + score_strong)
    score = max(0, min(100, score))

    # ── Diagnoses ──
    diagnoses: list[dict] = []
    for m, covered in must_coverage.items():
        if not covered:
            diagnoses.append({
                "severity": "danger",
                "finding": f"필수 소구 '{m}' 누락 ({category} 카테고리)",
                "recommendation": f"'{m}' 유형의 소구 포인트 추가 필요",
            })

    for r, covered in recommended_coverage.items():
        if not covered:
            diagnoses.append({
                "severity": "warning",
                "finding": f"권장 소구 '{r}' 없음",
                "recommendation": f"'{r}' 소구를 추가하면 설득력 향상 기대",
            })

    if total_mentions < 2 and product_name:
        diagnoses.append({
            "severity": "warning",
            "finding": f"제품명 '{product_name}' 언급 부족 ({total_mentions}회)",
            "recommendation": "대본 또는 자막에서 제품명을 3회 이상 노출 권장",
        })

    if used_types <= 2:
        diagnoses.append({
            "severity": "warning",
            "finding": f"소구 유형 다양성 부족 ({used_types}종)",
            "recommendation": "다양한 소구 유형(감성, 가격, 비교 등) 추가 권장",
        })

    if not diagnoses:
        diagnoses.append({"severity": "ok", "finding": "소구 포인트 구성이 적절함", "recommendation": ""})

    return {
        "id": "appeal_points",
        "name": "소구 포인트",
        "score": score,
        "facts": {
            "category": category,
            "product_name": product_name,
            "appeal_types_used": type_counts,
            "must_coverage": must_coverage,
            "recommended_coverage": recommended_coverage,
            "type_diversity": used_types,
            "total_types": total_possible,
            "product_name_mentions": {"script": script_mentions, "caption": caption_mentions},
            "strength_distribution": strength_dist,
        },
        "diagnoses": diagnoses,
    }


# ── Axis 3: Rhythm Profile ──────────────────────────────────────────────────

def _diagnose_rhythm(recipe: dict, appeal_structure: dict) -> dict:
    scene_cards = recipe.get("scene_cards", recipe.get("video_recipe", {}).get("scenes", []))
    groups = appeal_structure.get("groups", [])

    # Build scene_id -> group mapping
    scene_group: dict[int, int] = {}
    for g in groups:
        for sid in g.get("scene_ids", []):
            scene_group[sid] = g.get("group_id", 0)

    scene_rhythms: list[dict] = []
    tempo_sequence: list[str] = []
    overload_scenes: list[dict] = []
    empty_rhythm_scenes: list[int] = []

    for sc in scene_cards:
        sid = sc.get("scene_id", 0)
        role = sc.get("role", "body").lower()
        rp = sc.get("rhythm_profile", {})

        tempo_level = rp.get("tempo_level", rp.get("tempo", "medium"))
        if isinstance(tempo_level, (int, float)):
            tempo_level = "high" if tempo_level >= 0.7 else ("medium" if tempo_level >= 0.4 else "low")

        cut_density = rp.get("cut_density", 0)
        text_changes = rp.get("text_changes", 0)

        expected = ROLE_EXPECTED_TEMPO.get(role, "medium")
        match = (expected == "any") or (tempo_level == expected)

        scene_rhythms.append({
            "scene_id": sid,
            "role": role,
            "tempo_level": tempo_level,
            "cut_density": round(cut_density, 2) if isinstance(cut_density, float) else cut_density,
            "expected": expected,
            "match": match,
        })
        tempo_sequence.append(tempo_level)

        # Overload check
        if text_changes >= 4 and cut_density >= 1.0:
            overload_scenes.append({"scene_id": sid, "text_changes": text_changes, "cut_density": round(cut_density, 2)})

        if not rp:
            empty_rhythm_scenes.append(sid)

    # Dynamic changes count
    dynamic_changes = 0
    for i in range(1, len(tempo_sequence)):
        if tempo_sequence[i] != tempo_sequence[i - 1]:
            dynamic_changes += 1

    total_scenes = len(scene_rhythms)

    # ── Score ──
    # 1. Tempo match rate (30pts)
    matching = sum(1 for sr in scene_rhythms if sr["match"])
    score_match = (matching / total_scenes * 30) if total_scenes > 0 else 15

    # 2. Dynamic range — 2-4 changes optimal (20pts)
    if 2 <= dynamic_changes <= 4:
        score_dynamic = 20
    elif dynamic_changes == 1 or dynamic_changes == 5:
        score_dynamic = 12
    elif dynamic_changes == 0:
        score_dynamic = 5
    else:
        score_dynamic = 8

    # 3. Group boundary tempo changes (20pts)
    boundary_changes = 0
    boundary_total = 0
    prev_group = None
    for sr in scene_rhythms:
        g = scene_group.get(sr["scene_id"])
        if prev_group is not None and g is not None and g != prev_group:
            boundary_total += 1
            idx = next((i for i, s in enumerate(scene_rhythms) if s["scene_id"] == sr["scene_id"]), None)
            if idx and idx > 0 and scene_rhythms[idx]["tempo_level"] != scene_rhythms[idx - 1]["tempo_level"]:
                boundary_changes += 1
        prev_group = g
    score_boundary = (boundary_changes / boundary_total * 20) if boundary_total > 0 else 10

    # 4. No overload (15pts)
    score_overload = max(0, 15 - len(overload_scenes) * 5)

    # 5. CTA appropriateness (15pts)
    cta_scenes = [sr for sr in scene_rhythms if sr["role"] == "cta"]
    if cta_scenes:
        cta_ok = all(sr["tempo_level"] in ("low", "medium") for sr in cta_scenes)
        score_cta = 15 if cta_ok else 7
    else:
        score_cta = 8  # no explicit CTA

    score = round(score_match + score_dynamic + score_boundary + score_overload + score_cta)
    score = max(0, min(100, score))

    # ── Diagnoses ──
    diagnoses: list[dict] = []
    for sr in scene_rhythms:
        if not sr["match"] and sr["expected"] != "any":
            diagnoses.append({
                "severity": "warning",
                "finding": f"씬{sr['scene_id']}({sr['role']}) tempo={sr['tempo_level']} — 기대값 {sr['expected']}와 불일치",
                "recommendation": f"{sr['role']} 구간의 편집 속도를 {sr['expected']}로 조정 권장",
            })

    for ov in overload_scenes:
        diagnoses.append({
            "severity": "danger",
            "finding": f"씬{ov['scene_id']} 정보 과부하 (텍스트 변경 {ov['text_changes']}회, 컷밀도 {ov['cut_density']})",
            "recommendation": "텍스트 변경 횟수를 줄이거나 컷 간격을 늘려 가독성 확보",
        })

    if dynamic_changes == 0:
        diagnoses.append({
            "severity": "warning",
            "finding": "완급 조절 없음 — 전체가 동일 템포",
            "recommendation": "구간별 템포 변화를 주어 시청자 몰입도 향상",
        })

    if not cta_scenes:
        diagnoses.append({
            "severity": "warning",
            "finding": "명시적 CTA 씬 없음",
            "recommendation": "마지막 구간에 행동 유도(CTA) 씬 추가 권장",
        })

    if not diagnoses:
        diagnoses.append({"severity": "ok", "finding": "리듬 구성이 적절함", "recommendation": ""})

    return {
        "id": "rhythm_profile",
        "name": "리듬 프로파일",
        "score": score,
        "facts": {
            "scene_rhythms": scene_rhythms,
            "tempo_sequence": tempo_sequence,
            "dynamic_changes": dynamic_changes,
            "overload_scenes": overload_scenes,
            "empty_rhythm_scenes": empty_rhythm_scenes,
        },
        "diagnoses": diagnoses,
    }
