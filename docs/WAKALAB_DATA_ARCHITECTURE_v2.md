# WakaLab 데이터 아키텍처 v2

최종 업데이트: 2026-03-14
설계 원칙: 6개월 안에 안 쓸 테이블은 안 만든다. 과설계보다 확장 가능한 단순함.
참조: WAKAIN_DATA_MAP.md (파이프라인), WAKALAB_TODO_20260313.md (태스크)

## 1. 설계 배경

### 풀어야 할 문제

- 분석 데이터가 recipe_json JSONB 덩어리에 갇혀 있어서 교차 분석 불가
- Meta+Manus가 인스타 내 분석→제작 자동화를 시작 — 크로스 플랫폼이 핵심 방어선
- 데이터가 쌓일수록 가치가 올라가는 구조(데이터 해자)를 만들어야 Series A 스토리
- 같은 구조라도 인플루언서/밈 등 혼동 변수가 성과에 영향 — 통제 필드 필요

### 안 하는 것 (의도적으로)

- 별도 그래프 DB — PostgreSQL time range overlap으로 충분
- competitor_pairs 테이블 — 카테고리 기반 비교로 대체, 레이더 MVP 때 재검토
- 크리에이터/인플루언서 개인 식별 — 프라이버시 이슈 + 정확도 불안정, 채널 규모로 프록시
- 밈/트렌드 사운드 DB — 외부 트렌드 DB 없이 불가, 필드만 예약해두고 추후 연동
- 실시간 집계 — 배치 집계로 충분한 단계

## 2. 전체 구조

```
┌──────────────────────────────────────────────────────┐
│ [집계] content_dna                                    │
│ 영상 1건 = 1행                                        │
│ 구조 DNA + 혼동 변수 + 성과 = 신뢰할 수 있는 분석      │
│ brand/channel/platform 교차 → 다층 벤치마크            │
├──────────────────────────────────────────────────────┤
│ [연결] brands + channels                              │
│ 영상 간 관계 구조                                      │
│ 크로스 플랫폼 비교의 기반 (Meta 방어선)                 │
├──────────────────────────────────────────────────────┤
│ [온톨로지] 5개 정규화 테이블                            │
│ 영상 내부 시간축 구조                                   │
│ 시간 겹침으로 엔티티 간 관계 자동 생성                   │
├──────────────────────────────────────────────────────┤
│ [원본] results.recipe_json                             │
│ 파이프라인 출력 그대로 보존. 절대 수정 안 함.            │
└──────────────────────────────────────────────────────┘
 + [별도] user_activity_logs (사용자 행동)
 + [별도] pipeline_logs (시스템 모니터링)
```

## 3. 원본 레이어

| 테이블 | 내용 |
|--------|------|
| results | recipe_json, stt_json, temporal_json 등 JSONB |
| jobs | 분석 작업 상태 |

원칙: 원본 보존만. 온톨로지/집계는 원본에서 파생. 기준 바뀌면 원본에서 재파생.

## 4. 온톨로지 — 5개 정규화 테이블

### 공통 원칙

- 모든 테이블에 result_id, time_start, time_end 필수
- 인덱스: (result_id, time_start, time_end) 복합 인덱스

### 4-1. analysis_claims (소구) ✅ 존재

| 컬럼 | 비고 |
|------|------|
| id, result_id, claim, claim_type, claim_layer, translation, strategy, category_id | 기존 |
| time_start, time_end | ⚠️ 없으면 추가. claims[].source 타임스탬프에서 매핑 |

claim_type: experience / trust / spec / price / emotion (5종)

### 4-2. analysis_blocks (블록) ✅ 존재

| 컬럼 | 비고 |
|------|------|
| id, result_id, block_type, block_text, block_order, alpha_*, benefit_sub, claim_id, category_id | 기존 |
| time_start, time_end | ⚠️ 없으면 추가. script.blocks[].time_range에서 매핑 |

block_type 10종, alpha 화법 21종.

### 4-3. analysis_scenes (씬) ✅ 존재

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| result_id | FK | |
| scene_order | int | |
| time_start | float | |
| time_end | float | |
| role | text | 문제/공감, 차별점, 장점소개, 후기/반응 등 |
| style | text | sensory, explanation, promotion 등 |
| style_sub | text | |
| visual_forms | JSONB | ["closeup", "wide", "pov"] |
| color_tone | text | warm, neutral, cool |
| dynamics_avg | float | 해당 구간 시각 변화량 평균 |
| category_id | FK | |

