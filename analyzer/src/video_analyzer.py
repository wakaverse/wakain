"""Phase 4: Full video analysis via Gemini API.

Uploads the full video file to Gemini, analyses audio (music/voice/SFX),
audio_visual_sync, overall structure, product_strategy, and effectiveness.
Uses the File API for large uploads.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time as time_mod
from pathlib import Path

from google import genai
from google.genai import types

from .schemas import (
    Audio,
    EffectivenessAssessment,
    Meta,
    ProductStrategy,
    Structure,
)

MODEL = "gemini-2.5-flash"
MAX_UPLOAD_SIZE_MB = 20

SYSTEM_INSTRUCTION = """\
You are a shortform marketing video analyst specialising in Korean commerce ads.
Analyse the uploaded video holistically — audio, structure, product strategy, and
effectiveness. Respond with valid JSON matching the requested schema exactly.

For audio analysis:
- Listen carefully to music, voice, and sound effects
- Identify music genre, energy, BPM range, beat synchronisation with cuts
- Do NOT produce a transcript (transcript is provided separately via STT).
- Summarise the voice script in Korean
- Note any sound effects used

For structure:
- Identify the overall narrative structure type
- Note scene sequence with roles and durations
- Pinpoint hook timing, product first appearance, CTA start

For product_strategy:
- How/when is the product revealed
- What benefits are highlighted
- Pricing, offers, social proof elements

For effectiveness_assessment:
- Rate and explain hook, flow, message clarity, CTA, replay factor
- List standout elements and weak points

For text_effects:
- Identify ALL text overlays that appear on screen with their timing
- For each text: when it appears (time), the content, entrance animation, exit animation,
  any emphasis effect, and what it syncs with (voice, beat, cut, or independent)

For scene_roles:
- Identify each scene's narrative role with start/end times
- Roles: hook, problem, solution, demo, proof, brand_intro, transition, cta, recap
- Include a concise description (1-2 sentences, in Korean) of what happens visually and narratively in each scene

For art_direction (아트 디렉션 — visual identity):
- tone_and_manner: Overall visual tone in Korean (e.g. '깔끔하고 신뢰감 있는 정보형', '트렌디하고 젊은 감성')
- Typography system: heading font family, body font family, font colors (hex), how keywords are highlighted
- Color system: brand/theme colors (hex), background style (solid/gradient/image/video/transparent/mixed), color temperature (warm/neutral/cool)
- Graphic identity: overall graphic style (clean_minimal/bold_graphic/playful_sticker/premium_elegant/retro_vintage/info_graphic/hand_drawn/photo_real), recurring visual elements (Korean)
- Layout system: where text typically appears, frame composition rule (Korean)
- Visual consistency assessment (high/medium/low)
- Style reference: what this style resembles (Korean, e.g. '쿠팡 라이브 스타일', '인스타 감성')

For persuasion_analysis (소구 분석 — CRITICAL):
- **presenter**: Who presents the video? (founder/reviewer/narrator/customer/expert/character/none)
  - Is their face shown? What gives them credibility?
- **video_style**: Overall style (pitch/demo/mukbang/comparison/vlog/review/info/story/challenge)
- **appeal_points**: List EVERY persuasion/appeal point in order of appearance.
  ⚠️ IMPORTANT: Extract AT LEAST one appeal per scene/segment. A 30-second video should have 10-20+ appeals.
  Include appeals from ALL sources:
    - Visual appeals (product shots, demos, before/after, etc.)
    - Script/narration appeals (spoken claims, benefits mentioned verbally)
    - Text overlay appeals (on-screen text making claims)
  Do NOT skip scenes — every scene communicates something. If a scene shows a product feature, that's feature_demo. If narration mentions a benefit, that's an appeal even without visual proof.
  - Types (rational) — 각 정의를 정확히 따를 것:
    - myth_bust (오해반박): 흔한 오해나 편견을 깨는 소구
    - ingredient (원재료): 원재료/성분의 품질·희귀성 강조
    - manufacturing (제조공정): 제품이 만들어지는 과정·공정·기술. ⚠️ 제품 사용 시연은 feature_demo
    - track_record (실적): 수상, 판매량, 인증 등 객관적 실적
    - price (가격): 가격, 할인, 무료 증정, 가성비
    - comparison (비교): 경쟁 제품·기존 방식과의 비교
    - guarantee (보장): 환불, 보증, 무료체험 등 리스크 제거
    - origin (원산지): 산지, 생산지, 브랜드 역사
    - feature_demo (기능시연): 제품 기능을 직접 시연하며 보여줌 (터치, 동작, 사용법 등)
    - spec_data (스펙수치): 수치·규격·용량 등 객관적 스펙 데이터
  - Types (emotional) — 각 정의를 정확히 따를 것:
    - design_aesthetic (디자인감성): 색감, 질감, 디자인의 시각적 매력, 인테리어 매칭
    - authenticity (진정성): 리얼후기, 솔직함, 날것의 매력
    - social_proof (사회적증거): 인기, 트렌드, 많은 사람이 쓴다는 증거
    - urgency (긴급성): 한정수량, 기간한정
    - lifestyle (라이프스타일): 이 제품이 있는 삶의 모습, 동경
    - nostalgia (향수): 추억, 옛날 감성, 레트로
    - authority (권위): 전문가, 셀럽, 인플루언서 추천
    - emotional (감정): 감동, 유머, 공감 등 감정 자극
  - For each: what specific claim is made? How is it VISUALLY proven? (closeup/slow_motion/process_shot/graph_number/etc.)
  - Rate each appeal's strength (strong/moderate/weak) based on how convincingly it's delivered
  - **source** (CRITICAL — 소구 분리 규칙):
    ⚠️ "both"를 사용하지 마세요! 대신 같은 시점이라도 대본 소구와 비주얼 소구를 **별도 항목으로 분리**하세요.
    - "script" — 음성 대본/나레이션으로 전달되는 설득 포인트
      - claim에는 실제 말한 내용 기반으로 작성
      - 예: "300만원 날릴 뻔했어요" → source=script, type=price
    - "visual" — 화면 구성/장면/텍스트 오버레이로 전달되는 설득 포인트  
      - claim에는 화면에서 보이는 것 기반으로 작성
      - 예: 깨진 타일 클로즈업 → source=visual, type=emotional, claim="깨진 타일 클로즈업으로 문제 심각성 시각화"
      - 예: 제품 사용 장면 → source=visual, type=feature_demo, claim="주사기형 도포 장면으로 사용 편의성 시각화"
    - 같은 컷에서 나레이션이 "이 제품 좋아요"라고 말하면서 화면에 제품 클로즈업이 보이면:
      → {source: "script", type: "...", claim: "나레이션 내용 기반"}
      → {source: "visual", type: "...", claim: "화면 장면 기반"}
      두 개 별도 항목으로!
    - 모든 컷에 최소 1개의 visual 소구가 있어야 합니다 (화면에 아무것도 안 보이는 컷은 없으니까)
