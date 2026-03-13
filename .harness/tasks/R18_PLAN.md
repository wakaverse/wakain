# R18 Plan — 베타 품질 다듬기

> 작성: 2026-03-13 23:30 KST
> 라운드: R18 (T1 → T2 → T3 → T4)

---

## T1. 시각 변화량 이름 변경 + 기준선

### 변경 범위 (28곳, 11파일)

**백엔드 (Python) — 6파일:**
| 파일 | 변경 내용 |
|------|----------|
| `schemas/pipeline.py` | `AttentionPoint` → `DynamicsPoint`, `AttentionCurve` → `DynamicsCurve` (alias 유지) |
| `schemas/recipe.py` | `RecipeAttentionPoint` → `RecipeDynamicsPoint`, `RecipeAttentionCurve` → `RecipeDynamicsCurve` (alias 유지) |
| `pipeline/p05_temporal.py` | `_compute_attention_curve` → `_compute_dynamics_curve`, 변수명 변경 |
| `pipeline/p12_build.py` | import + 필드명 변경 |
| `pipeline/p13_evaluate.py` | "어텐션" → "시각 변화량" (체크리스트 텍스트) |
| `schemas/enums.py` | `AttentionArc` 그대로 유지 (구조적 의미) |

**프론트엔드 — 5파일:**
| 파일 | 변경 내용 |
|------|----------|
| `types/recipe.ts` | 타입명 변경 + 필드 alias |
| `AttentionCurveSection.tsx` → `DynamicsCurveSection.tsx` | 컴포넌트명 + "어텐션" → "시각 변화량" |
| `TimelineCard.tsx` | "에너지" → "시각 변화량" |
| `StructureSection.tsx` | "어텐션" → "시각 변화량" |
| `SummarySection.tsx` | 라벨 변경 |
| `HookAnalysisCard.tsx` | "처음 3초 에너지" → "처음 3초 시각 변화량" |

**하위호환 전략:**
- recipe_json 필드명 `attention_curve`는 유지 (DB에 이미 저장된 데이터)
- Python: class alias로 양쪽 이름 지원 (`DynamicsCurve = AttentionCurve`)
- 프론트: 타입에 alias, 표시 라벨만 변경

**기준선 추가:**
1. `GET /api/stats/dynamics-avg` 엔드포인트 추가 — 전체 분석 영상의 dynamics avg 평균값 반환
2. 프론트 그래프에 점선 평균선 1개 추가
3. 등급 뱃지: score ≤ 30 "낮음" / 31~60 "보통" / 61+ "높음"

### 완료 기준
- [ ] 프론트에서 "어텐션" "에너지" 텍스트 0건
- [ ] 기준선 점선이 그래프에 표시
- [ ] 등급 뱃지 (낮음/보통/높음) 표시
- [ ] 기존 분석 결과 정상 표시 (하위호환)
- [ ] `npm run build` 성공

---

## T2. 훅 스코어링 투명화

### 변경 내용

**프론트 (2파일):**
| 파일 | 변경 |
|------|------|
| `SummarySection.tsx` | HookBadge 옆에 `hook_reason` 1줄 표시 |
| `EngagementSection.tsx` | hook_reason 표시 위치를 뱃지 바로 옆으로 이동 (현재 아래에 별도 표시) |

**백엔드 변경 없음** — hook_reason 데이터 이미 존재

### 완료 기준
- [ ] 요약 카드에서 "강력" 뱃지 옆에 근거 1줄 표시
- [ ] 인게이지먼트 섹션에서도 뱃지 + 근거 인라인
- [ ] `npm run build` 성공

---

## T3. 체크리스트 제거 + 섹션 재배치 + 접기/펼치기

### 3-1. 체크리스트 비노출

**프론트 (1파일):**
- `EvaluationSection.tsx` — 체크리스트 렌더링 블록을 `{false && ...}`로 비활성화
- P13 백엔드는 그대로 유지 (데이터 계속 생성)

### 3-2. 섹션 순서 재배치

