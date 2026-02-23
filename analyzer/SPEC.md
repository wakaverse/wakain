# Video Analyzer — 숏폼 마케팅 영상 분석 파이프라인

## 목적
숏폼 마케팅 영상을 분석하여 "왜 잘됐는가"의 레시피를 추출하고,
이를 기반으로 새로운 영상 제작 가이드를 생성하는 도구.

## 아키텍처: 4-Layer Pipeline

```
영상 입력
  ├── Track 1: 프레임 분석 (2fps)
  │     ├── OpenCV → frame_quant (자동, 빠름, 정확)
  │     ├── LLM 이미지 → frame_qual (Gemini Flash, quant 컨텍스트 포함)
  │     └── 후공정 → scene 병합
  │
  ├── Track 2: Gemini 영상 통째로
  │     ├── audio 분석 (음악/나레이션/SFX)
  │     ├── STT → 대본 추출
  │     └── 전체 흐름/구조 판단
  │
  └── 병합 → video_recipe (Layer 3)
        └── 축적 → category_benchmark (Layer 4)
```

## 기술 스택
- Python 3.11+
- OpenCV (프레임 추출 + 정량 분석)
- Google Gemini API (이미지 분석 + 영상 분석)
- JSON 출력

## Layer 1: 프레임 분석

### frame_quant (OpenCV 자동 추출)
```json
{
  "timestamp": 2.5,
  "edge_diff": 45.2,
  "color_diff": 1.13,
  "is_stagnant": false,
  "dominant_colors": [
    {"hex": "#E8C4A0", "ratio": 0.35},
    {"hex": "#2B1810", "ratio": 0.22}
  ],
  "brightness": 0.72,
  "saturation": 0.58,
  "contrast": 0.65,
  "text_region": {
    "detected": true,
    "area_ratio": 0.15,
    "position": "bottom_third"
  },
  "face_detected": true,
  "face_area_ratio": 0.18,
  "subject_area_ratio": 0.45
}
```

### frame_qual (Gemini Flash 이미지 분석)
- 정량 데이터를 컨텍스트로 함께 제공
- 이전 프레임 분석 결과도 컨텍스트로 제공 (연속성)

```json
{
  "timestamp": 2.5,
  "shot_type": "closeup | medium | wide | overhead | pov | split_screen",
  
  "subject_type": "product_only | person_with_product | person_only | text_graphic | lifestyle_scene | before_after",
  
  "composition": {
    "layout": "center | rule_of_thirds | diagonal | symmetry | frame_in_frame",
    "visual_weight": "left | right | center | balanced",
    "depth": "flat | shallow_dof | deep"
  },
  
  "text_overlay": {
    "content": "실제 OCR 텍스트",
    "purpose": "hook_question | pain_point | benefit | social_proof | price_offer | cta | brand | subtitle",
    "font_style": "bold_impact | elegant | handwritten | minimal",
    "readability": "high | medium | low"
  },
  
  "product_presentation": {
    "visibility": "hidden | glimpse | partial | full | in_use",
    "angle": "front | side | top | 360 | packaging | detail_macro",
    "context": "studio | lifestyle | comparison | transformation | unboxing"
  },
  
  "human_element": {
    "role": "presenter | user | model | hand_only | none",
    "emotion": "excited | confident | surprised | satisfied | neutral | concerned",
    "eye_contact": true,
    "gesture": "pointing | holding_product | demonstrating | reaction | none"
  },
  
  "color_mood": "warm_cozy | cool_professional | vibrant_energetic | muted_luxury | natural_organic | bold_contrast",
  
  "attention_element": "이 프레임에서 시선을 끄는 핵심 요소 1줄 설명"
}
```

**shot_type 기준:**
- closeup: 주 피사체가 화면의 60% 이상
- medium: 30~60%
- wide: 30% 미만
- overhead: 위에서 내려다보는 구도
- pov: 1인칭 시점
- split_screen: 화면 분할

## Layer 2: 씬 병합 (후공정)

연속 프레임의 shot_type + subject_type이 유사하면 하나의 씬으로 병합.

```json
{
  "scene_id": 1,
  "role": "hook | problem | solution | demo | proof | cta | transition | brand_intro",
  "time_range": [0.0, 3.0],
  "duration": 3.0,
  
  "visual_summary": {
    "dominant_shot": "closeup",
    "cut_count": 2,
    "avg_cut_interval": 1.5,
    "motion_level": "static | slow | moderate | fast | jump_cut",
    "color_consistency": 0.85,
    "color_mood": "warm_cozy"
  },
  
  "content_summary": {
    "subject_type": "person_with_product",
    "product_visibility": "in_use",
    "text_overlays": ["텍스트1", "텍스트2"],
    "key_action": "씬의 핵심 행위 1줄 설명"
  },
  
  "effectiveness_signals": {
    "hook_strength": "어떤 요소가 주의를 끄는가",
    "information_density": "high | medium | low",
    "emotional_trigger": "curiosity | fomo | trust | desire | humor | none"
  }
}
```

## Layer 3: 영상 레시피

