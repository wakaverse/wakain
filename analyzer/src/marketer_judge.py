"""Phase 7b: Marketer Judge — Gemini-powered marketing verdict.

Uses the user's prompt framework:
1. Verdict: Will this product sell with this video?
2. Evidence: Why / why not? (with timestamps + frame data)
3. Action Plan: Specific to-do list for editors

Combines:
- Phase 1~6 evidence (recipe, scenes, dimensions, STT, captions)
- Phase 2 frame_qual data (per-frame visual analysis)
- Product/category context
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from google import genai
from google.genai import types


@dataclass
class MarketingVerdict:
    """Result of the marketer judge analysis."""
    verdict: str  # "집행 권장" / "조건부 집행" / "집행 불가"
    verdict_summary: str
    evidence: str
    action_plan: str
    full_markdown: str
    product_name: str = ""
    product_category: str = ""

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict,
            "verdict_summary": self.verdict_summary,
            "evidence": self.evidence,
            "action_plan": self.action_plan,
            "full_markdown": self.full_markdown,
            "product_name": self.product_name,
            "product_category": self.product_category,
        }


def _build_evidence_summary(
    recipe: dict,
    diagnosis: dict,
    stt_data: dict | None,
    style_data: dict | None,
    caption_map: dict | None,
    raw_temporal: dict | None,
) -> dict:
    """Build condensed evidence from all pipeline outputs."""
    r = recipe.get("video_recipe", recipe)
    
    evidence = {
        "meta": r.get("meta"),
        "structure": r.get("structure"),
        "visual_style": r.get("visual_style"),
        "audio": r.get("audio"),
        "appeal_points": (r.get("persuasion_analysis") or {}).get("appeal_points", []),
        "narration_type": (stt_data or {}).get("narration_type"),
        "stt_transcript": (stt_data or {}).get("full_transcript", "")[:800],
        "style_format_ko": (style_data or {}).get("primary_format_ko"),
        "style_intent_ko": (style_data or {}).get("primary_intent_ko"),
        "dimensions": diagnosis.get("dimensions", []),
        "scene_analyses": diagnosis.get("scene_analyses", []),
        "strengths": diagnosis.get("strengths", []),
        "weaknesses": diagnosis.get("weaknesses", []),
        "engagement_score": diagnosis.get("engagement_score", 0),
        "caption_events": [
            {"time": round(e["start"], 1), "text": e["text"], "role": e["narrative_role"]}
            for e in (caption_map or {}).get("events", [])[:25]
        ],
        "cut_rhythm": (raw_temporal or {}).get("cut_rhythm", {}),
    }
    return evidence


def _build_frame_timeline(frame_quals: list[dict], interval: float = 2.0) -> list[dict]:
    """Condense frame_qual data to key frames at specified interval."""
    timeline = []
    last_added = -interval
    for f in frame_quals:
        ts = f.get("timestamp", 0)
        if ts - last_added < interval and ts > 0:
            continue
        last_added = ts
        
        entry = {
            "time": ts,
            "shot": f.get("shot_type"),
            "subject": f.get("subject_type"),
            "text": (f.get("text_overlay") or {}).get("content", "")[:80],
            "text_purpose": (f.get("text_overlay") or {}).get("purpose"),
            "product_visibility": (f.get("product_presentation") or {}).get("visibility"),
            "human": (f.get("human_element") or {}).get("role"),
            "attention": (f.get("attention_element") or "")[:120],
            "color_mood": f.get("color_mood"),
        }
        timeline.append(entry)
    return timeline


def _build_prompt(
    evidence: dict,
    frame_timeline: list[dict],
    product_name: str,
    product_category: str,
    product_key_factors: str,
    intent: str,
    fmt: str,
) -> str:
    """Build the marketer judge prompt."""
    
    return f"""# Role (역할)
