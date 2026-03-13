# WakaIn 데이터 맵 — 분석 파이프라인 & 결과 활용 전체 정리

> 최종 업데이트: 2026-03-13

---

## 1. 파이프라인 개요

영상 1개 → 13단계 분석 → RecipeJSON(최종 데이터) → 리포트 화면

```
입력: 영상 파일 (mp4, 최대 480p)

병렬①: P1(STT) + P2(SCAN) + P3(EXTRACT)
병렬②: P4(CLASSIFY) + P7(PRODUCT) + P8(VISUAL) + P9(ENGAGE)
순  차: P5(TEMPORAL) ← P3
순  차: P6(SCENE) ← P3 + P4
순  차: P10(SCRIPT) ← P1 + P2 + P7
순  차: P11(MERGE) ← P6 + P8 + P10
순  차: P12(BUILD) ← 전체 → RecipeJSON
순  차: P13(EVALUATE) ← RecipeJSON → 코칭 평가

출력: RecipeJSON + EvaluationOutput → DB 저장 → 프론트 리포트
```

**API 비용:** 영상 1건당 약 **$0.05** (~₩79)  
**소요 시간:** 약 2~3분

---

## 2. 각 Phase가 추출하는 데이터

### P1 — STT (음성→텍스트)
| 데이터 | 설명 |
|--------|------|
| `segments[]` | 타임스탬프별 발화 텍스트 `{start, end, text}` |
| `full_text` | 전체 대본 텍스트 |
| **모델:** Soniox | **API 콜:** 1 |

### P2 — SCAN (첫인상 스캔)
| 데이터 | 설명 |
|--------|------|
| `product` | 카테고리, 소분류, 제품명, 브랜드, 플랫폼, 타겟 오디언스 |
| `meta` | 영상 길이, 해상도, 종횡비 |
| `audio` | BGM 유무/장르, 보이스오버, 효과음, 음악 변화점 |
| `human_presence` | 인물 유무, 역할, 얼굴 노출 |
| **모델:** Gemini 2.5 Flash Lite | **API 콜:** 1 |

### P3 — EXTRACT (프레임 추출 + 정량 분석) — 로컬
| 데이터 | 설명 |
|--------|------|
| `frames[]` | 1fps 프레임 JPEG (720px 리사이즈) |
| 프레임별 정량 | brightness, saturation, edge_diff, color_diff |
| `scene_boundaries` | SceneDetect 기반 씬 경계점 |
| **API 콜:** 0 (로컬 처리) |

### P4 — CLASSIFY (프레임 정성 분류)
| 데이터 | 설명 |
|--------|------|
| `frames[]` | shot_type, color_tone, text_usage, has_text, has_product, has_person |
| **모델:** Gemini 2.5 Flash Lite | **API 콜:** ceil(프레임수/8) |

### P5 — TEMPORAL (시간축 분석) — 로컬
| 데이터 | 설명 |
|--------|------|
| `attention_curve` | 초당 어텐션 점수 (0~100) |
| `attention_points[]` | 주요 어텐션 포인트 `{time, score, reason}` |
| `cut_rhythm` | 컷당 평균 길이, 표준편차, 최소/최대 |
| `cut_details[]` | 개별 컷 `{start, end, duration}` |
| `tempo_level` | fast / medium / slow |
| **API 콜:** 0 (로컬 처리) |

### P6 — SCENE (씬 집계)
| 데이터 | 설명 |
|--------|------|
| `scenes[]` | 씬별 시간범위, 대표 프레임, 정량/정성 통계 |
| `production` | 씬별 촬영기법 (shot_type, color_tone 분포) |
| **API 콜:** 0 (P3+P4 결합) |

### P7 — PRODUCT (제품 소구점 추출)
| 데이터 | 설명 |
|--------|------|
| `claims[]` | 소구점 목록: `{claim, type, layer, verifiable, source}` |
| `claim_type` | experience / trust / spec / price / emotion |
| `translation` | 소구점 → 시청자 언어 번역 |
| `strategy` | 설득 전략 (experience_shift / authority_transfer 등) |
| **모델:** Gemini 2.5 Flash | **API 콜:** 1 |

### P8 — VISUAL (영상 구조 분석)
| 데이터 | 설명 |
|--------|------|
| `scenes[]` | 씬별 style, style_sub, role, visual_forms, description |
| `visual_forms[]` | 촬영 형태 (closeup, wide, pov, overlay 등) |
| **모델:** Gemini 2.5 Flash | **API 콜:** 1 |