- **product_emphasis**: How is the product visually highlighted?
  - When does it first appear? How much screen time? How many hero/close-up shots?
  - What visual techniques are used? (closeup/zoom_in/texture_detail/steam_sizzle/before_after/etc.)
  - What is the single most impactful product visual moment?
- **primary_appeal**: Which single appeal type is the strongest?
- **appeal_layering**: How do appeals build on each other? Describe the sequence in Korean.
- **persuasion_summary**: 1-2 sentence summary of the overall persuasion strategy in Korean.

For empathy_triggers (within persuasion_analysis):
- Identify ALL emotional/empathy triggers used in the video
- Types: pain_empathy (고통공감 "이거 겪어봤죠?"), desire (욕망자극 "이렇게 될 수 있다"), belonging (소속감 "다들 이거 써"), fomo (놓치면 손해), curiosity (호기심 "이게 된다고?"), humor (유머), nostalgia (향수), fear (공포/불안), pride (자부심), relief (안도)
- Note timestamp, description, and intensity for each

For narrative_analysis:
- Identify the narrative pattern (problem_solution/reversal/comparison/listicle/storytelling/direct_pitch/challenge/tutorial)
- Assess tension arc: does the video build tension? (rising/flat/peak_valley/steady_build/frontloaded)
- Resolution satisfaction: how satisfying is the conclusion?
- Curiosity gap: does it create "I need to know" feeling?
- Loop structure: does it encourage rewatching?

For retention_analysis:
- Hook strength: how irresistible is the first 1-3 seconds?
- Drop-off risks: identify moments where viewers might leave (timestamp + reason)
- Rewatch triggers: what makes viewers want to watch again?
- Share triggers: what makes viewers want to share?
- Comment triggers: what provokes comments?
- Completion likelihood: will viewers watch to the end?

## 텍스트 오버레이 영상 대응 (나레이션 없는 영상)
만약 영상에 나레이션/음성이 없거나 극히 적고, 텍스트 오버레이가 주요 정보 전달 수단인 경우:
- voice.type은 "none"으로, voice.script_summary에는 "텍스트 오버레이 기반 영상"으로 기재
- text_effects 섹션에 화면에 나타나는 모든 텍스트를 시간순으로 빠짐없이 기록
- 텍스트 오버레이의 내용 변화를 소구 전환점으로 판단
- 텍스트의 크기·색상·강조 방식(볼드, 색상변경, 크기확대)이 메시지 강도를 나타냄
- appeal_points의 claim은 실제 화면에 나타나는 텍스트 내용 기반으로 작성

## Script Analysis (대본 분석)

최상위 script_analysis 필드에 쇼핑 숏폼 7요소 프레임워크로 대본을 분석하라. (persuasion_analysis와 별개 필드)

Elements to detect (check which are present):
1. authority (권위 부여): Who speaks and what credibility device?
   - Subtypes: professional_job, career_years, picky_taste, celebrity_ref, backstory, life_veteran
2. hook (감탄 훅): First 3 seconds — direct experience emotion/action?
   - Must be first-person experience, NOT indirect ("해외에서 난리" = bad hook)
   - Patterns: 직접경험감탄, 행동변화형, 극적반응형, 사람반응형
3. sensory_description (상황 묘사): Which senses? Onomatopoeia? Contrast structure?
   - Senses: visual, tactile, taste, smell, auditory
4. simplicity (간편함 어필): How is the barrier lowered?
   - Patterns: number_limit ("3가지만"), one_step, time_limit, empathy
5. process (과정 묘사): Showing the making/using? (optional, skip if overlaps with sensory_description)
6. social_proof (사회적 증거): Others' reactions or personal change?
   - Extreme premise ("안 먹던", "안 쓰던")? Voluntary action?
   - WARNING: Direct health/weight claims = false advertising risk
7. cta (행동 유도): Comment-inducing? Link? Purchase?
   - Patterns: 댓글유도, 공감참여, 보증형, 링크형

Also detect advanced techniques:
- reversal_structure (반전 구조): 걱정→해소 pattern
- connecting_endings (연결어미): ~는데, ~해서 flow without sentence breaks
- info_overload (정보 과밀): 3+ functional specs in quick succession
- target_consistency (타깃 일관성): single target maintained throughout

Output flow_order as the actual sequence of 7-elements found in the video (e.g. ["authority","hook","sensory_description","simplicity","social_proof","cta"]).
Output video_style from: talking_head_commerce, brand_ad, product_demo, caption_text, asmr, comparison, other