**`ReportPage.tsx` 현재 순서:**
1. VideoSummaryCard
2. HookAnalysisCard
3. PositioningCard
4. ProductClaimsCard
5. PersuasionFlowCard
6. TimelineCard
7. CoachingCard
8. SceneAnalysisCard

**변경 후 순서:**
1. VideoSummaryCard — "이 영상이 뭔데?"
2. PositioningCard — "어떤 전략으로?"
3. HookAnalysisCard — "첫인상은?"
4. PersuasionFlowCard + TimelineCard + SceneAnalysisCard → (T4에서 통합)
5. ProductClaimsCard — "뭘 말하고 있는데?"
6. CoachingCard — "뭘 고치라는데?"

### 3-3. 접기/펼치기

- 공통 `CollapsibleSection` 컴포넌트 생성
- props: `title`, `summary` (접힌 상태에서 보이는 1줄), `defaultOpen`
- VideoSummaryCard만 `defaultOpen={true}`, 나머지 `defaultOpen={false}`
- 코칭 핵심 1줄을 VideoSummaryCard에도 추가 (`evaluation.summary`)

### 완료 기준
- [ ] 체크리스트 화면에서 비노출
- [ ] 섹션 순서 변경 완료
- [ ] CollapsibleSection 동작 (접기/펼치기 애니메이션)
- [ ] 각 섹션 헤더에 요약 1줄 표시
- [ ] VideoSummaryCard에 코칭 1줄 포함
- [ ] `npm run build` 성공

---

## T4. 통합 타임라인 뷰

### 구조

기존 3개 카드를 1개 통합 타임라인으로 병합:
- PersuasionFlowCard (설득 흐름 컬러바) → 1층
- TimelineCard / AttentionCurveSection (시각 변화량 곡선) → 2층
- SceneAnalysisCard (씬 카드 목록) → 클릭 상세

### 컴포넌트 설계

```
UnifiedTimeline.tsx
├── TimeAxis (가로축 — 시간)
├── Layer1_PersuasionBar (설득 흐름 컬러바)
├── Layer2_DynamicsCurve (시각 변화량 곡선 + 평균선 + risk_zone 배경)
├── Layer3_ScriptBlocks (블록 텍스트 요약)
├── Layer4_AppealTags (소구 태그)
└── TimelineDetail (클릭 시 펼침 — 썸네일, shot_type, visual_forms, 코칭)
```

**데이터 소스:**
- 1층: `script.blocks[].block_type` + `time_range`
- 2층: `visual.rhythm.dynamics_curve` (T1 이후) + `engagement.dropoff.risk_zones`
- 3층: `script.blocks[].text`
- 4층: `product.claims` (시간 매핑)

**인터랙션:**
- hover: 해당 시점의 블록 타입 + 텍스트 툴팁
- click: 상세 패널 (씬 썸네일, shot_type, visual_forms, 코칭 제안)
- risk_zone: 반투명 빨간 배경

### 기존 컴포넌트 처리
- `PersuasionFlowCard.tsx` — 삭제 (통합)
- `TimelineCard.tsx` — 삭제 (통합)
- `SceneAnalysisCard.tsx` — 삭제 (통합)
- `AttentionCurveSection.tsx` → `DynamicsCurveSection.tsx` (T1) → 통합에 흡수

### 완료 기준
- [ ] 4층 레이어 통합 타임라인 렌더링
- [ ] hover 툴팁 동작
- [ ] 구간 클릭 시 상세 패널 펼침
- [ ] risk_zone 배경 표시
- [ ] 기존 3개 카드 제거
- [ ] 모바일 반응형 (세로 스크롤)
- [ ] `npm run build` 성공

---

## 실행 순서 & 예상 소요

| 순서 | 태스크 | 예상 | 의존성 |
|------|--------|------|--------|
| 1 | T1 시각 변화량 | 1일 | 없음 |
| 2 | T2 훅 투명화 | 반나절 | 없음 (T1과 병렬 가능) |
| 3 | T3 섹션 재배치 | 1일 | T1 완료 후 (라벨 통일) |
| 4 | T4 통합 타임라인 | 2~3일 | T1 + T3 완료 후 |

**총 예상: 4~5일**

---

*승인 후 T1부터 포지에게 위임합니다.*
