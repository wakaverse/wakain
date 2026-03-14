# R25 Plan — 비교 분석 (v2)

> 2026-03-14
> 참조: docs/WAKALAB_COMPARE_SPEC.md

---

## T1: comparison_reports 테이블 + 마이그레이션
- comparison_reports (id, user_id, scenario, base_result_id, result_ids, claim_matching, coaching, created_at)
- RLS: 본인만 읽기/쓰기, service_role 풀

## T2: 비교 API (백엔드)
- POST /compare — { result_ids: [...], scenario: "A"|"B", base_result_id? }
- content_dna N행 조회 → 구조 비교 데이터 (파트1)
- Gemini 콜 1: 소구점 매칭 (파트2)
- Gemini 콜 2: AI 코칭 (파트3, 시나리오별 프롬프트)
- comparison_reports에 저장
- quota 체크: compare feature
- 분석 회수와 비교 회수 분리 차감

## T3: 비교 입력 UI (프론트)
- /app/compare 경로
- 영상 추가: URL 입력 또는 라이브러리 모달
- 영상 카드 상태 (분석완료/분석중/분석필요/실패)
- 시나리오 선택: "개선하고 싶은 영상" 라디오 (1개 or 없음)
- 미분석 영상 자동 분석 + 회수 안내
- 최대 3개 제한
- 사이드바 메뉴에 "비교" 추가

## T4: 비교 리포트 (프론트)
- 파트1: 전체 구조 비교 테이블 (content_dna 나란히, ★ 하이라이트)
- 파트2: 소구점별 표현 전략 카드 (매칭 그룹별, 재생 버튼)
- 파트3: AI 코칭 (시나리오 A: 개선 / B: 패턴)
- 하단: "제작가이드로 이동" 버튼

## T5: 진입 경로 연결
- 라이브러리: 체크박스 + "비교하기" 버튼 → /app/compare?ids=...
- 리포트: "이 영상과 비교하기" 버튼 → /app/compare?base=...

## T6: 이벤트 로깅
- compare_add_video, compare_scenario_select, compare_report_generate, compare_claim_group_expand, compare_to_guide
- user_activity_logs 기록

---

## 베타 심플 버전
- 시나리오 A + B만 (C는 추후)
- 최대 3개 영상
- 소구점 매칭은 recipe_json의 claims에서 추출 (analysis_claims 테이블 없으면 폴백)

## 실행 순서
T1 → T2 → T3 → T4 → T5 → T6

## 예상 소요: 포지 기준 ~1.5시간

## 완료 후
- git add -A && git commit -m 'R25: compare analysis - claim matching, AI coaching, compare UI'
- 변경 파일 목록 보고