For the hook field: extract the actual first-3-second sentence from STT and classify its pattern.
For each appeal in appeals array: set used=true only if the element is clearly present.
"""

# ── Track-specific prompt supplements (B-4) ──────────────────────────────────

VOICE_TRACK_SUPPLEMENT = """
## 분석 트랙: VOICE (내레이션 기반)
이 영상에는 음성 내레이션이 있습니다. 아래 STT 결과를 참고하여 분석하세요.

**핵심 분석 축:**
- 내레이션 텍스트를 기반으로 설득 구조를 분석하세요
- 음성 흐름(어조, 속도, 강조)이 소구 전달에 미치는 영향을 평가하세요
- 텍스트 오버레이는 보조 역할로 평가하세요
- 내레이션과 시각 요소의 싱크를 중점 분석하세요
- ⚠️ 나레이션에서 언급하는 모든 설득 포인트를 appeal_points에 포함하세요 (source="script"), 화면 소구는 별도로 source="visual"
  - 예: "3년 연속 1위" → track_record (source=script)
  - 예: "지금 할인 중" → price (source=script)
  - 화면에 증거가 없어도 나레이션 소구는 반드시 포함!

[STT 전문]
{stt_transcript}
"""

CAPTION_TRACK_SUPPLEMENT = """
## 분석 트랙: CAPTION (텍스트 오버레이 기반)
이 영상에는 의미 있는 음성 내레이션이 없습니다. 텍스트 오버레이가 주요 정보 전달 수단입니다.

