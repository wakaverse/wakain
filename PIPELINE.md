# WakaLab 분석 파이프라인 명세서

> 다른 AI/개발자가 파이프라인을 이해하고 수정할 수 있도록 작성한 문서

## 아키텍처 개요

```
입력: 숏폼 마케팅 영상 (MP4, 15~120초)

┌─────────────────────────────────────────────────┐
│  병렬 그룹 1 (~25s)                              │
│  Phase 0 (STT) + 0.1 (Style) + 0.5 (Scene) + 1 │
├─────────────────────────────────────────────────┤
│  병렬 그룹 2 (~80s)                              │
│  Phase 2 (Frame Qual) ∥ Phase 4 (4a+4b+4c)     │
├─────────────────────────────────────────────────┤
│  순차 (~32s)                                     │
│  2.5 → 3 → 5 → 6 → 7 → 7b                     │
└─────────────────────────────────────────────────┘

출력: _video_recipe.json + _diagnosis.json + _verdict.json 등
```

---

## Phase 0: STT (음성→텍스트)

- **API**: Soniox (외부 STT 서비스)
- **모델**: Soniox 기본
- **LLM 프롬프트**: 없음 (API 호출만)
- **입력**: 영상 파일 (오디오 트랙)
- **출력**: `{video_name}_stt.json`

```json
{
  "narration_type": "voice" | "caption" | "silent",
  "total_speech_sec": 25.3,
  "full_transcript": "김이 다 거기서 거기라고요? ...",
  "segment_count": 15,
  "segments": [
    {"start": 0.0, "end": 1.5, "text": "김이 다 거기서 거기라고요?"},
    {"start": 1.8, "end": 3.2, "text": "한 입 드셔 보시면"}
  ],
  "tokens": {"input": 100, "output": 500}
}
```

---

## Phase 0.1: Style Classification (스타일 분류)

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash-lite`
- **입력**: 영상 파일 업로드

### LLM 프롬프트

```
You are a shortform marketing video classifier. Analyze this video and classify it on two axes.

## Axis 1: Format (영상 형식) — how the video is made
Choose ONE primary and optionally ONE secondary:
- talking_head: 진행자/발표자가 말하며 설명
- ugc_vlog: 실사용자 리얼 후기, 일상 느낌
- caption_text: 무음 또는 BGM만 + 텍스트 오버레이 중심
- product_demo: 제품 기능 시연, 언박싱
- asmr_mood: 시각+청각 감성 자극, 무드 중심
- comparison: A vs B 직접 비교
- story_problem: 문제→해결 서사 구조
- listicle: 여러 제품/항목 나열 소개
- entertainment: 반전/유머/밈 중심

## Axis 2: Intent (영상 의도) — what the video aims to achieve
Choose ONE:
- commerce: 즉각적인 구매/전환 유도 (가격, CTA, 할인 등)
- branding: 브랜드 인지도/이미지 구축
- information: 교육/설명/정보 전달
- entertainment: 바이럴/공유/즐거움

