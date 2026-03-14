# R25 Plan — A/B 비교 분석 + 비교 코칭

> 2026-03-14
> 참조: docs/WAKALAB_BETA_STRATEGY.md (섹션 6-2)

---

## T1: 비교 API

- POST /compare — { job_ids: [id1, id2, ...id_n] }
- content_dna N행 조회 → 차이 계산
- quota 체크: compare feature
- 응답:
  - structure_diff: 블록 순서 비교
  - metrics_diff: 훅 강도, 리듬, 시각 변화량, 소구 분포
  - per_item: 각 영상의 핵심 지표

## T2: 비교 기반 AI 코칭 (Gemini 1콜)

- content_dna + recipe_json 요약 → Gemini
- 프롬프트: "A 영상이 B보다 나은/부족한 점, 구체적 개선 방안"
- P13 코칭 규칙 동일 적용 (일반론 금지, 데이터 기반)

## T3: 비교 페이지 (프론트)

- /app/compare 경로
- 라이브러리에서 N개 선택 UI
- 비교 뷰:
  - A) 구조 차이 — 블록 순서 나란히
  - B) 수치 비교 — 레이더 차트 or 테이블
  - C) AI 코칭 — 비교 기반 개선 제안
- 사이드바 메뉴에 "비교" 추가

## T4: 리포트에서 비교 연결

- 리포트 페이지에 "비교하기" 버튼
- 클릭 → 현재 영상 선택된 상태로 비교 페이지 이동
- 나머지 영상 선택 → 비교 실행

## T5: 이벤트 로깅

- compare_start → 비교 실행 시
- compare_complete → 비교 결과 표시 시
- user_activity_logs 기록

---

## 실행 순서

| 순서 | 태스크 | 예상 소요 |
|------|--------|----------|
| 1 | T1: 비교 API | 20분 |
| 2 | T2: AI 코칭 | 15분 |
| 3 | T3: 비교 페이지 | 30분 |
| 4 | T4: 리포트 연결 | 10분 |
| 5 | T5: 이벤트 로깅 | 5분 |

**총 예상: 포지 기준 ~1.5시간**
