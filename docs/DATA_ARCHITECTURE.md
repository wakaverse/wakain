# WakaLab 분석 데이터 아키텍처

> 영상 1개 분석 시 생성되는 모든 RAW 데이터 구조 정의

---

## 1. 파이프라인 출력 파일 (Phase별)

영상 1개 분석 → 아래 JSON 파일들이 순차 생성됨:

```
{video_name}_stt.json            ← Phase 0: 음성→텍스트
{video_name}_product.json        ← Phase 0.1: 제품/카테고리
{video_name}_frame_quant.json    ← Phase 1: 프레임 수치 측정
{video_name}_frame_qual.json     ← Phase 2: 프레임 의미 해석
{video_name}_frames.json         ← Phase 1+2: 통합
{video_name}_scene_detect.json   ← SceneDetect 컷 경계
{video_name}_temporal.json       ← Phase 2.5: 시간축 분석
{video_name}_scenes.json         ← Phase 3+5: 씬 집계+병합
{video_name}_video_analysis.json ← Phase 4: Gemini 영상 분석
{video_name}_video_recipe.json   ← Phase 6: 최종 레시피
{video_name}_caption_map.json    ← Phase 7: 캡션 매핑
{video_name}_diagnosis.json      ← Phase 7: 3축 진단
{video_name}_prescriptions.json  ← Phase 7: 처방
{video_name}_verdict.json        ← Phase 7b: 마케터 심판
```

---

## 2. DB 저장 구조 (Supabase)

### results 테이블

| 컬럼 | 타입 | 내용 |
|------|------|------|
| id | uuid | PK |
| job_id | uuid | FK → jobs |
| user_id | uuid | FK → auth.users |
| product_json | jsonb | 제품 정보 |
| recipe_json | jsonb | 분석 결과 전체 (video_recipe) |
| temporal_json | jsonb | 시간축 데이터 |
| created_at | timestamp | |

---

## 3. RAW 데이터 상세 스펙

### 3-1. product_json (제품 정보)

```json
{
  "category": "food",              // 영문 카테고리
  "category_ko": "식품",           // 한글 카테고리
  "category_confidence": 0.95,     // 분류 확신도
  "product_name": "보넬드 그린주스", // 제품명
  "product_brand": "보넬드",        // 브랜드
  "multi_product": false,           // 복수 제품 여부
  "is_marketing_video": true,       // 마케팅 영상 여부
  "reasoning": "..."                // 분류 근거
}
```

**카테고리 enum:**
`food` | `health` | `beauty` | `fashion` | `tech` | `home` | `finance` | `education`

---

### 3-2. recipe_json.video_recipe (분석 결과 본체)

최상위 키 구조:

```
video_recipe
├── meta                    ← 영상 메타 정보
├── structure               ← 영상 구조
├── audio                   ← 오디오 분석
├── product_strategy        ← 제품 전략
├── effectiveness_assessment← 효과 평가
├── visual_style            ← 시각 스타일 (Phase 1+2+3 집계)
├── scenes                  ← 씬 리스트 (Phase 3+5)
├── scene_cards             ← 씬 카드 (프론트 표시용)
├── art_direction           ← 아트 디렉션 (Phase 4b)
├── empathy_triggers        ← 공감 트리거 (Phase 4c)
├── narrative_analysis      ← 내러티브 분석 (Phase 4c)
├── retention_analysis      ← 리텐션 분석 (Phase 4c)
├── dropoff_analysis        ← 이탈 분석 (Phase 4c)
├── persuasion_analysis     ← 설득 분석 (소구 포인트)
├── script_analysis         ← 7요소 분석 (Phase 4d)
├── script_alpha            ← α 기법 분석 (Phase 4e)
├── temporal_profile        ← 시간축 프로필
├── performance_metrics     ← 성능 지표
└── production_guide        ← 제작 가이드
```

---

### 3-3. meta (영상 메타)

```json
{
  "platform": "reels",           // tiktok | reels | shorts | ad
  "duration": 35.5,              // 초
  "aspect_ratio": "9:16",        // 9:16 | 1:1 | 16:9
  "category": "food",
  "sub_category": "건강식품",
  "target_audience": "30-40대 건강 관심 여성",
  "product_name": "보넬드 그린주스"
}
```

---

### 3-4. structure (영상 구조)