## Response format (JSON only):
{
  "primary_format": "...",
  "secondary_format": null or "...",
  "primary_intent": "...",
  "format_confidence": 0.0-1.0,
  "intent_confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation in Korean"
}
```

### 출력: `{video_name}_style.json`

```json
{
  "primary_format": "talking_head",
  "primary_format_ko": "진행자형",
  "secondary_format": null,
  "primary_intent": "commerce",
  "primary_intent_ko": "커머스/세일즈",
  "format_confidence": 0.92,
  "intent_confidence": 0.88,
  "auto_classified": true,
  "reasoning": "진행자가 직접 제품을 들고 설명하며 구매를 유도하는 전형적인 커머스 숏폼"
}
```

---

## Phase 0.5: SceneDetect (장면 전환 검출)

- **API**: 없음 (PySceneDetect 로컬)
- **LLM 프롬프트**: 없음
- **입력**: 영상 파일
- **출력**: `{video_name}_scene_detect.json`

```json
{
  "boundaries": [[0.0, 3.5], [3.5, 8.2], [8.2, 15.0]],
  "cut_timestamps": [3.5, 8.2, 15.0, 22.3]
}
```

---

## Phase 1: Frame Quant (프레임 정량 분석)

- **API**: 없음 (OpenCV 로컬)
- **LLM 프롬프트**: 없음
- **입력**: 영상 → 2fps로 프레임 추출
- **출력**: `{video_name}_frame_quant.json`

```json
[
  {
    "timestamp": 0.0,
    "edge_diff": 45.2,        // 전 프레임 대비 변화량
    "color_diff": 12.3,
    "is_stagnant": false,
    "dominant_colors": [{"hex": "#FF5733", "ratio": 0.35}],
    "brightness": 128.5,
    "saturation": 0.65,
    "contrast": 0.72,
    "text_region": {"has_text": true, "area_ratio": 0.15},
    "face_detected": true,
    "face_area_ratio": 0.25,
    "subject_area_ratio": 0.60
  }
]
```

---

## Phase 2: Frame Qual (프레임 정성 분석)

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash`
- **입력**: JPEG 프레임 이미지 + Phase 1 quant 데이터
- **병렬**: 최대 10개 동시 호출, 0.3초 딜레이

### LLM 프롬프트 (System Instruction)

```
You are a shortform marketing video analyst. You analyse individual frames
to extract structured visual metadata for building a video recipe.

Always respond with valid JSON matching the requested schema exactly.

Be precise with shot_type classification:
  - closeup: main subject occupies >60% of frame
  - medium: 30-60%
  - wide: <30%
  - overhead: camera looks down from above
  - pov: first-person perspective
  - split_screen: frame is visually divided into panels

For text_overlay: set to null if no text is visible in the frame.
  For text_overlay fields also detect: font_color, outline, shadow, background_box, font_size.
For product_presentation: if no product is visible, use visibility="hidden".
For human_element: if no person is visible, use role="none".

For artwork analysis:
- typography: font family (gothic/rounded/serif/handwritten/display/monospace),
  weight, color (hex), outline/shadow/background, alignment, line count,
  highlight technique (color_change/size_increase/underline/box_highlight/glow/bold_keyword).
  Set typography to null if NO text visible.
- graphic_elements: icons, stickers, emojis, arrows, badges, gradient overlays.
  Use ["none"] if no graphic elements.
- layout_zones: top/middle/bottom (text/product/person/graphic/empty/mixed)
- color_design: primary bg color, accent color, contrast level, harmony type.
```

### 사용자 프롬프트 (프레임별)

```
## Frame Quantitative Data (auto-measured)
{frame_quant JSON}

Analyse the frame image above together with the quantitative data.
Return a JSON object matching the FrameQual schema.
```

### 출력: `{video_name}_frame_qual.json`

```json
[
  {
    "timestamp": 0.0,
    "shot_type": "closeup" | "medium" | "wide" | "overhead" | "pov" | "split_screen",
    "subject_type": "product_only" | "person_with_product" | "person_only" | "text_graphic" | "lifestyle_scene" | "before_after",
    "composition": {"rule_of_thirds": true, "center_weighted": false, ...},
    "text_overlay": {
      "content": "김이 다 거기서 거기?",
      "purpose": "hook" | "benefit" | "cta" | "brand" | ...,
      "font_color": "#FFFFFF",
      "font_size": "large"
    } | null,
    "product_presentation": {
      "visibility": "full" | "partial" | "glimpse" | "hidden" | "in_use",
      "angle": "front", "context": "hand-held"
    },
    "human_element": {
      "role": "presenter" | "user" | "model" | "none",
      "expression": "excited", "eye_contact": true
    },
    "color_mood": "warm_cozy" | "cool_professional" | "vibrant_energetic" | "muted_luxury" | "natural_organic" | "bold_contrast",
    "attention_element": "제품 클로즈업 + 가격 텍스트",
    "artwork": {
      "typography": {...} | null,
      "graphic_elements": [...],
      "layout_zones": {"top": "text", "middle": "product", "bottom": "empty"},
      "color_design": {...}
    } | null
  }
]
```