**핵심 분석 축:**
- 화면에 나타나는 텍스트 오버레이를 시간순으로 정밀 분석하세요
- 텍스트 내용의 변화를 소구 전환점으로 판단하세요
- 타이포그래피 분석 강화: 크기, 색상, 강조 방식이 메시지 강도를 나타냄
- BGM/효과음의 역할을 더 비중 있게 평가하세요
- appeal_points의 claim은 실제 화면 텍스트 내용 기반으로 작성하세요
- ⚠️ 화면에 나타나는 모든 텍스트 메시지를 소구로 분석하세요. 텍스트 하나하나가 소구입니다!
"""

CATEGORY_CONTEXT_TEMPLATE = """
## 제품 카테고리 컨텍스트
- 카테고리: {category_ko} ({category_key})
- 제품: {product_name}
{category_hint}
"""


def _build_track_supplement(
    narration_type: str | None = None,
    stt_transcript: str | None = None,
    product_scan: dict | None = None,
) -> str:
    """Build additional prompt context based on narration type and product scan."""
    parts = []

    # Track supplement
    if narration_type == "voice" and stt_transcript:
        parts.append(VOICE_TRACK_SUPPLEMENT.format(stt_transcript=stt_transcript))
    elif narration_type in ("caption", "silent"):
        parts.append(CAPTION_TRACK_SUPPLEMENT)

    # Category context from product scan
    if product_scan:
        from .product_scanner import CATEGORY_LABELS_KO
        from .style_profiles import get_category_profile

        category_key = product_scan.get("category", "general")
        category_ko = CATEGORY_LABELS_KO.get(category_key, category_key)
        product_name = product_scan.get("product_name") or "미확인"

        profile = get_category_profile(category_key)
        category_hint = profile.get("phase4a_hint", "")

        parts.append(CATEGORY_CONTEXT_TEMPLATE.format(
            category_ko=category_ko,
            category_key=category_key,
            product_name=product_name,
            category_hint=category_hint,
        ))

    return "\n".join(parts)



class _VideoAnalysisResponse(Audio):
    """Full response schema for video analysis."""
    pass


# We need a flat response schema for Gemini, so define it inline
_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "meta": {
            "type": "OBJECT",
            "properties": {
                "platform": {"type": "STRING", "enum": ["tiktok", "reels", "shorts", "ad"]},
                "duration": {"type": "NUMBER"},
                "aspect_ratio": {"type": "STRING", "enum": ["9:16", "1:1", "16:9"]},
                "category": {"type": "STRING", "enum": ["beauty", "food", "tech", "fashion", "health", "home", "finance", "education"]},
                "sub_category": {"type": "STRING"},
                "target_audience": {"type": "STRING"},
            },
            "required": ["platform", "duration", "aspect_ratio", "category", "sub_category", "target_audience"],
        },
        "structure": {
            "type": "OBJECT",
            "properties": {
                "type": {"type": "STRING", "enum": ["problem_solution", "before_after", "demo", "review", "listicle", "story", "trend_ride"]},
                "scene_sequence": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "role": {"type": "STRING"},
                            "duration": {"type": "NUMBER"},
                            "technique": {"type": "STRING"},
                        },
                        "required": ["role", "duration", "technique"],
                    },
                },
                "hook_time": {"type": "NUMBER"},
                "product_first_appear": {"type": "NUMBER"},
                "cta_start": {"type": "NUMBER"},
            },
            "required": ["type", "scene_sequence", "hook_time", "product_first_appear", "cta_start"],
        },
        "audio": {
            "type": "OBJECT",
            "properties": {
                "music": {
                    "type": "OBJECT",
                    "properties": {
                        "present": {"type": "BOOLEAN"},
                        "genre": {"type": "STRING", "enum": ["upbeat_pop", "lo_fi", "dramatic", "trending_sound", "acoustic", "edm", "none"]},
                        "energy_profile": {"type": "STRING", "enum": ["steady", "building", "drop", "calm_to_hype"]},
                        "bpm_range": {"type": "STRING"},
                        "mood_match": {"type": "STRING"},
                        "beat_sync": {"type": "STRING"},
                    },
                    "required": ["present", "genre", "energy_profile", "bpm_range", "mood_match", "beat_sync"],
                },
                "voice": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["narration", "dialogue", "voiceover", "tts", "none"]},
                        "tone": {"type": "STRING", "enum": ["conversational", "professional", "excited", "asmr", "storytelling"]},
                        "language": {"type": "STRING"},
                        "script_summary": {"type": "STRING"},
                        "hook_line": {"type": "STRING"},
                        "cta_line": {"type": "STRING"},
                    },
                    "required": ["type", "tone", "language", "script_summary", "hook_line", "cta_line"],
                },
                "sfx": {
                    "type": "OBJECT",
                    "properties": {
                        "used": {"type": "BOOLEAN"},
                        "types": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "frequency": {"type": "STRING", "enum": ["heavy", "moderate", "minimal", "none"]},
                    },
                    "required": ["used", "types", "frequency"],
                },
                "audio_visual_sync": {"type": "STRING"},
            },
            "required": ["music", "voice", "sfx", "audio_visual_sync"],
        },
        "product_strategy": {
            "type": "OBJECT",
            "properties": {
                "reveal_timing": {"type": "STRING", "enum": ["immediate", "gradual", "delayed_reveal", "teaser"]},
                "demonstration_method": {"type": "STRING", "enum": ["in_use", "comparison", "transformation", "testimonial", "spec_highlight", "unboxing"]},
                "key_benefit_shown": {"type": "STRING"},
                "price_shown": {"type": "BOOLEAN"},
                "price_framing": {"type": "STRING", "enum": ["discount", "per_day", "vs_competitor", "bundle", "none"]},
                "offer_type": {"type": "STRING"},
                "social_proof": {"type": "STRING", "enum": ["reviews", "ugc", "numbers", "celebrity", "expert", "none"]},
                "urgency_trigger": {"type": "STRING", "enum": ["time_limit", "stock_limit", "trend", "none"]},
                "brand_visibility": {
                    "type": "OBJECT",
                    "properties": {
                        "logo_shown": {"type": "BOOLEAN"},
                        "brand_color_used": {"type": "BOOLEAN"},
                        "brand_mention_count": {"type": "INTEGER"},
                    },
                    "required": ["logo_shown", "brand_color_used", "brand_mention_count"],
                },
            },
            "required": [
                "reveal_timing", "demonstration_method", "key_benefit_shown",
                "price_shown", "price_framing", "offer_type", "social_proof",
                "urgency_trigger", "brand_visibility",
            ],
        },
        "effectiveness_assessment": {
            "type": "OBJECT",
            "properties": {
                "hook_rating": {"type": "STRING"},
                "flow_rating": {"type": "STRING"},
                "message_clarity": {"type": "STRING"},
                "cta_strength": {"type": "STRING"},
                "replay_factor": {"type": "STRING"},
                "standout_elements": {"type": "ARRAY", "items": {"type": "STRING"}},
                "weak_points": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
            "required": [
                "hook_rating", "flow_rating", "message_clarity",
                "cta_strength", "replay_factor", "standout_elements", "weak_points",
            ],
        },
        "text_effects": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "time": {"type": "NUMBER"},
                    "content": {"type": "STRING"},
                    "entrance": {"type": "STRING", "enum": ["fade_in", "slide_up", "slide_left", "pop", "typewriter", "cut", "none"]},
                    "exit": {"type": "STRING", "enum": ["fade_out", "slide_down", "cut", "none"]},
                    "emphasis": {"type": "STRING", "enum": ["color_highlight", "size_pulse", "shake", "glow", "underline", "none"]},
                    "sync_with": {"type": "STRING", "enum": ["voice", "beat", "cut", "independent"]},
                },
                "required": ["time", "content", "entrance", "exit", "sync_with"],
            },
        },
        "scene_roles": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "role": {"type": "STRING", "enum": ["hook", "problem", "solution", "demo", "proof", "brand_intro", "transition", "cta", "recap"]},
                    "description": {"type": "STRING"},
                },
                "required": ["start", "end", "role", "description"],
            },
        },
        "persuasion_analysis": {
            "type": "OBJECT",
            "properties": {
                "presenter": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["founder", "reviewer", "narrator", "customer", "expert", "character", "none"]},
                        "face_shown": {"type": "BOOLEAN"},
                        "credibility_factor": {"type": "STRING"},
                    },
                    "required": ["type", "face_shown", "credibility_factor"],
                },
                "video_style": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["pitch", "demo", "mukbang", "comparison", "vlog", "review", "info", "story", "challenge"]},
                        "sub_style": {"type": "STRING"},
                    },
                    "required": ["type", "sub_style"],
                },
                "appeal_points": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "type": {"type": "STRING", "enum": [
                                "myth_bust", "ingredient", "manufacturing", "track_record", "price",
                                "comparison", "guarantee", "origin", "feature_demo", "spec_data",
                                "design_aesthetic", "authenticity", "social_proof", "urgency",
                                "lifestyle", "nostalgia", "authority", "emotional",
                            ]},
                            "claim": {"type": "STRING"},
                            "visual_proof": {
                                "type": "OBJECT",
                                "properties": {
                                    "technique": {"type": "STRING", "enum": [
                                        "closeup", "slow_motion", "split_screen", "before_after",
                                        "text_overlay", "reaction_shot", "process_shot", "package_shot",
                                        "ingredient_shot", "location_shot", "graph_number", "none",
                                    ]},
                                    "description": {"type": "STRING"},
                                    "timestamp": {"type": "NUMBER"},
                                },
                                "required": ["technique", "description", "timestamp"],
                            },
                            "audio_sync": {"type": "STRING", "enum": [
                                "narration_sync", "text_only", "sfx_emphasis", "music_beat", "silent", "independent",
                            ]},
                            "strength": {"type": "STRING", "enum": ["strong", "moderate", "weak"]},
                            "source": {"type": "STRING", "enum": ["visual", "script"]},
                        },
                        "required": ["type", "claim", "visual_proof", "audio_sync", "strength", "source"],
                    },
                },
                "product_emphasis": {
                    "type": "OBJECT",
                    "properties": {
                        "first_appear": {"type": "NUMBER"},
                        "screen_time_ratio": {"type": "NUMBER"},
                        "hero_shots": {"type": "INTEGER"},
                        "emphasis_techniques": {
                            "type": "ARRAY",
                            "items": {"type": "STRING", "enum": [
                                "closeup", "slow_motion", "zoom_in", "spotlight",
                                "rotation", "unboxing", "size_comparison",
                                "texture_detail", "steam_sizzle", "pour_drip",
                                "before_after", "multi_angle", "ingredient_breakdown",
                                "in_use_demo", "package_focus",
                            ]},
                        },
                        "key_visual_moment": {"type": "STRING"},
                        "key_visual_timestamp": {"type": "NUMBER"},
                    },
                    "required": ["first_appear", "screen_time_ratio", "hero_shots", "emphasis_techniques", "key_visual_moment", "key_visual_timestamp"],
                },
                "primary_appeal": {"type": "STRING", "enum": [
                    "myth_bust", "ingredient", "manufacturing", "track_record", "price",
                    "comparison", "guarantee", "origin", "feature_demo", "spec_data",
                    "design_aesthetic", "authenticity", "social_proof", "urgency",
                    "lifestyle", "nostalgia", "authority", "emotional",
                ]},
                "appeal_layering": {"type": "STRING"},
                "persuasion_summary": {"type": "STRING"},
            },
            "required": ["presenter", "video_style", "appeal_points", "product_emphasis", "primary_appeal", "appeal_layering", "persuasion_summary"],
        },
        "script_analysis": {
            "type": "OBJECT",
            "properties": {
                "hook": {
                    "type": "OBJECT",
                    "properties": {
                        "text": {"type": "STRING"},
                        "time_range": {"type": "ARRAY", "items": {"type": "NUMBER"}},
                        "pattern": {"type": "STRING"},
                        "direct_experience": {"type": "BOOLEAN"},
                    },
                    "required": ["text", "time_range", "pattern", "direct_experience"],
                },
                "appeals": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "element": {"type": "STRING", "enum": [
                                "authority", "hook", "sensory_description",
                                "simplicity", "process", "social_proof", "cta",
                            ]},
                            "used": {"type": "BOOLEAN"},
                            "subtype": {"type": "STRING"},
                            "text": {"type": "STRING"},
                            "time_range": {"type": "ARRAY", "items": {"type": "NUMBER"}},
                        },
                        "required": ["element", "used", "subtype", "text", "time_range"],
                    },
                },
                "cta": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING"},
                        "text": {"type": "STRING"},
                        "keyword": {"type": "STRING"},
                        "time_range": {"type": "ARRAY", "items": {"type": "NUMBER"}},
                    },
                    "required": ["type", "text", "time_range"],
                },
                "flow_order": {"type": "ARRAY", "items": {"type": "STRING"}},
                "elements_used": {"type": "INTEGER"},
                "elements_total": {"type": "INTEGER"},
                "advanced_techniques": {
                    "type": "OBJECT",
                    "properties": {
                        "reversal_structure": {"type": "BOOLEAN"},
                        "connecting_endings": {"type": "BOOLEAN"},
                        "info_overload": {"type": "BOOLEAN"},
                        "target_consistency": {"type": "BOOLEAN"},
                    },
                    "required": ["reversal_structure", "connecting_endings", "info_overload", "target_consistency"],
                },
                "video_style": {"type": "STRING"},
            },
            "required": ["hook", "appeals", "cta", "flow_order", "elements_used", "elements_total", "advanced_techniques", "video_style"],
        },
    },
    "required": ["meta", "structure", "audio", "product_strategy", "effectiveness_assessment", "text_effects", "scene_roles", "persuasion_analysis"],
}

# Separate schema for art_direction (to stay under Gemini schema complexity limit)
_ART_DIRECTION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "art_direction": {
            "type": "OBJECT",
            "properties": {
                "tone_and_manner": {"type": "STRING"},
                "heading_font": {"type": "STRING"},
                "body_font": {"type": "STRING"},
                "font_color_system": {"type": "ARRAY", "items": {"type": "STRING"}},
                "highlight_method": {"type": "STRING"},
                "brand_colors": {"type": "ARRAY", "items": {"type": "STRING"}},
                "background_style": {"type": "STRING", "enum": [
                    "solid_color", "gradient", "image_bg", "video_bg", "transparent", "mixed",
                ]},
                "color_temperature": {"type": "STRING", "enum": ["warm", "neutral", "cool"]},
                "graphic_style": {"type": "STRING", "enum": [
                    "clean_minimal", "bold_graphic", "playful_sticker", "premium_elegant",
                    "retro_vintage", "info_graphic", "hand_drawn", "photo_real",
                ]},
                "recurring_elements": {"type": "ARRAY", "items": {"type": "STRING"}},
                "text_position_pattern": {"type": "STRING"},
                "frame_composition_rule": {"type": "STRING"},
                "visual_consistency": {"type": "STRING", "enum": ["high", "medium", "low"]},
                "style_reference": {"type": "STRING"},
            },
            "required": [
                "tone_and_manner", "heading_font", "body_font", "font_color_system",
                "highlight_method", "brand_colors", "background_style", "color_temperature",
                "graphic_style", "recurring_elements", "text_position_pattern",
                "frame_composition_rule", "visual_consistency", "style_reference",
            ],
        },
    },
    "required": ["art_direction"],
}

# Separate schema for engagement analysis (empathy, narrative, retention)
_ENGAGEMENT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "empathy_triggers": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "trigger_type": {"type": "STRING", "enum": ["pain_empathy", "desire", "belonging", "fomo", "curiosity", "humor", "nostalgia", "fear", "pride", "relief"]},
                    "timestamp": {"type": "NUMBER"},
                    "description": {"type": "STRING"},
                    "intensity": {"type": "STRING", "enum": ["strong", "moderate", "weak"]},
                },
                "required": ["trigger_type", "timestamp", "description", "intensity"],
            },
        },
        "narrative_analysis": {
            "type": "OBJECT",
            "properties": {
                "pattern": {"type": "STRING", "enum": ["problem_solution", "reversal", "comparison", "listicle", "storytelling", "direct_pitch", "challenge", "tutorial"]},
                "tension_arc": {"type": "STRING", "enum": ["rising", "flat", "peak_valley", "steady_build", "frontloaded"]},
                "resolution_satisfaction": {"type": "STRING", "enum": ["strong", "moderate", "weak", "none"]},
                "curiosity_gap": {"type": "BOOLEAN"},
                "loop_structure": {"type": "BOOLEAN"},
            },
            "required": ["pattern", "tension_arc", "resolution_satisfaction", "curiosity_gap", "loop_structure"],
        },
        "retention_analysis": {
            "type": "OBJECT",
            "properties": {
                "hook_strength": {"type": "STRING", "enum": ["irresistible", "strong", "moderate", "weak"]},
                "drop_off_risks": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "timestamp": {"type": "NUMBER"},
                            "reason": {"type": "STRING"},
                            "severity": {"type": "STRING", "enum": ["high", "medium", "low"]},
                        },
                        "required": ["timestamp", "reason", "severity"],
                    },
                },
                "rewatch_triggers": {"type": "ARRAY", "items": {"type": "STRING"}},
                "share_triggers": {"type": "ARRAY", "items": {"type": "STRING"}},
                "comment_triggers": {"type": "ARRAY", "items": {"type": "STRING"}},
                "completion_likelihood": {"type": "STRING", "enum": ["very_high", "high", "medium", "low"]},
            },
            "required": ["hook_strength", "drop_off_risks", "rewatch_triggers", "share_triggers", "comment_triggers", "completion_likelihood"],
        },
    },
    "required": ["empathy_triggers", "narrative_analysis", "retention_analysis"],
}


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY_PRO") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    key_label = "PRO" if os.environ.get("GEMINI_API_KEY_PRO") else "FREE"
    print(f"  Using Gemini API key: {key_label}")
    return genai.Client(api_key=api_key)


def _resize_video(video_path: str | Path, max_mb: int = MAX_UPLOAD_SIZE_MB, resolution: int = 720) -> Path:
    """Re-encode video to fit under max_mb using ffmpeg if needed."""
    src = Path(video_path)
    size_mb = src.stat().st_size / (1024 * 1024)

    if size_mb <= max_mb:
        return src

    print(f"  Video is {size_mb:.1f}MB (>{max_mb}MB), re-encoding for upload...")

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found. Install ffmpeg to resize large videos.")

    tmp = Path(tempfile.mktemp(suffix=".mp4"))
    # Target bitrate to fit under max_mb
    # Get duration first
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(src)],
        capture_output=True, text=True,
    )
    duration = float(probe.stdout.strip())
    target_bitrate = int((max_mb * 8 * 1024) / duration * 0.9)  # 90% safety margin

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src),
         "-vf", f"scale=-2:{resolution}",
         "-b:v", f"{target_bitrate}k",
         "-c:v", "libx264", "-preset", "fast",
         "-c:a", "aac", "-b:a", "64k",
         "-movflags", "+faststart",
         str(tmp)],
        capture_output=True, check=True,
    )

    new_size = tmp.stat().st_size / (1024 * 1024)
    print(f"  Re-encoded: {new_size:.1f}MB")
    return tmp


def _upload_video(client: genai.Client, video_path: Path) -> types.File:
    """Upload video to Gemini File API with polling for processing."""
    print(f"  Uploading {video_path.name} to Gemini File API...")
    uploaded = client.files.upload(file=video_path)

    # Poll until file is processed
    while uploaded.state.name == "PROCESSING":
        print(f"  Processing... (state={uploaded.state.name})")
        time_mod.sleep(5)
        uploaded = client.files.get(name=uploaded.name)

    if uploaded.state.name == "FAILED":
        raise RuntimeError(f"File upload failed: {uploaded.state}")

    print(f"  Upload complete: {uploaded.name} (state={uploaded.state.name})")
    return uploaded


def _aggregate_artwork_context(frame_quals: list[dict]) -> str:
    """Aggregate Phase 2 artwork data into text context for Phase 4b prompt."""
    if not frame_quals:
        return ""

    from collections import Counter

    total = len(frame_quals)
    artworks = [f.get('artwork') for f in frame_quals if f.get('artwork')]
    if not artworks:
        return ""

    art_count = len(artworks)

    # Typography
    font_families = Counter()
    font_colors = Counter()
    font_weights = Counter()
    font_sizes = Counter()
    outline_count = 0
    shadow_count = 0
    bg_count = 0
    highlight_techniques = Counter()

    for a in artworks:
        typo = a.get('typography')
        if not typo:
            continue
        if typo.get('font_family'): font_families[typo['font_family']] += 1
        if typo.get('font_color'): font_colors[typo['font_color']] += 1
        if typo.get('font_weight'): font_weights[typo['font_weight']] += 1
        if typo.get('font_size_ratio'): font_sizes[typo['font_size_ratio']] += 1
        if typo.get('has_outline'): outline_count += 1
        if typo.get('has_shadow'): shadow_count += 1
        if typo.get('has_background'): bg_count += 1
        ht = typo.get('highlight_technique')
        if ht and ht != 'none': highlight_techniques[ht] += 1

    # Graphic elements
    graphic_counts = Counter()
    for a in artworks:
        for elem in (a.get('graphic_elements') or []):
            if elem != 'none':
                graphic_counts[elem] += 1

    # Layout zones
    zone_counts = {'top': Counter(), 'middle': Counter(), 'bottom': Counter()}
    for a in artworks:
        lz = a.get('layout_zones') or {}
        for zone in ['top', 'middle', 'bottom']:
            if lz.get(zone):
                zone_counts[zone][lz[zone]] += 1

    # Color design
    bg_colors = Counter()
    accent_colors = Counter()
    contrast_levels = Counter()
    for a in artworks:
        cd = a.get('color_design') or {}
        if cd.get('primary_bg_color'): bg_colors[cd['primary_bg_color']] += 1
        if cd.get('accent_color'): accent_colors[cd['accent_color']] += 1
        if cd.get('contrast_level'): contrast_levels[cd['contrast_level']] += 1

    # Build text
    lines = ["## 프레임별 실측 아트워크 데이터 (Phase 2 분석 결과, {}/{} 프레임)".format(art_count, total)]

    lines.append("\n[타이포그래피]")
    if font_families:
        lines.append(f"- 주 폰트: {font_families.most_common(3)}")
    if font_weights:
        lines.append(f"- 굵기: {font_weights.most_common(3)}")
    if font_colors:
        lines.append(f"- 폰트 색상 빈도: {font_colors.most_common(5)}")
    if font_sizes:
        lines.append(f"- 폰트 크기: {font_sizes.most_common(3)}")
    lines.append(f"- 외곽선: {outline_count}/{art_count}프레임, 그림자: {shadow_count}/{art_count}프레임, 배경박스: {bg_count}/{art_count}프레임")
    if highlight_techniques:
        lines.append(f"- 하이라이트 기법: {highlight_techniques.most_common(5)}")

    if graphic_counts:
        lines.append("\n[그래픽 요소]")
        for elem, cnt in graphic_counts.most_common(10):
            lines.append(f"- {elem}: {cnt}회")

    lines.append("\n[레이아웃]")
    for zone in ['top', 'middle', 'bottom']:
        if zone_counts[zone]:
            lines.append(f"- {zone}: {zone_counts[zone].most_common(3)}")

    if bg_colors:
        lines.append("\n[컬러]")
        lines.append(f"- 배경 주색: {bg_colors.most_common(3)}")
        if accent_colors:
            lines.append(f"- 액센트: {accent_colors.most_common(3)}")
        if contrast_levels:
            lines.append(f"- 대비: {contrast_levels.most_common(3)}")

    return "\n".join(lines)


async def analyse_video(
    video_path: str | Path,
    resolution: int = 720,
    frame_quals: list[dict] | None = None,
    narration_type: str | None = None,
    stt_transcript: str | None = None,
    product_scan: dict | None = None,
) -> dict:
    """Upload video to Gemini and get full analysis (audio, structure, product, effectiveness)."""
    client = _make_client()
    video_path = Path(video_path)

    # Resize if too large
    max_mb = 20 if resolution >= 720 else 10
    upload_path = _resize_video(video_path, max_mb=max_mb, resolution=resolution)
    is_temp = upload_path != video_path

    try:
        # Upload via File API
        uploaded_file = _upload_video(client, upload_path)

        prompt = """Analyse this shortform marketing video completely.