```json
{
  "type": "review",              // 내러티브 타입
  // enum: problem_solution | before_after | demo | review | listicle | story | trend_ride
  
  "hook_time": 0.5,              // 훅 시작 (초)
  "product_first_appear": 2.0,   // 제품 첫 등장 (초)
  "cta_start": 28.0,             // CTA 시작 (초)
  
  "scene_sequence": [            // 씬 시퀀스
    {
      "role": "hook",            // 씬 역할
      "duration": 2.0,           // 초
      "technique": "emotional_hook"
    },
    {
      "role": "benefit_demo",
      "duration": 8.0,
      "technique": "sensory_appeal"
    }
    // ...
  ]
}
```

---

### 3-5. audio (오디오 분석)

```json
{
  "music": {
    "present": true,
    "genre": "upbeat_pop",      // upbeat_pop | lo_fi | dramatic | trending_sound | acoustic | edm | none
    "energy_profile": "steady", // steady | building | drop | calm_to_hype
    "bpm_range": "120-130",
    "mood_match": "활기차고 밝은 분위기와 매치",
    "beat_sync": "컷 전환이 비트에 맞춰 진행"
  },
  "voice": {
    "type": "narration",        // narration | dialogue | voiceover | tts | none
    "tone": "excited",          // conversational | professional | excited | asmr | storytelling
    "language": "ko",
    "script_summary": "...",
    "hook_line": "매일 한 잔의 변화가...",
    "cta_line": "한정 수량 500개!"
  },
  "sfx": {
    "used": true,
    "types": ["whoosh", "pop"],
    "frequency": "moderate"     // heavy | moderate | minimal | none
  },
  "audio_visual_sync": "비트와 컷 전환이 잘 맞음"
}
```

---

### 3-6. product_strategy (제품 전략)

```json
{
  "reveal_timing": "immediate",       // immediate | gradual | delayed_reveal | teaser
  "demonstration_method": "in_use",   // in_use | comparison | transformation | testimonial | spec_highlight | unboxing
  "key_benefit_shown": "편리한 건강 관리",
  "price_shown": true,
  "price_framing": "vs_competitor",   // discount | per_day | vs_competitor | bundle | none
  "offer_type": "한정 수량 500개",
  "social_proof": "reviews",          // reviews | ugc | numbers | celebrity | expert | none
  "urgency_trigger": "stock_limit",   // time_limit | stock_limit | trend | none
  "brand_visibility": {
    "logo_shown": true,
    "brand_color_used": true,
    "brand_mention_count": 3
  }
}
```

---

### 3-7. persuasion_analysis (설득 분석 — 소구 포인트)

```json
{
  "video_style": "리뷰형",
  "presenter": "여성, 30대, 밝은 톤",
  "primary_appeal": "feature_demo",
  "appeal_layering": "기능 시연 → 성분 강조 → 가격 어필 → FOMO",
  
  "appeal_points": [                // 소구 포인트 배열
    {
      "type": "feature_demo",       // 소구 유형 (아래 enum 참조)
      "subtype": "taste_test",      // 세부 유형
      "source": "audio",            // 소구 출처: audio | visual | text | combined
      "claim": "달달하고 신선한 맛", // 실제 주장 내용
      "evidence": "시음 장면 + 표정", // 근거
      "time_range": [14, 19],       // 등장 시간 (초)
      "strength": "strong"          // strong | moderate | weak
    }
    // ...
  ]
}
```

**소구 유형 enum (18종):**
```
feature_demo     기능 시연        | design_aesthetic   디자인
emotional        공감             | manufacturing      제조 공법
ingredient       성분/원재료      | price              가격 어필
lifestyle        라이프스타일     | social_proof       사회적 증거
authority        전문성/권위      | urgency            긴급/한정
myth_bust        통념 깨기        | track_record       실적/수상
comparison       비교             | guarantee          보증/자신감
origin           원산지           | spec_data          스펙/수치
authenticity     진정성           | nostalgia          향수/추억
```

---

### 3-8. script_analysis (7요소 프레임워크 — Phase 4d)

```json
{
  "video_style": "리뷰형",
  
  "hook": {                            // ② 감탄 훅
    "text": "매일 한 잔의 변화가...",
    "pattern": "직접경험감탄",
    "time_range": [0, 2],
    "direct_experience": true
  },
  
  "cta": {                             // ⑦ CTA
    "text": "한정 수량 500개!",
    "type": "링크형",
    "keyword": "한정 수량 500개",
    "time_range": [27, 30]
  },
  
  "flow_order": [                      // 7요소 등장 순서
    "hook",
    "sensory_description",
    "simplicity",
    "authority",
    "social_proof",
    "sensory_description",
    "simplicity",
    "cta"
  ],
  
  "appeals": [                         // 각 요소별 상세
    {
      "element": "hook",               // 요소 종류 (7요소 enum)
      "used": true,                    // 사용 여부
      "text": "매일 한 잔의 변화가...",  // 실제 대사
      "subtype": "직접경험감탄",         // 세부 패턴
      "time_range": [0, 2]             // 등장 시간
    },
    {
      "element": "sensory_description",
      "used": true,
      "text": "칙칙했던 하루에, 생기를 쭉쭉...",
      "subtype": "emotional",
      "time_range": [0, 4]
    },
    {
      "element": "process",
      "used": false,                   // ⑤ 과정 — 미사용
      "text": "",
      "subtype": "",
      "time_range": [0, 0]
    }
    // ...
  ]
}
```