소스: recipe_json.scenes[] + visual.scenes[] + P5 dynamics 계산

### 4-4. analysis_utterances (발화) 🆕

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| result_id | FK | |
| utterance_order | int | |
| time_start | float | |
| time_end | float | |
| text | text | |
| block_id | FK → analysis_blocks | nullable |
| category_id | FK | |

소스: stt_json.segments[] + blocks time_range로 block 매핑

### 4-5. analysis_cuts (컷) 🆕

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| result_id | FK | |
| cut_order | int | |
| time_start | float | |
| time_end | float | |
| duration | float | 컷 길이 (초) |
| dynamics_avg | float | 해당 컷 시각 변화량 평균 |
| dynamics_peak | float | 해당 컷 시각 변화량 최대 |
| category_id | FK | |

소스: temporal_json.cut_details[] + P5 dynamics

### 시간축 겹침 쿼리 (온톨로지의 실체)

```sql
CREATE OR REPLACE FUNCTION get_entities_at(
  p_result_id UUID, p_start FLOAT, p_end FLOAT
) RETURNS TABLE (
  entity_type TEXT, entity_id UUID,
  time_start FLOAT, time_end FLOAT, label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'utterance', id, u.time_start, u.time_end, u.text
  FROM analysis_utterances u
  WHERE u.result_id = p_result_id AND u.time_start < p_end AND u.time_end > p_start
  UNION ALL
  SELECT 'scene', id, s.time_start, s.time_end, s.role
  FROM analysis_scenes s
  WHERE s.result_id = p_result_id AND s.time_start < p_end AND s.time_end > p_start
  UNION ALL
  SELECT 'claim', id, c.time_start, c.time_end, c.claim
  FROM analysis_claims c
  WHERE c.result_id = p_result_id AND c.time_start < p_end AND c.time_end > p_start
  UNION ALL
  SELECT 'block', id, b.time_start, b.time_end, b.block_type
  FROM analysis_blocks b
  WHERE b.result_id = p_result_id AND b.time_start < p_end AND b.time_end > p_start
  UNION ALL
  SELECT 'cut', id, ct.time_start, ct.time_end, ct.duration::text
  FROM analysis_cuts ct
  WHERE ct.result_id = p_result_id AND ct.time_start < p_end AND ct.time_end > p_start
  ORDER BY time_start;
END;
$$ LANGUAGE plpgsql;
```

통합 타임라인 뷰(T4)의 백엔드 API가 이 함수 하나.

## 5. 연결 레이어 — brands + channels

### 5-1. brands

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| name | text | 브랜드명 |
| aliases | text[] | 다른 표기 ["Barofarms", "바로팜스"] |
| category_id | FK | 주요 카테고리 |
| organization_id | FK | |
| created_at | timestamp | |

생성: P2에서 brand 자동 추출 → aliases 매칭 시도 → 실패 시 신규 + 사용자 확인.

### 5-2. channels

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| brand_id | FK → brands | nullable |
| platform | text | tiktok / instagram / youtube |
| channel_url | text | 유니크 |
| channel_name | text | |
| follower_count | int | 채널 팔로워 수 (주기 업데이트) |
| is_tracked | boolean | 레이더 트래킹 여부 |
| organization_id | FK | |
| created_at | timestamp | |

기존 radar_channels 역할을 흡수. is_tracked = true이면 레이더 대상.
follower_count는 인플루언서 영향력 프록시로 사용 (개인 식별 없이).

### competitor_pairs를 지금 안 만드는 이유

같은 category의 다른 brand = 사실상 경쟁사.

```sql
WHERE cd.category = '식품' AND cd.brand_id != '우리_id'
```

이것으로 충분. 명시적 경쟁 관계 테이블은 레이더 UI에서 필요해질 때 추가.

## 6. 집계 레이어 — content_dna

영상 1건 = 1행. 모든 분석의 최종 집계.

### 테이블 구조