Return a JSON object with these sections:
1. meta: platform, duration, aspect_ratio, category, sub_category, target_audience
2. structure: type, scene_sequence (role + duration + technique for each), hook_time, product_first_appear, cta_start
3. audio: music (genre, energy, BPM, beat_sync), voice (type, tone, script_summary, hook_line, cta_line), sfx, audio_visual_sync
4. product_strategy: reveal_timing, demonstration_method, key_benefit, pricing, social_proof, urgency, brand_visibility
5. effectiveness_assessment: ratings for hook, flow, clarity, CTA, replay + standout elements + weak points
6. text_effects: list every on-screen text animation (time, content, entrance, exit, emphasis, sync_with)
7. scene_roles: list each scene's start/end time and narrative role
8. persuasion_analysis: CRITICAL — analyse the video's persuasion strategy:
   - presenter: who speaks/presents (founder/reviewer/narrator/etc.), face shown?, credibility factor
   - video_style: overall style (pitch/demo/mukbang/comparison/review/etc.)
   - appeal_points: list EVERY persuasion point with: type, specific claim, visual_proof (technique + description + timestamp), audio_sync, strength
   - product_emphasis: first_appear time, screen_time_ratio, hero_shots count, emphasis_techniques, key_visual_moment + timestamp
   - primary_appeal: the single strongest appeal type
   - appeal_layering: how appeals build on each other (in Korean)
   - persuasion_summary: 1-2 sentence summary of persuasion strategy (in Korean)