---

## Phase 2.5: Temporal Analysis (시간축 분석)

- **API**: 없음 (로컬 계산)
- **LLM 프롬프트**: 없음
- **입력**: frame_quant + scene_detect
- **출력**: `{video_name}_temporal.json`

```json
{
  "cut_rhythm": {
    "total_cuts": 12,
    "cuts_per_second": 0.4,
    "cut_intervals": [3.5, 4.7, ...],
    "rhythm_consistency": 0.72
  },
  "brightness_curve": [...],
  "motion_curve": [...],
  "color_shift_curve": [...]
}
```

---

## Phase 3: Scene Aggregator (장면 집계)

- **API**: 없음 (로컬)
- **LLM 프롬프트**: 없음
- **입력**: frame_quant + frame_qual + temporal + scene_detect
- **출력**: 메모리 (Scene 객체 리스트, 파일 저장 없음)

프레임 단위 데이터를 장면(scene) 단위로 집계:
- 장면별 대표 샷타입, 컷수, 모션레벨
- 장면별 텍스트 오버레이, 제품 노출도
- 장면별 어텐션 스코어 계산

---

## Phase 4a: Video Analysis (풀영상 Gemini 분석) — 메인

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash`
- **입력**: 영상 파일 업로드 + STT transcript(컨텍스트) + Style 정보

### LLM 프롬프트 (System Instruction) — 핵심 부분

```
You are a shortform marketing video analyst specialising in Korean commerce ads.
Analyse the uploaded video holistically — audio, structure, product strategy, and effectiveness.
Respond with valid JSON matching the requested schema exactly.

For audio analysis:
- Listen carefully to music, voice, and sound effects
- Do NOT produce a transcript (transcript is provided separately via STT)
- Summarise the voice script in Korean

For structure:
- Identify the overall narrative structure type
- Note scene sequence with roles and durations
- Pinpoint hook timing, product first appearance, CTA start

For product_strategy:
- How/when is the product revealed
- What benefits are highlighted
- Pricing, offers, social proof elements

For effectiveness_assessment:
- Rate hook, flow, message clarity, CTA, replay factor

For text_effects:
- ALL text overlays with timing, animation, sync_with

For scene_roles:
- Each scene's narrative role (hook/problem/solution/demo/proof/cta/...)
- With start/end times and Korean description

For persuasion_analysis:
- presenter: type (founder/reviewer/narrator/customer/expert/character/none), face_shown, credibility
- video_style: type (pitch/demo/mukbang/comparison/vlog/review/info/story/challenge)
- appeal_points: EVERY persuasion point with type, claim, visual_proof, strength, source(visual/script/both)
  - Rational types: myth_bust, ingredient, manufacturing, track_record, price, comparison, guarantee, origin, feature_demo, spec_data
  - Emotional types: design_aesthetic, authenticity, social_proof, urgency, lifestyle, nostalgia, authority, emotional
- product_emphasis: first_appear, screen_time_ratio, hero_shots, techniques
- primary_appeal, appeal_layering, persuasion_summary
```

### 조건부 프롬프트 보충

- **VOICE 트랙** (narration_type == "voice"): STT 전문을 포함하여 나레이션 기반 소구 분석 강화
- **CAPTION 트랙** (narration_type == "caption"): 텍스트 오버레이 중심 분석
- **스타일 컨텍스트**: 분류된 format×intent에 맞는 핵심 지표·효과적 소구·추천 구조 안내

### Gemini Response Schema

```json
{
  "meta": {platform, duration, aspect_ratio, category, sub_category, target_audience},
  "structure": {type, scene_sequence[], hook_time, product_first_appear, cta_start},
  "audio": {
    "music": {present, genre, energy_profile, bpm_range, mood_match, beat_sync},
    "voice": {type, tone, language, script_summary, hook_line, cta_line},
    "sfx": {used, types[], frequency},
    "audio_visual_sync": string
  },
  "product_strategy": {reveal_timing, demonstration_method, key_benefit_shown, price_shown, price_framing, offer_type, social_proof, urgency_trigger, brand_visibility},
  "effectiveness_assessment": {hook_rating, flow_rating, message_clarity, cta_strength, replay_factor, standout_elements[], weak_points[]},
  "text_effects": [{time, content, entrance, exit, emphasis, sync_with}],
  "scene_roles": [{start, end, role, description}],
  "persuasion_analysis": {presenter, video_style, appeal_points[], product_emphasis, primary_appeal, appeal_layering, persuasion_summary}
}
```

### 출력: `{video_name}_video_analysis.json` (4a+4b+4c 합침)

---

## Phase 4b: Art Direction (아트 디렉션) — 별도 호출

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash`
- **입력**: 같은 업로드 파일 재사용