| 컬럼 | 타입 | 설명 | 소스 |
|------|------|------|------|
| **PK/FK** | | | |
| id | PK | | |
| result_id | FK → results | 유니크 | |
| organization_id | FK | | |
| user_id | FK | | |
| brand_id | FK → brands | nullable | P2 + 매칭 |
| channel_id | FK → channels | nullable | URL 추출 |
| **분류 축** | | | |
| category | text | 식품, 뷰티, 테크 등 | P2 |
| subcategory | text | | P2 |
| platform | text | tiktok, instagram, youtube | P2 / URL |
| duration | float | 영상 길이 (초) | P2 |
| **구조 DNA** | | | |
| block_sequence | text[] | ["hook","benefit","proof","cta"] | analysis_blocks |
| block_count | int | | analysis_blocks COUNT |
| appeal_distribution | JSONB | {experience:0.6, value:0.3} | analysis_claims 집계 |
| style_distribution | JSONB | {sensory:0.7, explanation:0.3} | analysis_scenes 집계 |
| **훅 DNA** | | | |
| hook_type | text | question / shock / curiosity / benefit / story | P9 |
| hook_strength | text | strong / moderate / weak | P9 |
| first_3s_dynamics | float | 첫 3초 시각 변화량 | P5 |
| product_first_appear | float | 제품 첫 등장 (초) | P13 |
| **리듬 DNA** | | | |
| cut_count | int | | analysis_cuts COUNT |
| cut_avg_duration | float | | analysis_cuts AVG |
| cut_rhythm | text | fast / medium / slow | P5 |
| dynamics_avg | float | 전체 시각 변화량 평균 | |
| dynamics_std | float | 변화량 표준편차 | |
| **혼동 변수** | | (성과 분석 신뢰도를 위한 통제 필드) | |
| has_person | boolean | 인물 등장 여부 | P2 human_presence |
| person_role | text | narrator / reviewer / model / none | P2 human_presence.역할 |
| face_visible | boolean | 얼굴 노출 여부 | P2 human_presence.얼굴 |
| voice_type | text | voiceover / direct_speech / none | P2 audio |
| bgm_genre | text | BGM 장르 | P2 audio.장르 |
| has_text_overlay | boolean | 텍스트 오버레이 여부 | P4 has_text |
| channel_followers | int | 채널 팔로워 수 (스냅샷) | channels.follower_count |
| trend_tag | text | 밈/트렌드 태그 (현재 null, 추후 연동) | nullable 예약 |
| **성과** | | (사용자 입력, 모두 nullable) | |
| views | bigint | 조회수 | 사용자 입력 |
| likes | int | 좋아요 | 사용자 입력 |
| comments_count | int | 댓글 수 | 사용자 입력 |
| roas | float | | 사용자 입력 |
| ctr | float | | 사용자 입력 |
| performance_source | text | user_input / api / none | |
| performance_updated_at | timestamp | | |
| **메타** | | | |
| created_at | timestamp | | |

### 혼동 변수가 왜 필요한가

같은 "hook→benefit→cta" 구조라도:
- 인플루언서(팔로워 50만)가 나오면 ROAS 3.0
- 제품만 나오면 ROAS 1.2

혼동 변수 없이 "이 구조가 ROAS 3.0이다"고 결론 내면 거짓.
통제 필드가 있으면:

```sql
-- 구조 효과만 분리: 인물 없는 영상에서 구조별 ROAS
SELECT hook_type, block_sequence, AVG(roas) as pure_structure_roas
FROM content_dna
WHERE roas IS NOT NULL AND has_person = false
GROUP BY hook_type, block_sequence
HAVING COUNT(*) >= 5;

-- 인플루언서 효과 분리: 같은 구조에서 인물 유무 비교
SELECT block_sequence,
  AVG(roas) FILTER (WHERE has_person = false) as no_person,
  AVG(roas) FILTER (WHERE has_person = true) as with_person,
  AVG(roas) FILTER (WHERE channel_followers > 100000) as big_channel
FROM content_dna
WHERE roas IS NOT NULL AND category = '식품'
GROUP BY block_sequence;

-- 채널 규모별 벤치마크 (인플루언서 효과 정량화)
SELECT
  CASE
    WHEN channel_followers < 10000 THEN '소형'
    WHEN channel_followers < 100000 THEN '중형'
    ELSE '대형'
  END as channel_tier,
  AVG(dynamics_avg), AVG(roas)
FROM content_dna
WHERE roas IS NOT NULL
GROUP BY channel_tier;
```