Be specific and detailed. Use Korean for script_summary, hook_line, cta_line, persuasion_summary, appeal claims, and descriptions."""

        # Inject track-specific supplement (B-4: voice/caption + style context)
        track_supplement = _build_track_supplement(
            narration_type=narration_type,
            stt_transcript=stt_transcript,
            product_scan=product_scan,
        )
        if track_supplement:
            prompt += "\n" + track_supplement

        # Inject OCR text timeline from Phase 2 frame_qual results
        if frame_quals:
            text_timeline = []
            for fq in frame_quals:
                ts = fq.get("timestamp", 0)
                texts = fq.get("text_overlay", fq.get("text_overlays", []))
                if texts:
                    items = []
                    for t in texts:
                        if isinstance(t, str):
                            items.append(t)
                        elif isinstance(t, dict):
                            items.append(t.get("content", t.get("text", str(t))))
                    if items:
                        text_timeline.append(f"  {ts:.1f}s: {' | '.join(items)}")
            if text_timeline:
                prompt += (
                    "\n\n[참고: 프레임별 OCR 텍스트 오버레이 감지 결과]\n"
                    + "\n".join(text_timeline[:60])  # limit to 60 entries
                )

        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = await client.aio.models.generate_content(
                    model=MODEL,
                    contents=[
                        types.Part.from_uri(
                            file_uri=uploaded_file.uri,
                            mime_type=uploaded_file.mime_type,
                        ),
                        types.Part.from_text(text=prompt),
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=_RESPONSE_SCHEMA,
                        temperature=0.1,
                    ),
                )
                result = json.loads(response.text)
                break
            except Exception as e:
                wait = 2 ** attempt * 5
                if attempt < max_retries - 1:
                    print(f"  ⚠ Video analysis retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    raise RuntimeError(f"Video analysis failed after {max_retries} retries: {e}") from e

        # Phase 4b + 4c: Art direction & Engagement analysis (parallel)
        artwork_context = _aggregate_artwork_context(frame_quals) if frame_quals else ""
        art_context_block = f"""
{artwork_context}