### LLM 프롬프트

```
Analyse this shortform marketing video's visual identity and art direction.

Return a JSON object with art_direction containing:
- tone_and_manner: overall visual tone in Korean
- heading_font / body_font: font families
- font_color_system: text colors (hex list)
- highlight_method: how keywords are emphasized
- brand_colors: brand/theme colors (hex list)
- background_style: solid_color/gradient/image_bg/video_bg/transparent/mixed
- color_temperature: warm/neutral/cool
- graphic_style: clean_minimal/bold_graphic/playful_sticker/premium_elegant/retro_vintage/info_graphic/hand_drawn/photo_real
- recurring_elements: repeated visual elements (Korean)
- text_position_pattern / frame_composition_rule
- visual_consistency: high/medium/low
- style_reference: what this style resembles (Korean)
```

### 출력: `_video_analysis.json`의 `art_direction` 필드에 합침

---

## Phase 4c: Engagement Analysis (인게이지먼트) — 별도 호출

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash`
- **입력**: 같은 업로드 파일 재사용

### LLM 프롬프트

```
Analyse this shortform marketing video's engagement factors.

Return a JSON with:
1. empathy_triggers: emotional triggers used
   (pain_empathy/desire/belonging/fomo/curiosity/humor/nostalgia/fear/pride/relief)
   with timestamp, description (Korean), intensity (strong/moderate/weak)
2. narrative_analysis: pattern, tension_arc, resolution_satisfaction, curiosity_gap, loop_structure
3. retention_analysis: hook_strength, drop_off_risks[], rewatch_triggers[], share_triggers[], comment_triggers[], completion_likelihood