너는 월 10억 원 이상의 광고비를 집행하며 수백 개의 숏폼 소재의 성과(ROAS, CTR)를 최적화해 온 '탑티어 퍼포먼스 마케터이자 크리에이티브 디렉터'야.
너의 목표는 영상을 예술적으로 평가하는 것이 아니라, 오직 "이 영상이 타겟 고객의 지갑을 열 수 있는가?"를 냉정하게 판단하는 거야.

# Input Data (입력 데이터)

## 1. 분석 엔진 증거 데이터
```json
{json.dumps(evidence, ensure_ascii=False, indent=2)}
```

## 2. 프레임별 시각 분석 (2초 간격 스냅샷)
아래는 영상을 초당 2장씩 캡처하여 AI가 분석한 각 프레임의 시각 정보야.
이 데이터로 "몇 초에 화면에 정확히 뭐가 보이는지"를 알 수 있어.

```json
{json.dumps(frame_timeline, ensure_ascii=False, indent=2)}
```

## 3. 영상 기본 정보
* 영상의 목적(Intent): {intent}
* 영상의 형식(Format): {fmt}
* 팔고자 하는 제품/핵심 가치(What): {product_name}
* 제품 카테고리: {product_category}
* 이 카테고리에서 구매 결정에 가장 중요한 요소: {product_key_factors}

# Task (수행 과제)
프레임별 시각 데이터와 증거 데이터를 결합하여, 마케터가 가장 궁금해하는 **3가지 핵심 질문**에 직관적이고 단호하게 대답해.
애매한 표현("~할 수도 있습니다", "나쁘지 않습니다")은 절대 쓰지 마.

* 모든 주장에 반드시 [타임스탬프]와 [그 시점에 실제로 보이는 화면 내용]을 근거로 달아. 근거 없는 주장은 쓰지 마.

## 판결 기준
- 집행 권장: 핵심 소구가 적시에 전달되고, 제품-형식 적합성이 높음
- 조건부 집행: 구조는 좋으나 특정 구간 수정 시 성과 개선 가능
- 집행 불가: 제품의 핵심 가치가 전달되지 않거나, 형식 자체가 부적합

## 출력 형식 (Markdown)

### 1. 🛑 최종 판결: 이 영상으로 {product_name}이(가) 팔리겠는가?
* [집행 권장 / 조건부 집행 / 집행 불가] 중 하나를 선택.
* 이유를 1~2줄의 강력한 마케팅 언어로 요약.

### 2. 🔍 판단의 근거: 왜 팔리는가? (혹은 왜 안 팔리는가?)
* 프레임 데이터에서 실제 보이는 화면을 인용하며 논리적으로 설명.
* 데이터(수치, 타임스탬프, 소구점)와 마케팅 심리(인지적 부하, 설득 밀도 등)를 연결해야 해.