위 실측 데이터를 근거로 삼고, 영상을 직접 확인하여 아트 디렉션을 분석해주세요.
실측 데이터와 영상이 일치하지 않으면 영상 기준으로 판단하세요.
""" if artwork_context else ""
        art_prompt = f"""Analyse this shortform marketing video's visual identity and art direction.
{art_context_block}
Return a JSON object with art_direction containing:
- tone_and_manner: overall visual tone in Korean (e.g. '깔끔하고 신뢰감 있는 정보형')
- heading_font: primary heading font family (gothic/rounded/serif/handwritten/display)
- body_font: body/subtitle font family
- font_color_system: list of text colors used (hex)
- highlight_method: how key words are emphasized (Korean)
- brand_colors: brand/theme colors (hex list)
- background_style: solid_color/gradient/image_bg/video_bg/transparent/mixed
- color_temperature: warm/neutral/cool
- graphic_style: clean_minimal/bold_graphic/playful_sticker/premium_elegant/retro_vintage/info_graphic/hand_drawn/photo_real
- recurring_elements: repeated visual elements (Korean list)
- text_position_pattern: where text typically appears
- frame_composition_rule: layout rule in Korean
- visual_consistency: high/medium/low
- style_reference: what this style resembles in Korean"""

        engagement_prompt = """Analyse this shortform marketing video's engagement factors.