### P9 — ENGAGE (리텐션 + 후킹 분석)
| 데이터 | 설명 |
|--------|------|
| `hook_strength` | strong / moderate / weak |
| `hook_reason` | 훅 강도 근거 (1문장) |
| `hook_scan` | **🆕 R17** 3초+8초 2단 분해 |
| ↳ `first_3s` / `first_8s` | 구간별: appeal_type, text_banner, person_appear, product_appear, sound_change, cut_count, dominant_element |
| ↳ `hook_type` | question / shock / curiosity / benefit / story |
| `rewatch_triggers[]` | 재시청 트리거 `{time, trigger}` |
| `share_triggers[]` | 공유 트리거 |
| `comment_triggers[]` | 댓글 트리거 |
| `risk_zones[]` | 이탈 위험 구간 `{time_range, risk_level, reason}` |
| `safe_zones[]` | 안전 구간 |
| **모델:** Gemini 2.5 Flash | **API 콜:** 1 |

### P10 — SCRIPT (대본 구조 분석)
| 데이터 | 설명 |
|--------|------|
| `blocks[]` | 대본 블록: `{block_type, text, time_range, alpha}` |
| `block_type` | hook / authority / benefit / proof / differentiation / social_proof / cta / pain_point / demo / promotion (10종) |
| `benefit_sub` | functional / emotional / economic / social (4종) |
| `alpha` | 화법 기법: emotion(8종) + structure(8종) + connection(5종) = 21종 |
| `alpha_summary` | 전체 화법 패턴 요약 |
| **모델:** Gemini 2.5 Flash | **API 콜:** 1 |

### P11 — MERGE (병합)
| 데이터 | 설명 |
|--------|------|
| `merged_scenes[]` | P6 씬 + P8 영상분석 + P10 블록 매핑 통합 |
| `style_primary` | 1위 영상 스타일 |
| `style_distribution` | 스타일 분포 비율 |
| `block_scene_mapping[]` | 블록↔씬 매핑 |
| **API 콜:** 0 (병합 로직) |

### P12 — BUILD (레시피 조립)
| 데이터 | 설명 |
|--------|------|
| `RecipeJSON` | 전체 Phase 결과를 최종 구조로 조립 |
| **API 콜:** 0 |

### P13 — EVALUATE (코칭 평가)
| 데이터 | 설명 |
|--------|------|
| `summary` | 코칭 한 줄 요약 |
| `positioning` | 콘텐츠 포지셔닝 (차별화 각도, 스토리텔링 포맷, 대비 구조) |
| `hook_analysis` | 훅 상세 (강도, 제목-훅 정합성, 제품 첫등장 시간, 3초 에너지) |
| `structure` | Hook/Body/CTA 3단 구조 평가 (구간별 강점/개선) |
| `checklist[]` | 규칙 기반 팩트 체크 (passed/failed + 근거) |
| `strengths[]` | 종합 강점 (fact + comment + 관련 씬) |
| `improvements[]` | 종합 개선 포인트 (fact + comment + suggestion + 관련 씬) |
| `recipe_eval` | 현재 블록 순서 vs 개선 제안 |
| **모델:** Gemini 2.5 Flash | **API 콜:** 1 |

---

## 3. 최종 데이터 구조 (RecipeJSON)

```
RecipeJSON
├── summary          — 핵심 전략 1줄 + 강점/약점/핵심 키워드
├── identity         — 카테고리/소분류/제품명/브랜드/플랫폼/타겟 (P2)
├── style            — 1위/2위 스타일 + 분포 (P11)
├── scenes[]         — 씬 목록 (P6+P11)
│   └── time_range, production, visual_forms, style, role, blocks
├── product          — 제품 축 (P2+P7)
│   ├── name, brand, category
│   └── claims[]     — 소구점 (type/layer/translation/strategy)
├── script           — 대본 축 (P10+P12)
│   ├── blocks[]     — 블록 (type/text/time/alpha)
│   ├── utterances[] — STT 발화 매핑 (text/time/block_ref)
│   └── alpha_summary — 화법 패턴 요약
├── visual           — 영상 축 (P6+P8+P11)
│   ├── scenes[]     — 씬별 영상 분석
│   ├── attention_curve — 초당 어텐션
│   ├── attention_points — 주요 포인트
│   └── rhythm       — 컷 리듬 통계
├── engagement       — 인게이지먼트 (P9)
│   ├── retention    — hook_strength/reason/hook_scan/triggers
│   └── dropoff      — risk_zones/safe_zones
├── meta             — 메타 정보 (P2)
│   ├── duration, resolution, aspect_ratio
│   ├── human_presence
│   └── audio (bgm/voice/sfx)
├── evaluation       — 코칭 평가 (P13)
│   ├── summary, positioning, hook_analysis
│   ├── structure (hook/body/cta 구간 평가)
│   ├── checklist, strengths, improvements
│   └── recipe_eval
└── pipeline         — 실행 정보
    ├── stages[]     — Phase별 모델/토큰 사용량
    ├── total_input/output tokens
    └── estimated_cost_usd
```

---

## 4. DB 저장 구조