**7요소 enum:**
```
① authority           권위 부여
② hook                감탄 훅
③ sensory_description 상황/감각 묘사
④ simplicity          간편함 어필
⑤ process             과정 묘사
⑥ social_proof        사회적 증거
⑦ cta                 CTA (행동 유도)
```

**simplicity 세부 패턴:**
`number_limit` (3가지만) | `one_step` (이것만 하면) | `time_limit` (5분이면) | `empathy` (공감형 간편)

---

### 3-9. script_alpha (α 기법 — Phase 4e)

7요소가 "무엇을 말하나"라면, α는 "어떻게 말하나"

```json
{
  "emotion_techniques": [              // 감정 기법 (8종)
    {
      "type": "empathy",              // 기법 종류
      "text": "솔직히, 채소 하루에 한 개 먹기가 힘들잖아요",
      "time_range": [20, 22],
      "intensity": "high"
    }
    // ...
  ],
  
  "structure_techniques": [            // 구조 기법 (8종)
    {
      "type": "contrast",
      "text": "칙칙했던 → 생기를 쭉쭉",
      "time_range": [0, 4],
      "intensity": "high"
    }
    // ...
  ],
  
  "connection_techniques": [           // 연결 기법 (5종)
    {
      "type": "question_answer",
      "text": "아직도 고민 중이신가요?",
      "time_range": [4, 7],
      "intensity": "medium"
    }
    // ...
  ],
  
  "utterances": [                      // 발화별 주석
    {
      "text": "매일 한 잔의 변화가 칙칙했던 하루에,",
      "time_range": [0.0, 1.4],
      "element": "hook",              // 해당 7요소
      "emotion_layer": "empathy",     // 적용된 감정 기법
      "structure_layer": "problem_solution",  // 적용된 구조 기법
      "connection_layer": ""          // 적용된 연결 기법 (없으면 빈 문자열)
    }
    // ...
  ]
}
```

**α 기법 enum:**

| 레이어 | 기법 | 설명 |
|--------|------|------|
| **감정 (8)** | empathy | 공감 |
| | fomo | 놓칠까 두려움 |
| | anticipation | 기대감 |
| | relief | 안도 |
| | curiosity | 호기심 |
| | pride | 자부심 |
| | nostalgia | 향수 |
| | frustration | 좌절감 |
| **구조 (8)** | reversal | 반전 |
| | contrast | 대조 |
| | repetition | 반복 |
| | info_density | 정보 밀도 |
| | escalation | 에스컬레이션 |
| | before_after | 비포/애프터 |
| | problem_solution | 문제→해결 |
| | story_arc | 스토리 아크 |
| **연결 (5)** | bridge_sentence | 브릿지 문장 |
| | rhythm_shift | 리듬 전환 |
| | callback | 콜백 |
| | question_answer | 질문→응답 |
| | pause_emphasis | 멈춤 강조 |

---

### 3-10. visual_style (시각 스타일 — Phase 1+2+3 집계)

```json
{
  "total_cuts": 24,
  "avg_cut_duration": 1.4,
  "color_palette": ["#2B4C3F", "#F5D3A8", "#FFFFFF"],
  "color_grading": "warm",
  "overall_mood": "bright_energetic",
  "text_usage": {
    "text_heavy": true,
    "avg_text_per_scene": 2.3,
    "text_position": "bottom_center"
  },
  "product_exposure": {
    "total_seconds": 28.0,
    "percentage": 80,
    "prominence": "high"
  },
  "human_presence": {
    "has_face": true,
    "face_time_pct": 45,
    "presenter_type": "influencer"
  }
}
```

---

### 3-11. art_direction (아트 디렉션 — Phase 4b)

```json
{
  "heading_font": "gothic_bold",
  "body_font": "rounded",
  "brand_colors": ["#FF6B35", "#FFFFFF"],
  "graphic_style": "clean_minimal",
  "style_reference": "밝고 깔끔한 건강식품 광고 스타일",
  "text_animation": "fade_in",
  "consistency_score": "high"
}
```

