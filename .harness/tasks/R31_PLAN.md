# R31: 소구 그룹핑 + 리포트 품질 개선

## Phase A — 즉시 수정 (프론트)
- A1: 수치카드 ⓘ 툴팁 5개 (훅/변화량/소구/블록/노출률)
- A2: 툴팁 바깥 클릭 시 닫기
- A3: 코칭 탭 영어 필드명 → 한국어 fallback 번역

## Phase B — 백엔드 (소구 그룹핑)
- B1: P7.5 소구 그룹핑 서비스 (Gemini 1콜)
- B2: worker.py에 P7.5 삽입
- B3: RecipeJSON 확장 (claim_groups, purchase_reasons, core_selling_point)
- B4: TypeScript 타입 추가

## Phase C — 프론트 연동
- C1: 요약탭 "사야 하는 이유" → 그룹 core_message 기반
- C2: 구조분석 소구 차트 → 그룹별 언급 횟수
- C3: P13 프롬프트 한국어 강화

## 완료 기준
- [ ] 수치카드 5개 모두 ⓘ 툴팁 표시
- [ ] 툴팁 바깥 클릭 시 닫힘
- [ ] 코칭 탭에서 영어 필드명 안 보임
- [ ] 새 분석 시 claim_groups 생성됨
- [ ] 요약탭 "사야 하는 이유"가 그룹 core_message 사용
- [ ] 소구 차트가 그룹 기반