Focus on what makes viewers FEEL, STAY, and SHARE.
```

### Gemini Response Schema

```json
{
  "empathy_triggers": [
    {"trigger_type": "pain_empathy", "timestamp": 1.5, "description": "...", "intensity": "strong"}
  ],
  "narrative_analysis": {
    "pattern": "problem_solution" | "reversal" | "comparison" | "listicle" | "storytelling" | "direct_pitch" | "challenge" | "tutorial",
    "tension_arc": "rising" | "flat" | "peak_valley" | "steady_build" | "frontloaded",
    "resolution_satisfaction": "strong" | "moderate" | "weak" | "none",
    "curiosity_gap": true/false,
    "loop_structure": true/false
  },
  "retention_analysis": {
    "hook_strength": "irresistible" | "strong" | "moderate" | "weak",
    "drop_off_risks": [{"timestamp": 8.0, "reason": "...", "severity": "high"}],
    "rewatch_triggers": ["..."],
    "share_triggers": ["..."],
    "comment_triggers": ["..."],
    "completion_likelihood": "very_high" | "high" | "medium" | "low"
  }
}
```

### 출력: `_video_analysis.json`의 `empathy_triggers`, `narrative_analysis`, `retention_analysis` 필드에 합침

---

## Phase 5: Scene Merger (장면 병합)

- **API**: 없음 (로컬)
- **LLM 프롬프트**: 없음
- **입력**: Phase 3 Scene 리스트 + Phase 4 video_analysis
- **로직**: 시간 겹침(time overlap)으로 Gemini 분석 결과를 장면에 매핑

### 매핑 규칙
1. `scene_roles` → 장면 역할 (hook/demo/cta...) — 최대 겹침 매칭
2. `transcript` → 현재 사용 안 함 (Soniox가 Phase 7에서 직접 매칭)
3. `text_effects` → 출현 시간으로 장면에 배정
4. `appeal_points` → `visual_proof.timestamp`로 장면에 배정

### 출력: 메모리 (enriched Scene 리스트)

```
Scene = {
  scene_id: int,
  role: "hook" | "problem" | "solution" | "demo" | "proof" | "cta" | ...,
  description: "제품 클로즈업과 함께 4가지 맛 소개",
  time_range: [3.5, 8.2],
  duration: 4.7,
  visual_summary: {dominant_shot, cut_count, motion_level, color_mood, ...},
  content_summary: {subject_type, product_visibility, text_overlays[], ...},
  effectiveness_signals: {hook_strength, information_density, emotional_trigger},
  attention: {attention_score, peak_timestamp, is_climax},
  transcript_segments: [{start, end, text, speaker}],  // Gemini mapped
  text_effects: [{time, content, entrance, exit, sync_with}],
  appeal_points: [{type, claim, visual_proof, strength, source}]
}
```

---

## Phase 6: Recipe Builder (레시피 빌더)

- **API**: 없음 (로컬)
- **LLM 프롬프트**: 없음
- **입력**: enriched Scenes + video_analysis + temporal
- **로직**: 전체 분석 데이터를 하나의 JSON으로 통합

### 출력: `{video_name}_video_recipe.json`

```json
{
  "video_recipe": {
    "meta": {platform, duration, aspect_ratio, category, sub_category, target_audience},
    "structure": {type, scene_sequence, hook_time, product_first_appear, cta_start},
    "visual_style": {dominant_shot, color_mood, ...},
    "audio": {music, voice, sfx, audio_visual_sync},
    "product_strategy": {reveal_timing, demo_method, price, social_proof, urgency, ...},
    "persuasion_analysis": {presenter, video_style, appeal_points[], product_emphasis, primary_appeal, ...},
    "art_direction": {tone_and_manner, fonts, colors, graphic_style, ...},
    "effectiveness_assessment": {hook_rating, flow_rating, message_clarity, ...},
    "scenes": [Scene × N],
    "temporal_profile": {cut_rate_curve, brightness_curve, ...},
    "production_guide": {scene별 촬영/편집 지시},
    "scene_cards": [SceneCard × N],
    "dropoff_analysis": {overall_retention_score, risk_points},
    "performance_metrics": {attention_avg, cut_frequency, ...},

    // Phase 4c injection (Pydantic 외부)
    "empathy_triggers": [...],
    "narrative_analysis": {...},
    "retention_analysis": {...}
  }
}
```

---

## Phase 7: Integrated Analysis (통합 분석)

- **API**: 없음 (로컬 계산)
- **LLM 프롬프트**: 없음
- **입력**: recipe + stt + style + caption_map + temporal

### 9축 스코어링

| # | 축 | 키 | 데이터 소스 |
|---|---|---|---|
| 1 | 시각 자극 | `visual_stimulus` | temporal(밝기/모션/색상 변화) + scenes |
| 2 | 소구 밀도 | `persuasion_density` | appeal_points 개수/밀도/강도 |
| 3 | 편집 리듬 | `edit_rhythm` | temporal(컷 빈도) — Gaussian 최적 0.55/s |
| 4 | 오디오 자극 | `audio_stimulus` | audio(music/voice/sfx) 평가 |
| 5 | 정보 밀도 | `information_density` | caption_map + stt + text_overlays |
| 6 | 페르소나 적합성 | `persona_fit` | presenter type × category 궁합 |
| 7 | 공감 트리거 | `empathy_trigger` | empathy_triggers 개수/다양성/강도 |
| 8 | 서사 구조 | `narrative_structure` | narrative_analysis(패턴/텐션/해결) |
| 9 | 리텐션 설계 | `retention_design` | retention_analysis(훅/이탈/공유트리거) |

각 축: 0-100점, 스타일 프로파일별 가중치 적용 → 가중평균 = engagement_score

### 출력

**`{video_name}_diagnosis.json`**:
```json
{
  "format_key": "talking_head",
  "format_ko": "진행자형",
  "intent_key": "commerce",
  "dimensions": [
    {"name": "visual_stimulus", "name_ko": "시각 자극", "value": 72.5, "weight": 0.15, "weighted": 10.9, "evidence": "..."}
  ],
  "engagement_score": 68.3,
  "diagnoses": [
    {"severity": "warning", "dimension": "edit_rhythm", "title": "편집 속도 부족", "detail": "...", "recommendation": "..."}
  ],
  "scene_analyses": [...],
  "hook_analysis": {...},
  "summary": "진행자형×커머스 영상으로, 3건의 개선 포인트가 있습니다.",
  "strengths": ["소구 밀도 우수 (82점)"],
  "weaknesses": ["편집 리듬 부족 (35점)"]
}
```

**`{video_name}_prescriptions.json`**: 구체적 수정 처방

**`{video_name}_caption_map.json`**: OCR 기반 캡션 이벤트 타임라인

---

## Phase 7b: Marketer Judge (마케터 판결)

- **API**: Google Gemini
- **모델**: `gemini-2.5-flash`
- **입력**: recipe evidence + frame_qual timeline (2초 간격) + 제품 정보

### LLM 프롬프트

```
# Role (역할)
너는 월 10억 원 이상의 광고비를 집행하며 수백 개의 숏폼 소재의 성과(ROAS, CTR)를
최적화해 온 '탑티어 퍼포먼스 마케터이자 크리에이티브 디렉터'야.
목표는 오직 "이 영상이 타겟 고객의 지갑을 열 수 있는가?"를 냉정하게 판단하는 거야.

