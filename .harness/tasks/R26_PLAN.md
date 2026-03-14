# R26 Plan — 분석 리포트 개선

> 2026-03-14
> 참조: docs/WAKALAB_REPORT_IMPROVEMENT.md

---

## T1: 용어 변경 (프론트)
- "에너지" → "시각 변화량"
- "어텐션" → "시각 변화량"
- "첫 3초 에너지" → "첫 3초 시각 변화량"
- 프론트 표시 텍스트만 변경 (코드 변수명은 유지)
- 대상: components/Report/ 전체

### 완료 기준
- [x] 프론트에서 "에너지", "어텐션" 텍스트 0건

---

## T2: 4탭 구조 전환 (프론트)
- ReportPage.tsx → 탭 라우터 + 데이터 로딩만
- 새 파일:
  - components/Report/tabs/TabSummary.tsx — 요약 (VideoSummaryCard + 핵심 코칭 1줄 + 메타 정보)
  - components/Report/tabs/TabTimeline.tsx — 타임라인 (UnifiedTimeline)
  - components/Report/tabs/TabCoaching.tsx — 코칭 (CoachingCard + 제작가이드 버튼)
  - components/Report/tabs/TabStructure.tsx — 구조 분석 (PositioningCard + HookAnalysisCard + ProductClaimsCard)
- 기존 CollapsibleSection 세로 나열 제거
- 체크리스트 섹션 프론트 비노출

### 탭 매핑
| 기존 섹션 | 이동할 탭 |
|----------|---------|
| 영상 요약 | 탭1: 요약 |
| 핵심 코칭 (요약 내) | 탭1: 요약 |
| 통합 타임라인 | 탭2: 타임라인 |
| 코칭 전체 | 탭3: 코칭 |
| 제작가이드 버튼 | 탭3: 코칭 하단 |
| 콘텐츠 포지셔닝 | 탭4: 구조 분석 |
| 훅 분석 | 탭4: 구조 분석 |
| 제품 소구 분석 | 탭4: 구조 분석 |

### 탭 클릭 로그
- user_activity_logs 테이블 (없으면 생성)
- { action: "tab_click", metadata: { tab_name: "coaching" }, result_id: "xxx" }

### 완료 기준
- [x] 4개 탭 전환 동작
- [x] 기존 모든 정보가 적절한 탭에 배치
- [x] 탭 클릭 로그 기록

---

## T3: 소구 분석 개선 (TabStructure 내)
- 상단: 소구 비율 가로 막대 차트 + 한 줄 해석
- 하단: 유형별 그룹핑 + 접기/펼치기
- 데이터: product.claims → claim_type별 집계

### 완료 기준
- [x] 비율 차트 렌더링
- [x] 한 줄 해석 표시
- [x] 그룹별 접기/펼치기

---

## T4: 타임라인 개선 (TabTimeline 내)
- 씬별 대표 썸네일 행 추가 (results.thumbnails_json 사용)
- 스크립트 텍스트 → 블록 유형명만 표시 ("가치", "신뢰", "경험")
- 클릭 시 하단 상세 패널 (스크립트 + 소구 + 썸네일)

### 완료 기준
- [x] 썸네일 행 표시
- [x] 블록 유형 라벨
- [x] 상세 패널

---

## T5: P13 코칭 프롬프트 개선 (백엔드)
- core/pipeline/p13_evaluate.py 프롬프트 수정
- 금지: 일반론, "~하면 좋습니다"
- 필수: 구간 시간 + 정량 수치 + 비교 기준
- 잘된 점 3개 이내, 개선 포인트 3개 이내
- 텍스트 양 현재 대비 절반 이하

### 완료 기준
- [x] 프롬프트에 코칭 작성 규칙 6개 추가
- [x] 재분석 시 데이터 기반 코칭 출력

---

## 실행 순서

| 순서 | 태스크 | 예상 소요 |
|------|--------|----------|
| 1 | T1: 용어 변경 | 5분 |
| 2 | T2: 4탭 구조 | 40분 |
| 3 | T3: 소구 분석 | 15분 |
| 4 | T4: 타임라인 | 20분 |
| 5 | T5: P13 프롬프트 | 10분 |

**총 예상: 포지 기준 ~1.5시간**