### 다층 벤치마크 구조

```
벤치마크 드릴다운:
├── 전체 평균
├── 카테고리별 (WHERE category = '식품')
├── 카테고리 + 플랫폼 (+ AND platform = 'tiktok')
├── 카테고리 + 플랫폼 + 인물유무 (+ AND has_person = false)
├── 브랜드별 (WHERE brand_id = X)
├── 브랜드 + 플랫폼 (+ AND platform = 'tiktok')
└── 채널별 (WHERE channel_id = X)
```

### 핵심 쿼리

```sql
-- 1. 크로스 플랫폼 비교 (Meta 방어선)
SELECT platform,
  COUNT(*) as videos,
  AVG(dynamics_avg) as avg_dynamics,
  mode() WITHIN GROUP (ORDER BY hook_type) as common_hook,
  AVG((appeal_distribution->>'experience')::float) as experience_ratio
FROM content_dna
WHERE category = '식품'
GROUP BY platform;

-- 2. 카테고리 벤치마크 자동 생성
SELECT category, platform,
  COUNT(*) as sample_size,
  AVG(dynamics_avg) as dynamics_benchmark,
  AVG(first_3s_dynamics) as hook_benchmark,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY dynamics_avg) as top10_dynamics
FROM content_dna
GROUP BY category, platform
HAVING COUNT(*) >= 30;

-- 3. 월간 트렌드
SELECT date_trunc('month', created_at) as month,
  platform, hook_type, COUNT(*)
FROM content_dna
WHERE category = '식품'
GROUP BY month, platform, hook_type
ORDER BY month DESC;

-- 4. 성과 + 혼동 변수 통제: 진짜 잘 되는 구조 찾기
SELECT hook_type, block_sequence,
  AVG(roas) as avg_roas,
  AVG(roas) FILTER (WHERE has_person = false) as roas_no_person,
  AVG(roas) FILTER (WHERE channel_followers < 50000) as roas_small_channel,
  COUNT(*)
FROM content_dna
WHERE roas IS NOT NULL AND category = '식품'
GROUP BY hook_type, block_sequence
HAVING COUNT(*) >= 5
ORDER BY roas_no_person DESC;
```

## 7. 사용자 행동 로그 — user_activity_logs

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| user_id | FK | |
| organization_id | FK | |
| action | text | |
| result_id | FK | nullable |
| metadata | JSONB | |
| created_at | timestamp | |

### 추적 액션

Phase 1 (베타 즉시):
- analyze_complete — {category, platform, duration_sec}
- section_expand — {section_name}
- coaching_click — {improvement_type}

Phase 2 (기능 추가 시):
- compare_start, guide_generate, radar_add_channel, performance_input

## 8. 파이프라인 모니터링 — pipeline_logs

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| result_id | FK | |
| phase_name | text | P1_STT, P2_SCAN 등 |
| status | text | success / fail / retry |
| started_at | timestamp | |
| finished_at | timestamp | |
| duration_ms | int | |
| error_message | text | nullable |
| model_used | text | |
| tokens_in | int | |
| tokens_out | int | |
| cost_usd | float | |

## 9. 데이터 플로우

```
영상 URL 입력
  │
  ├─ URL에서 channel 추출 → channels UPSERT → brand 매칭 시도
  │
  ▼
파이프라인 (P1~P13)
  │
  ├──▶ results.recipe_json (원본 보존)
  ├──▶ pipeline_logs (Phase별 기록)
  │
  ├──▶ 온톨로지 5개 테이블 (자동 INSERT)
  │   ├── analysis_utterances
  │   ├── analysis_scenes
  │   ├── analysis_claims (time 확인)
  │   ├── analysis_blocks (time 확인)
  │   └── analysis_cuts
  │
  └──▶ content_dna (온톨로지에서 집계 + brand/channel 연결 + 혼동 변수 채움)

사용자 액션 시: → user_activity_logs
성과 입력 시: → content_dna UPDATE (views, roas)
레이더 등록 시: → channels UPSERT (is_tracked = true) + brands 매핑
```

