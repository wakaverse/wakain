"""Phase 5.5: Appeal Structure — scene clustering + summarization + grouping.

5.5a: cluster_appeals_into_scenes (local, no API)
5.5b: summarize_scenes (Gemini text, 1 call)
5.5c: group_scenes (Gemini text, 1 call)
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from google import genai
from google.genai import types

MODEL = "gemini-2.5-flash-lite"


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY_PRO", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GEMINI_API_KEY_PRO not set.")
    return genai.Client(api_key=api_key)


def _extract_json(text: str) -> Any:
    """Extract JSON from Gemini response, handling markdown fences."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


# ── 5.5a: Local clustering ───────────────────────────────────────────────────


def cluster_appeals_into_scenes(
    appeals: list[dict],
    cut_boundaries: list[tuple[float, float]],
    stt_segments: list[dict],
    text_dwell_items: list[dict],
    transition_events: list[dict],
    frame_quals: list[dict],
) -> list[dict]:
    """Cluster appeals into scenes by merging adjacent cuts."""
    if not cut_boundaries:
        return []

    # Sort boundaries by start time
    cuts = sorted(cut_boundaries, key=lambda b: b[0])

    # 1. Map appeals to cuts
    cut_appeals: dict[int, list[dict]] = {i: [] for i in range(len(cuts))}
    for ap in appeals:
        ts = ap.get("timestamp") or ap.get("visual_proof", {}).get("timestamp", 0.0)
        if ts is None:
            ts = 0.0
        for i, (start, end) in enumerate(cuts):
            if start <= ts < end or (i == len(cuts) - 1 and ts >= start):
                cut_appeals[i].append(ap)
                break

    # 2. Compute merge scores for adjacent cuts
    merge_scores: list[int] = []
    for i in range(len(cuts) - 1):
        score = 0
        boundary_t = cuts[i][1]

        # Speech continuity: STT segment spans the boundary OR gap < 0.5s
        speech_continuous = False
        for seg in stt_segments:
            s, e = seg.get("start", 0), seg.get("end", 0)
            if s < boundary_t < e:
                speech_continuous = True
                break
        if not speech_continuous:
            # Check if a segment ends just before boundary and another starts just after
            for j, seg in enumerate(stt_segments):
                seg_end = seg.get("end", 0)
                if abs(seg_end - boundary_t) < 0.5 and j + 1 < len(stt_segments):
                    next_start = stt_segments[j + 1].get("start", 0)
                    if abs(next_start - boundary_t) < 0.5:
                        speech_continuous = True
                        break
        if speech_continuous:
            score += 3

        # Caption continuity: text_dwell item spans boundary
        for item in text_dwell_items:
            fa = item.get("first_appear", 0)
            la = item.get("last_appear", fa) + item.get("duration", 0.5)
            if fa < boundary_t < la:
                score += 2
                break

        # Same appeal type
        a_appeals = cut_appeals[i]
        b_appeals = cut_appeals[i + 1]
        if a_appeals and b_appeals:
            if a_appeals[-1].get("type") == b_appeals[0].get("type"):
                score += 2

        # Empty cut B
        if not b_appeals:
            score += 1

        # Smooth transition (dissolve/fade)
        for ev in transition_events:
            evt = ev.get("timestamp", -1)
            if abs(evt - boundary_t) < 0.6:
                if ev.get("type", "") in ("dissolve", "fade"):
                    score += 1
                break

        # Visual continuity (same shot_type)
        fq_a = _get_frame_qual_at(frame_quals, cuts[i][1] - 0.25)
        fq_b = _get_frame_qual_at(frame_quals, cuts[i + 1][0] + 0.25)
        if fq_a and fq_b and fq_a.get("shot_type") == fq_b.get("shot_type"):
            score += 1

        merge_scores.append(score)

    # 3. Build scenes by merging (threshold >= 3, max 5s)
    scenes: list[dict] = []
    current_cuts = [0]

    for i in range(len(cuts) - 1):
        merged_start = cuts[current_cuts[0]][0]
        candidate_end = cuts[i + 1][1]
        if merge_scores[i] >= 2 and (candidate_end - merged_start) <= 5.0:
            current_cuts.append(i + 1)
        else:
            scenes.append(_build_scene(len(scenes) + 1, current_cuts, cuts, cut_appeals,
                                       stt_segments, text_dwell_items))
            current_cuts = [i + 1]

    # Last scene
    if current_cuts:
        scenes.append(_build_scene(len(scenes) + 1, current_cuts, cuts, cut_appeals,
                                   stt_segments, text_dwell_items))

    # 4. Constraints: absorb short (<1s) and empty scenes
    scenes = _absorb_short_scenes(scenes, merge_scores, cuts)
    scenes = _absorb_empty_scenes(scenes)

    # Re-number
    for i, s in enumerate(scenes):
        s["scene_id"] = i + 1

    return scenes