### results 테이블 (메인)
| 컬럼 | 내용 |
|------|------|
| `recipe_json` | RecipeJSON 전체 (JSONB) |
| `summary_json` | 요약 데이터 |
| `stt_json` | STT 원본 |
| `diagnosis_json` | 진단 |
| `verdict_json` | 판정 |
| `product_json` | 제품 분석 |
| `appeal_structure_json` | 소구 구조 |
| `temporal_json` | 시간축 분석 |
| `persuasion_lens_json` | 설득 렌즈 |
| `thumbnails_json` | 썸네일 |
| `style_json` | 스타일 |
| `caption_map_json` | 자막 매핑 |

### analysis_claims (정규화 — R16)
| 컬럼 | 내용 |
|------|------|
| `claim` | 소구점 텍스트 |
| `claim_type` | experience / trust / spec / price / emotion |
| `claim_layer` | 계층 |
| `translation` | 시청자 번역 |
| `strategy` | 설득 전략 |
| `category_id` | FK → categories |

### analysis_blocks (정규화 — R16)
| 컬럼 | 내용 |
|------|------|
| `block_type` | 10종 블록 유형 |
| `block_text` | 블록 텍스트 |
| `block_order` | 순서 |
| `alpha_emotion/structure/connection` | 화법 기법 |
| `benefit_sub` | 이익 하위 유형 |
| `claim_id` | FK → analysis_claims |
| `category_id` | FK → categories |

---

## 5. 프론트엔드 리포트 화면

### 리포트 카드 → 데이터 매핑

| 카드 | 보여주는 내용 | 데이터 소스 |
|------|-------------|------------|
| **요약 카드** | 한 줄 요약, 카테고리, 길이, 훅 강도 | `summary` + `meta` + `engagement` |
| **코칭 카드** | 코칭 한 줄 요약, 강점, 개선 포인트 | `evaluation.summary/strengths/improvements` |
| **포지셔닝 카드** | 차별화 각도, 스토리텔링 포맷, 대비 구조 | `evaluation.positioning` |
| **훅 분석 카드** | 훅 강도, 제목-훅 정합성, 3초 에너지, 제품 첫등장 | `evaluation.hook_analysis` |
| **제품 소구 카드** | 소구점 목록 (유형별), 설득 전략 | `product.claims` + `meta` |
| **설득 흐름 카드** | 블록 순서별 설득 흐름, α 기법 | `script.blocks` + `meta` |
| **구조 분석 카드** | Hook/Body/CTA 3단 구조, 구간별 평가 | `evaluation.structure` + `script/visual/engagement` |
| **대본 섹션** | 블록별 텍스트, 화법 기법, alpha 요약 | `script` |
| **영상 섹션** | 씬별 스타일, 촬영기법, visual forms | `visual` |
| **어텐션 곡선** | 초당 집중도 그래프, 주요 포인트 | `visual.attention_curve/points` + `engagement` |
| **타임라인 카드** | 시간축 통합 (블록+씬+리스크) | `script` + `visual` + `engagement` |
| **씬 분석 카드** | 씬별 블록 매핑, 컷 분석 | `script` + `visual` |
| **후킹 스캔 카드** | 🆕 3초/8초 요소별 분해 (아이콘+뱃지) | `engagement.retention.hook_scan` |
| **체크리스트** | 규칙 기반 팩트 체크 (✅/❌) | `evaluation.checklist` |

---

## 6. 분석 3축 요약

| 축 | 핵심 질문 | 주요 Phase |
|----|----------|-----------|
| **제품 축** | "뭘 말하나?" — 소구점 5종 + 설득 전략 5종 | P2, P7 |
| **대본 축** | "어떻게 말하나?" — 블록 10종 + α기법 21종 | P1, P10 |
| **영상 축** | "어떻게 보여주나?" — 스타일, 컷, 리듬, 어텐션 | P3, P4, P5, P6, P8 |
| **인게이지먼트** | "시청자가 어떻게 반응하나?" — 훅, 이탈, 트리거 | P9 |
| **코칭** | "어떻게 개선하나?" — 체크리스트, 구조 평가, 제안 | P13 |

---

## 7. 데이터 활용 로드맵 (미구현)

| 단계 | 내용 | 상태 |
|------|------|------|
| ① 개별 분석 | 1개 영상 심층 분석 + 리포트 | ✅ 현재 |
| ② 비교 분석 | 두 영상 구조적 diff | ❌ 미구현 |
| ③ 그룹 인사이트 | N개 영상 → 카테고리별 패턴 도출 | △ 인사이트 페이지 기초 |
| ④ 온톨로지 | 엔티티 관계 그래프 (Utterance↔Scene↔Appeal↔Element↔Cut↔Product) | ❌ 구상만 |
| ⑤ 성과 연동 | ATMS ROAS 등 + 분석 데이터 → ML 패턴 | ❌ 장기 |
| ⑥ 대본 생성 | 레시피 기반 → 새 대본 자동 생성 | ❌ 미구현 |