```json
{
  "video_recipe": {
    "meta": {
      "platform": "tiktok | reels | shorts | ad",
      "duration": 28,
      "aspect_ratio": "9:16 | 1:1 | 16:9",
      "category": "beauty | food | tech | fashion | health | home | finance | education",
      "sub_category": "skincare_serum",
      "target_audience": "2030_female"
    },
    
    "structure": {
      "type": "problem_solution | before_after | demo | review | listicle | story | trend_ride",
      "scene_sequence": [
        {"role": "hook", "duration": 2.5, "technique": "요약"}
      ],
      "hook_time": 2.5,
      "product_first_appear": 3.0,
      "cta_start": 25.5
    },
    
    "visual_style": {
      "overall_mood": "warm_cozy",
      "color_palette": ["#hex1", "#hex2"],
      "color_grading": "warm_filter | natural | high_contrast | desaturated | brand_color_heavy",
      "brightness_profile": "consistent | dark_to_bright | bright_to_dark | varied",
      "avg_cut_interval": 2.1,
      "total_cuts": 13,
      "transition_style": "hard_cut | fade | swipe | zoom | mixed",
      "text_usage": {
        "frequency": "every_scene | key_moments | minimal | none",
        "style_consistency": "high | medium | low",
        "language_tone": "casual | professional | urgent | playful"
      },
      "human_screen_time_ratio": 0.65,
      "product_screen_time_ratio": 0.45,
      "face_time_ratio": 0.40
    },

    "audio": {
      "music": {
        "present": true,
        "genre": "upbeat_pop | lo_fi | dramatic | trending_sound | acoustic | edm | none",
        "energy_profile": "steady | building | drop | calm_to_hype",
        "bpm_range": "100-120",
        "mood_match": "영상 톤과 일치 여부",
        "beat_sync": "컷 전환이 비트에 맞는가"
      },
      "voice": {
        "type": "narration | dialogue | voiceover | tts | none",
        "tone": "conversational | professional | excited | asmr | storytelling",
        "language": "ko",
        "script_summary": "핵심 스크립트 요약",
        "hook_line": "첫 마디",
        "cta_line": "마지막 멘트"
      },
      "sfx": {
        "used": true,
        "types": ["whoosh_transition", "ding_emphasis", "pop_text_appear"],
        "frequency": "heavy | moderate | minimal | none"
      },
      "audio_visual_sync": "비트에 컷 맞춤 | 나레이션 흐름 따라감 | 독립적"
    },

    "product_strategy": {
      "reveal_timing": "immediate | gradual | delayed_reveal | teaser",
      "demonstration_method": "in_use | comparison | transformation | testimonial | spec_highlight | unboxing",
      "key_benefit_shown": "핵심 소구 포인트",
      "price_shown": true,
      "price_framing": "discount | per_day | vs_competitor | bundle | none",
      "offer_type": "할인코드 | 한정수량 | 무료체험 | 링크 | none",
      "social_proof": "reviews | ugc | numbers | celebrity | expert | none",
      "urgency_trigger": "time_limit | stock_limit | trend | none",
      "brand_visibility": {
        "logo_shown": true,
        "brand_color_used": true,
        "brand_mention_count": 2
      }
    },

    "effectiveness_assessment": {
      "hook_rating": "판단 + 근거",
      "flow_rating": "판단 + 근거",
      "message_clarity": "판단 + 근거",
      "cta_strength": "판단 + 근거",
      "replay_factor": "판단 + 근거",
      "standout_elements": ["요소1", "요소2"],
      "weak_points": ["개선점1"]
    }
  }
}
```

## Layer 4: 카테고리 벤치마크 (축적 후)
- 카테고리별 최적 패턴 자동 도출
- 초기에는 비워두고, 영상 50개+ 분석 후 구축

## 구현 순서
1. **Phase 1**: frame_quant 추출기 (OpenCV)
2. **Phase 2**: frame_qual LLM 분석 (Gemini Flash)
3. **Phase 3**: 씬 병합 후공정
4. **Phase 4**: Gemini 영상 통째로 분석 (audio/structure)
5. **Phase 5**: 병합 → video_recipe JSON 출력
6. **Phase 6**: CLI 인터페이스

## 파일 구조
```
video-analyzer/
├── README.md
├── SPEC.md
├── requirements.txt
├── src/
│   ├── __init__.py
│   ├── frame_extractor.py    # 2fps 프레임 추출
│   ├── frame_quant.py        # OpenCV 정량 분석
│   ├── frame_qual.py         # Gemini 정성 분석
│   ├── scene_merger.py       # 씬 병합 후공정
│   ├── video_analyzer.py     # Gemini 영상 통째로 분석
│   ├── recipe_builder.py     # 최종 레시피 병합
│   └── schemas.py            # JSON 스키마 정의
├── tests/
│   └── test_pipeline.py
├── samples/                  # 테스트 영상
└── output/                   # 분석 결과 JSON
```

## 환경
- Gemini API Key: 환경변수 GEMINI_API_KEY 또는 .env
- Python venv 사용
- OpenCV: pip install opencv-python-headless