def _get_frame_qual_at(frame_quals: list[dict], ts: float) -> dict | None:
    best, best_diff = None, float("inf")
    for fq in frame_quals:
        diff = abs(fq.get("timestamp", 0) - ts)
        if diff < best_diff:
            best, best_diff = fq, diff
    return best if best_diff < 1.0 else None


def _build_scene(
    scene_id: int,
    cut_indices: list[int],
    cuts: list[tuple[float, float]],
    cut_appeals: dict[int, list[dict]],
    stt_segments: list[dict],
    text_dwell_items: list[dict],
) -> dict:
    start = cuts[cut_indices[0]][0]
    end = cuts[cut_indices[-1]][1]
    all_appeals = []
    for ci in cut_indices:
        all_appeals.extend(cut_appeals[ci])

    # Gather STT text for this range
    stt_texts = []
    for seg in stt_segments:
        s, e = seg.get("start", 0), seg.get("end", 0)
        if s < end and e > start:
            stt_texts.append(seg.get("text", ""))

    # Gather caption text
    cap_texts = []
    for item in text_dwell_items:
        fa = item.get("first_appear", 0)
        la = item.get("last_appear", fa) + item.get("duration", 0.5)
        if fa < end and la > start:
            cap_texts.append(item.get("content", ""))

    return {
        "scene_id": scene_id,
        "time_range": [round(start, 2), round(end, 2)],
        "cuts": [
            {"cut_id": ci + 1, "time_range": [round(cuts[ci][0], 2), round(cuts[ci][1], 2)]}
            for ci in cut_indices
        ],
        "appeals": all_appeals,
        "stt_text": " ".join(stt_texts).strip(),
        "caption_text": " ".join(cap_texts).strip(),
    }


def _absorb_short_scenes(scenes: list[dict], merge_scores: list[int], cuts) -> list[dict]:
    """Absorb scenes shorter than 1.0s into neighbors."""
    changed = True
    while changed:
        changed = False
        new_scenes = []
        i = 0
        while i < len(scenes):
            s = scenes[i]
            duration = s["time_range"][1] - s["time_range"][0]
            if duration < 1.0 and len(scenes) > 1:
                # Merge into prev or next
                if i > 0:
                    target = new_scenes[-1]
                elif i < len(scenes) - 1:
                    target = scenes[i + 1]
                    i += 1
                else:
                    new_scenes.append(s)
                    i += 1
                    continue
                target["time_range"][1] = max(target["time_range"][1], s["time_range"][1])
                target["time_range"][0] = min(target["time_range"][0], s["time_range"][0])
                target["cuts"].extend(s["cuts"])
                target["appeals"].extend(s["appeals"])
                if s["stt_text"]:
                    target["stt_text"] = (target["stt_text"] + " " + s["stt_text"]).strip()
                if s["caption_text"]:
                    target["caption_text"] = (target["caption_text"] + " " + s["caption_text"]).strip()
                changed = True
            else:
                new_scenes.append(s)
            i += 1
        scenes = new_scenes
    return scenes