Return a JSON with:
1. empathy_triggers: emotional triggers used (pain_empathy/desire/belonging/fomo/curiosity/humor/nostalgia/fear/pride/relief) with timestamp, description (Korean), intensity
2. narrative_analysis: narrative pattern, tension arc, resolution satisfaction, curiosity gap, loop structure
3. retention_analysis: hook strength, drop-off risk points, rewatch/share/comment triggers, completion likelihood

Focus on what makes viewers FEEL, STAY, and SHARE."""

        async def _do_4b():
            for attempt in range(max_retries):
                try:
                    art_response = await client.aio.models.generate_content(
                        model=MODEL,
                        contents=[
                            types.Part.from_uri(
                                file_uri=uploaded_file.uri,
                                mime_type=uploaded_file.mime_type,
                            ),
                            types.Part.from_text(text=art_prompt),
                        ],
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            response_mime_type="application/json",
                            response_schema=_ART_DIRECTION_SCHEMA,
                            temperature=0.1,
                        ),
                    )
                    art_data = json.loads(art_response.text)
                    print("  ✓ Art direction complete")
                    return ("art", art_data)
                except Exception as e:
                    wait = 2 ** attempt * 5
                    if attempt < max_retries - 1:
                        print(f"  ⚠ Art direction retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                        await asyncio.sleep(wait)
                    else:
                        print(f"  ⚠ Art direction failed after {max_retries} retries, skipping: {e}")
                        return ("art", None)

        async def _do_4c():
            for attempt in range(max_retries):
                try:
                    eng_response = await client.aio.models.generate_content(
                        model=MODEL,
                        contents=[
                            types.Part.from_uri(
                                file_uri=uploaded_file.uri,
                                mime_type=uploaded_file.mime_type,
                            ),
                            types.Part.from_text(text=engagement_prompt),
                        ],
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            response_mime_type="application/json",
                            response_schema=_ENGAGEMENT_SCHEMA,
                            temperature=0.1,
                        ),
                    )
                    eng_data = json.loads(eng_response.text)
                    print("  ✓ Engagement analysis complete")
                    return ("eng", eng_data)
                except Exception as e:
                    wait = 2 ** attempt * 5
                    if attempt < max_retries - 1:
                        print(f"  ⚠ Engagement retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                        await asyncio.sleep(wait)
                    else:
                        print(f"  ⚠ Engagement analysis failed after {max_retries} retries, skipping: {e}")
                        return ("eng", None)

        print("  Analysing art direction + engagement (parallel)...")
        parallel_results = await asyncio.gather(_do_4b(), _do_4c(), return_exceptions=True)

        for res in parallel_results:
            if isinstance(res, Exception):
                print(f"  ⚠ Parallel task failed: {res}")
                continue
            tag, data = res
            if data is None:
                continue
            if tag == "art":
                result["art_direction"] = data.get("art_direction", data)
            elif tag == "eng":
                result["empathy_triggers"] = data.get("empathy_triggers", [])
                result["narrative_analysis"] = data.get("narrative_analysis", {})
                result["retention_analysis"] = data.get("retention_analysis", {})

        return result
    finally:
        # Clean up temp file
        if is_temp and upload_path.exists():
            upload_path.unlink()


def run_video_analysis(
    video_path: str | Path,
    resolution: int = 720,
    frame_quals: list[dict] | None = None,
    narration_type: str | None = None,
    stt_transcript: str | None = None,
    product_scan: dict | None = None,
) -> dict:
    """Sync wrapper for analyse_video."""
    return asyncio.run(analyse_video(
        video_path,
        resolution=resolution,
        frame_quals=frame_quals,
        narration_type=narration_type,
        stt_transcript=stt_transcript,
        product_scan=product_scan,
    ))