### 3. 🛠️ 액션 플랜: 어떻게 하면 더 팔리겠는가?
* 즉시 실행 가능한 To-Do 3가지.
* 반드시 [타임스탬프]와 [해당 프레임에서 보이는 것]을 참조하여 구체적 행동 지시.
"""


def _parse_verdict(markdown: str) -> tuple[str, str, str, str]:
    """Parse the 3-section markdown into verdict, evidence, action_plan."""
    verdict = ""
    verdict_summary = ""
    evidence = ""
    action_plan = ""
    
    sections = markdown.split("### ")
    for section in sections:
        if "최종 판결" in section or "The Verdict" in section:
            lines = section.strip().split("\n", 1)
            body = lines[1].strip() if len(lines) > 1 else ""
            # Extract verdict type
            for v in ["집행 권장", "조건부 집행", "집행 불가"]:
                if v in body:
                    verdict = v
                    break
            verdict_summary = body
        elif "판단의 근거" in section:
            lines = section.strip().split("\n", 1)
            evidence = lines[1].strip() if len(lines) > 1 else ""
        elif "액션 플랜" in section:
            lines = section.strip().split("\n", 1)
            action_plan = lines[1].strip() if len(lines) > 1 else ""
    
    return verdict, verdict_summary, evidence, action_plan


def run_marketer_judge(
    recipe: dict,
    diagnosis: dict,
    frame_quals: list[dict] | None = None,
    stt_data: dict | None = None,
    style_data: dict | None = None,
    caption_map: dict | None = None,
    raw_temporal: dict | None = None,
    product_name: str = "",
    product_category: str = "",
    product_key_factors: str = "",
    intent: str | None = None,
    fmt: str | None = None,
) -> MarketingVerdict:
    """Run the Gemini-powered marketer judge.
    
    Args:
        recipe: Video recipe from Phase 6
        diagnosis: Diagnosis from integrated_analyzer
        frame_quals: Frame quality data from Phase 2 (optional but recommended)
        stt_data: STT data from Phase 0
        style_data: Style classification from Phase 0.1
        caption_map: Caption map from Phase 7 (C-8)
        raw_temporal: Raw temporal data from Phase 2.5
        product_name: What is being sold
        product_category: Product category
        product_key_factors: Key purchase decision factors for this category
        intent: Override intent (default: from style_data)
        fmt: Override format (default: from style_data)
    
    Returns:
        MarketingVerdict with parsed results
    """
    api_key = os.getenv("GEMINI_API_KEY_PRO") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[Marketer Judge] ⚠️ GEMINI_API_KEY_PRO not set, skipping")
        return MarketingVerdict(
            verdict="N/A",
            verdict_summary="API 키 없음",
            evidence="",
            action_plan="",
            full_markdown="",
            product_name=product_name,
            product_category=product_category,
        )
    
    client = genai.Client(api_key=api_key)
    
    # Build evidence
    evidence_data = _build_evidence_summary(
        recipe, diagnosis, stt_data, style_data, caption_map, raw_temporal,
    )
    
    # Build frame timeline
    frame_timeline = []
    if frame_quals:
        frame_timeline = _build_frame_timeline(frame_quals, interval=2.0)
    
    # Resolve intent/format
    if not intent:
        intent = (style_data or {}).get("primary_intent_ko", "커머스/세일즈")
    if not fmt:
        fmt = (style_data or {}).get("primary_format_ko", "캡션/텍스트형")
    
    # Auto-detect product from recipe if not provided
    if not product_name:
        meta = recipe.get("video_recipe", recipe).get("meta", {})
        product_name = meta.get("sub_category") or meta.get("category") or "제품"
    if not product_category:
        meta = recipe.get("video_recipe", recipe).get("meta", {})
        product_category = meta.get("category") or "일반"
    if not product_key_factors:
        product_key_factors = "제품의 핵심 가치와 차별점"
    
    prompt = _build_prompt(
        evidence_data, frame_timeline,
        product_name, product_category, product_key_factors,
        intent, fmt,
    )
    
    print(f"[Marketer Judge] Calling Gemini 2.5 Flash...")
    print(f"  Product: {product_name} ({product_category})")
    print(f"  Evidence: {len(json.dumps(evidence_data))} chars")
    print(f"  Frames: {len(frame_timeline)} snapshots")
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        markdown = response.text or ""
    except Exception as e:
        print(f"[Marketer Judge] ⚠️ Gemini call failed: {e}")
        return MarketingVerdict(
            verdict="ERROR",
            verdict_summary=str(e)[:200],
            evidence="",
            action_plan="",
            full_markdown="",
            product_name=product_name,
            product_category=product_category,
        )
    
    # Parse result
    verdict, verdict_summary, evidence_text, action_plan = _parse_verdict(markdown)
    
    result = MarketingVerdict(
        verdict=verdict or "조건부 집행",
        verdict_summary=verdict_summary,
        evidence=evidence_text,
        action_plan=action_plan,
        full_markdown=markdown,
        product_name=product_name,
        product_category=product_category,
    )
    
    print(f"[Marketer Judge] ✅ Verdict: {result.verdict}")
    return result