def _absorb_empty_scenes(scenes: list[dict]) -> list[dict]:
    """Absorb scenes with 0 appeals into neighbors."""
    changed = True
    while changed:
        changed = False
        new_scenes = []
        i = 0
        while i < len(scenes):
            s = scenes[i]
            if not s["appeals"] and len(scenes) > 1:
                if i > 0:
                    target = new_scenes[-1]
                elif i < len(scenes) - 1:
                    target = scenes[i + 1]
                    i += 1
                else:
                    new_scenes.append(s)
                    i += 1
                    continue
                target["time_range"][1] = max(target["time_range"][1], s["time_range"][1])
                target["time_range"][0] = min(target["time_range"][0], s["time_range"][0])
                target["cuts"].extend(s["cuts"])
                target["appeals"].extend(s["appeals"])
                if s["stt_text"]:
                    target["stt_text"] = (target["stt_text"] + " " + s["stt_text"]).strip()
                if s["caption_text"]:
                    target["caption_text"] = (target["caption_text"] + " " + s["caption_text"]).strip()
                changed = True
            else:
                new_scenes.append(s)
            i += 1
        scenes = new_scenes
    return scenes


# ── 5.5b: Summarize scenes (Gemini, 1 call) ─────────────────────────────────


def summarize_scenes(scenes: list[dict], product_info: dict) -> list[dict]:
    """Add persuasion_intent to each scene via a single Gemini call."""
    if not scenes:
        return scenes

    client = _make_client()

    scene_block = []
    for s in scenes:
        appeals_str = ", ".join(
            f'{{{a.get("type","?")}: {a.get("claim", a.get("description",""))[:60]}}}'
            for a in s["appeals"]
        ) or "(없음)"
        scene_block.append(
            f'씬{s["scene_id"]} ({s["time_range"][0]}-{s["time_range"][1]}s):\n'
            f'  대본: "{s.get("stt_text", "")[:100]}"\n'
            f'  자막: "{s.get("caption_text", "")[:100]}"\n'
            f'  소구: [{appeals_str}]'
        )

    product_str = json.dumps(product_info, ensure_ascii=False) if product_info else "{}"

    prompt = (
        "당신은 마케팅 영상 분석 전문가입니다.\n"
        "아래는 숏폼 마케팅 영상의 씬별 정보입니다.\n\n"
        f"[제품]: {product_str}\n\n"
        "[씬 목록]\n" + "\n\n".join(scene_block) + "\n\n"
        "각 씬의 \"설득 의도\"를 한 줄로 요약해주세요.\n"
        'JSON 배열로 응답: [{"scene_id": 1, "persuasion_intent": "..."}, ...]'
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=[prompt],
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )

    try:
        summaries = _extract_json(response.text)
    except Exception:
        summaries = []

    intent_map = {s.get("scene_id"): s.get("persuasion_intent", "") for s in summaries}
    for s in scenes:
        s["persuasion_intent"] = intent_map.get(s["scene_id"], "")

    return scenes


# ── 5.5c: Group scenes (Gemini, 1 call) ─────────────────────────────────────


def group_scenes(scenes: list[dict], product_info: dict) -> list[dict]:
    """Group scenes into persuasion strategy groups via Gemini."""
    if not scenes:
        return []

    client = _make_client()

    product_str = json.dumps(product_info, ensure_ascii=False) if product_info else "{}"

    summary_block = "\n".join(
        f'씬{s["scene_id"]}: "{s.get("persuasion_intent", "?")}"'
        for s in scenes
    )

    prompt = (
        "당신은 마케팅 전략 분석 전문가입니다.\n\n"
        f"[제품]: {product_str}\n\n"
        "[씬 요약]\n" + summary_block + "\n\n"
        "마케팅 프레임워크(AIDA, PAS 등)를 참고하여 위 씬들을 설득 전략 그룹으로 묶어주세요.\n"
        "각 그룹에 이름과 설명을 붙여주세요.\n\n"
        'JSON 응답:\n'
        '{\n'
        '  "groups": [\n'
        '    {\n'
        '      "group_id": 1,\n'
        '      "name": "주의 환기",\n'
        '      "description": "문제 상황으로 시선을 포착하고 공감을 유도",\n'
        '      "scene_ids": [1],\n'
        '      "color": "#FF6B6B"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=[prompt],
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    try:
        result = _extract_json(response.text)
        groups = result.get("groups", result) if isinstance(result, dict) else result
    except Exception:
        groups = []

    return groups