## 10. 마이그레이션 순서

### Phase 1 — 온톨로지 (즉시)

- analysis_claims/blocks에 time_start/time_end 확인 → 없으면 추가
- 기존 데이터 time 백필
- analysis_scenes, analysis_utterances, analysis_cuts 생성
- 기존 results에서 신규 테이블 백필
- 복합 인덱스 생성
- get_entities_at() 함수 생성
- 파이프라인 P12 후 자동 INSERT 로직

### Phase 2 — 연결 + 집계 (베타 전후)

- brands, channels 테이블 생성 (radar_channels 통합)
- content_dna 테이블 생성 (혼동 변수 필드 포함)
- P2 결과에서 brand 자동 매칭 로직
- URL에서 channel 추출 로직
- 기존 데이터 content_dna 백필
- 파이프라인 완료 시 자동 생성

### Phase 3 — 행동 추적 (베타 오픈 시)

- user_activity_logs, pipeline_logs 생성
- 프론트 이벤트 트래킹 (3개 핵심 액션)

### Phase 4 — 성과 연동 (안정화 후)

- 성과 입력 UI ("조회수/ROAS 입력하면 벤치마크 제공")
- 입력 인센티브 설계
- trend_tag 연동 검토 (밈/트렌드 사운드 DB)

## 11. Meta 방어선 매핑

| Meta+Manus | Meta가 못 하는 것 | WakaLab 데이터 |
|------------|-------------------|----------------|
| 릴스 성과 분석 | 틱톡 vs 릴스 비교 | content_dna.platform + channels |
| 단일 영상 개선 | 카테고리 벤치마크 | content_dna 집계 (30건+) |
| 인스타 내 자동화 | 경쟁사 트래킹 | brands + channels + 레이더 |
| SMB 범용 분석 | 소구5종/블록10종/alpha21종 | 온톨로지 5개 테이블 |
| 자사 데이터만 | 크로스 플랫폼 DNA | content_dna × platform |
| 인플루언서 효과 혼재 | 구조 vs 인플루언서 분리 | 혼동 변수 통제 필드 |

## 12. 데이터 해자 성장

| 규모 | 가능한 것 | 수익 모델 |
|------|----------|----------|
| 1,000건 | 개별 분석 + 전체 평균 벤치마크 | 분석 건당 과금 |
| 5,000건 | 카테고리×플랫폼 벤치마크 | 리포트 구독 |
| 10,000건 | "이기는 레시피" 추천 (통계 유의) | 레시피 건당 과금 |
| 50,000건 | 월간 트렌드 + 인플루언서 효과 정량화 | 프리미엄 구독 |
| 100,000건 | 업계 표준 ("와카랩 기준 상위 20%") | API 라이선스 |

도달 예상: 1,000건 (베타 6개월) → 5,000건 (레이더 + 에이전시, 1년) → 10,000건+ (시리즈 A 이후)

## 13. 테이블 총정리

| 테이블 | 상태 | Phase | 영상당 행수 |
|--------|------|-------|------------|
| results | ✅ | - | 1 |
| analysis_claims | ✅ (time 확인) | 1 | 5~15 |
| analysis_blocks | ✅ (time 확인) | 1 | 5~10 |
| analysis_scenes | ✅ | 1 | 3~8 |
| analysis_utterances | 🆕 | 1 | 10~30 |
| analysis_cuts | 🆕 | 1 | 5~20 |
| brands | 🆕 | 2 | (브랜드 수) |
| channels | 🆕 | 2 | (채널 수) |
| content_dna | 🆕 | 2 | 1 |
| user_activity_logs | 🆕 | 3 | 세션 5~20 |
| pipeline_logs | ✅ (확장 필요) | 3 | 13 (Phase당) |

Supabase 용량 (10,000건): 온톨로지 ~200MB + content_dna ~10MB + logs ~100MB ≈ 300~400MB
→ Supabase Pro ($25/월) 충분.

---

이 문서가 WakaLab 데이터 아키텍처의 최종본입니다.
WAKAIN_DATA_MAP.md(파이프라인), WAKALAB_TODO_20260313.md(태스크)와 함께 관리됩니다.