---

### 3-12. temporal_json (시간축 데이터)

```json
{
  "attention_curve": {
    "points": [
      {"t": 0.0, "score": 45},
      {"t": 0.5, "score": 62},
      {"t": 1.0, "score": 78}
      // ... 프레임마다 1개
    ],
    "peak_timestamps": [3.5, 15.0, 28.0],
    "attention_avg": 52,
    "attention_arc": "building→peak→fade"
  },
  "cut_rhythm": {
    "intervals": [1.2, 0.8, 1.5, 0.6],    // 컷 간격 (초)
    "pattern": "irregular",                  // regular | irregular | accelerating | decelerating
    "density_timeline": [
      {"t": 0, "cuts_per_3s": 2},
      {"t": 3, "cuts_per_3s": 3}
      // ... 3초 윈도우
    ]
  },
  "total_duration": 35.5,
  "total_cuts": 24,
  "scene_boundaries": [[0, 3.5], [3.5, 8.0], [8.0, 15.0]]
}
```

---

### 3-13. scenes (씬 리스트)

```json
[
  {
    "scene_id": 0,
    "time_range": [0.0, 3.5],
    "duration": 3.5,
    "frame_count": 7,
    "visual_summary": {
      "avg_brightness": 142,
      "avg_saturation": 85,
      "dominant_colors": ["#2B4C3F", "#F5D3A8"],
      "primary_shot_type": "closeup",
      "text_present": true
    },
    "content_summary": {
      "subject_type": "product",
      "product_visible": true,
      "human_visible": true,
      "action": "presenting"
    },
    "attention": {
      "avg": 65,
      "max": 82,
      "trend": "rising"
    },
    "role": "hook",                    // Phase 4에서 부여
    "technique": "emotional_hook"      // Phase 4에서 부여
  }
  // ...
]
```

---

## 4. 데이터 관계도

```
영상 1개
  │
  ├── product_json ─── 제품명/카테고리/브랜드
  │
  ├── recipe_json
  │   └── video_recipe
  │       ├── 영상 축 (WATCH)
  │       │   ├── visual_style ─── 컷수, 색감, 제품 노출
  │       │   ├── art_direction ─── 폰트, 그래픽, 색상
  │       │   ├── scenes ─── 씬별 시각/콘텐츠 요약
  │       │   └── temporal_profile ─── 에너지, 리듬
  │       │
  │       ├── 대본 축 (WHY BUY)
  │       │   ├── persuasion_analysis ─── 소구 포인트 (18종)
  │       │   ├── script_analysis ─── 7요소 배치
  │       │   └── script_alpha ─── α 기법 (21종)
  │       │
  │       ├── 구조 축
  │       │   ├── structure ─── 내러티브 타입, 씬 시퀀스
  │       │   ├── audio ─── 음악/보이스/SFX
  │       │   └── product_strategy ─── 노출/가격/긴급성
  │       │
  │       └── 인게이지먼트
  │           ├── empathy_triggers ─── 공감 트리거
  │           ├── narrative_analysis ─── 내러티브 평가
  │           ├── retention_analysis ─── 리텐션 평가
  │           └── dropoff_analysis ─── 이탈 분석
  │
  └── temporal_json ─── 시각 에너지 곡선 + 컷 리듬
```

---

## 5. 온톨로지 5축 매핑

| 축 | 데이터 소스 | 상태 |
|----|-----------|------|
| ① WHY BUY (왜 사나) | persuasion_analysis + script_analysis + script_alpha | ✅ 있음 |
| ② WATCH (왜 보나) | visual_style + art_direction + temporal + scenes | ✅ 있음 |
| ③ WHAT (카테고리 패턴) | product_json.category + 교차 분석 | ✅ 있음 |
| ④ WHO (타깃 심리) | 미수집 | ❌ 없음 |
| ⑤ WHERE (플랫폼 문법) | meta.platform + 플랫폼별 패턴 | 🟡 부분 |

---

## 6. 누락/개선 필요 데이터

| 항목 | 현재 | 필요 |
|------|------|------|
| STT 원문 | stt.json에만 존재 | DB에 저장 필요 |
| 프레임 수치 | frame_quant.json에만 | 요약만 DB 저장 |
| 씬 상세 | scenes.json | recipe_json.scenes에 있음 ✅ |
| 소구-발화 관계 | 시간축 겹침으로 추론 | 명시적 연결 필요 |
| 타깃 심리 (WHO) | 없음 | Phase 4에 추가 필요 |
| 성과 데이터 (ROAS) | 없음 | ATMS 연동 시 추가 |