# Input Data (입력 데이터)

## 1. 분석 엔진 증거 데이터
{evidence JSON — meta, structure, appeals, dimensions, strengths/weaknesses, engagement_score 등}

## 2. 프레임별 시각 분석 (2초 간격 스냅샷)
{frame_timeline JSON — 각 프레임의 shot, subject, text, product_visibility, color_mood 등}

## 3. 영상 기본 정보
* 영상의 목적(Intent): {intent}
* 영상의 형식(Format): {format}
* 팔고자 하는 제품: {product_name}
* 제품 카테고리: {product_category}
* 구매 결정 핵심 요소: {product_key_factors}

# Task (수행 과제)
프레임별 시각 데이터와 증거 데이터를 결합하여, 3가지 핵심 질문에 단호하게 대답.
모든 주장에 반드시 [타임스탬프]와 [화면 내용]을 근거로 달 것.

## 판결 기준
- 집행 권장: 핵심 소구가 적시에 전달, 제품-형식 적합성 높음
- 조건부 집행: 구조는 좋으나 특정 구간 수정 시 성과 개선 가능
- 집행 불가: 핵심 가치 미전달 또는 형식 자체 부적합

## 출력 형식 (Markdown)
### 1. 🛑 최종 판결: 이 영상으로 {product_name}이(가) 팔리겠는가?
### 2. 🔍 판단의 근거: 왜 팔리는가? (혹은 왜 안 팔리는가?)
### 3. 🛠️ 액션 플랜: 어떻게 하면 더 팔리겠는가?
```

### 출력: `{video_name}_verdict.json`

```json
{
  "verdict": "집행 권장" | "조건부 집행" | "집행 불가",
  "verdict_summary": "1-2줄 요약",
  "evidence": "판단 근거 (타임스탬프+화면 인용)",
  "action_plan": "구체적 To-Do 3가지",
  "full_markdown": "전체 Markdown 텍스트",
  "product_name": "태풍김",
  "product_category": "food"
}
```

---

## Style Profiles (스타일 프로파일)

9축 가중치를 결정하는 JSON 파일들:

**위치**: `analyzer/src/style_profiles/formats/*.json` (9개)

```
asmr_mood.json, caption_text.json, comparison.json, entertainment.json,
listicle.json, product_demo.json, story_problem.json, talking_head.json, ugc_vlog.json
```

**구조 예시** (`talking_head.json`):
```json
{
  "format": "talking_head",
  "key_metrics": ["voice_clarity", "presenter_credibility", "product_timing"],
  "effective_appeals": ["authority", "authenticity", "feature_demo"],
  "recommended_structure": ["hook", "problem", "solution", "demo", "cta"],
  "dimension_weights": {
    "visual_stimulus": 0.114,
    "persuasion_density": 0.228,
    "edit_rhythm": 0.076,
    "audio_stimulus": 0.190,
    "information_density": 0.152,
    "persona_fit": 0.06,
    "empathy_trigger": 0.06,
    "narrative_structure": 0.06,
    "retention_design": 0.06
  }
}
```

가중치 합계 = 1.0

---

## 파일 출력 요약

| 파일 | Phase | 크기(대략) |
|------|-------|-----------|
| `_stt.json` | 0 | 5-20KB |
| `_style.json` | 0.1 | 0.5KB |
| `_scene_detect.json` | 0.5 | 1KB |
| `_frame_quant.json` | 1 | 30-80KB |
| `_frame_qual.json` | 2 | 100-300KB |
| `_temporal.json` | 2.5 | 10-30KB |
| `_video_analysis.json` | 4a+4b+4c | 20-50KB |
| `_video_recipe.json` | 6 | 100-300KB |
| `_caption_map.json` | 7 | 5-15KB |
| `_diagnosis.json` | 7 | 10-30KB |
| `_prescriptions.json` | 7 | 5-15KB |
| `_verdict.json` | 7b | 3-10KB |

---

## Gemini API 호출 총 정리

| # | Phase | 모델 | 용도 | 입력 | 비용/건 |
|---|-------|------|------|------|---------|
| 1 | 0.1 | flash-lite | 스타일 분류 | 영상 업로드 | ~₩10 |
| 2 | 2 | flash | 프레임 OCR×N | JPEG 이미지 | ~₩50-100 |
| 3 | 4a | flash | 메인 영상 분석 | 영상 업로드 | ~₩50 |
| 4 | 4b | flash | 아트 디렉션 | 같은 파일 | ~₩20 |
| 5 | 4c | flash | 인게이지먼트 | 같은 파일 | ~₩20 |
| 6 | 7b | flash | 마케터 판결 | 텍스트 only | ~₩50 |
| | | | **합계** | | **~₩150-250** |

---

## 코드 위치

```
wakain/
├── analyzer/
│   ├── main.py                    # 파이프라인 오케스트레이터
│   └── src/
│       ├── stt_extractor.py       # Phase 0: Soniox STT
│       ├── style_classifier.py    # Phase 0.1: Style 분류
│       ├── scene_detect.py        # Phase 0.5: PySceneDetect
│       ├── frame_extractor.py     # Phase 1: 프레임 추출
│       ├── frame_quant.py         # Phase 1: OpenCV 정량
│       ├── frame_qual.py          # Phase 2: Gemini 정성
│       ├── temporal_analyzer.py   # Phase 2.5: 시간축
│       ├── scene_aggregator.py    # Phase 3: 장면 집계
│       ├── video_analyzer.py      # Phase 4: Gemini 영상 분석
│       ├── scene_merger.py        # Phase 5: 장면 병합
│       ├── recipe_builder.py      # Phase 6: 레시피 빌더
│       ├── integrated_analyzer.py # Phase 7: 9축 스코어링
│       ├── prescription_engine.py # Phase 7: 처방
│       ├── caption_mapper.py      # Phase 7: 캡션 매핑
│       ├── marketer_judge.py      # Phase 7b: 마케터 판결
│       ├── schemas.py             # 전체 Pydantic 스키마
│       └── style_profiles/        # 스타일별 가중치
│           ├── formats/           # 9개 포맷 JSON
│           └── intents/           # 4개 의도 JSON
├── backend/                       # FastAPI + Cloud Run
└── frontend/                      # React + Vite + Tailwind
```
