# R27 Plan — 랜딩 페이지 개편

> 2026-03-14
> 참조: docs/WAKALAB_LANDING_SPEC.md

---

## 스크린샷 문제

랜딩에 실제 분석 결과 스크린샷이 필요하지만, 지금은 캡처 없이 진행.
→ 스크린샷 자리에 placeholder 이미지 배치, 나중에 교체.

---

## T1: 네비게이션 변경
- 중앙 메뉴: Spike/Analyze/Recipe/Radar → `기능` | `요금제` | `문의하기`
- 우측: `로그인` | `무료로 시작하기`
- KR/EN 토글 유지

## T2: 히어로 섹션 개편
- 헤드라인: "경쟁사 숏폼, 왜 잘 되는지 알려드립니다"
- 서브: "영상의 구조를 컷 단위로 해부하고, 내 영상과 비교해서, 개선 방향까지 코칭해드립니다"
- CTA: "지금 시작하기" 버튼 → URL 입력창 (플레이스홀더: "분석할 영상 URL을 붙여넣어 보세요")
- 하단 텍스트: "틱톡, 인스타 릴스, 유튜브 숏츠 지원 · 회원가입 없이 체험"
- URL 입력 → 유효성 검사 → 세션 저장 → 가입/로그인 → 즉시 분석
- 우측: 분석 결과 스크린샷 (placeholder)

## T3: 문제 공감 섹션 (신규)
- 타이틀: "이런 고민, 있지 않으세요?"
- 3개 카드 (경쟁사 조회수 / 근거 없는 제안 / 참고 방법 모름)
- 모바일: 세로 스택

## T4: 작동 방식 섹션 변경
- Spike/Hack/Script/Expand → 분석/비교/코칭/제작 (01~04)
- 한국어 명칭으로 통일
- 각 단계 설명 변경 (스펙 참조)
- 스크린샷 자리: placeholder

## T5: 실제 분석 데모 섹션 (신규)
- 방식 A (스크린샷 슬라이드) — 캐러셀 4~5장
- 타이틀: "LIVE DEMO — 실제 분석 결과를 확인해보세요"
- placeholder 이미지 배치

## T6: 주요 기능 섹션 변경
- 6개 → 5개 (소재확장 제거)
- 분석 / 비교 / 레이더 / 제작가이드 / 인사이트(COMING SOON)
- 설명을 기능 나열 → 가치 전달로 변경

## T7: 사회적 증거 섹션 (신규)
- 카운터: "지금까지 분석된 영상 [142]건" (results COUNT)
- 인용: 이종권 CBO 피드백 1개

## T8: 요금제 섹션 (신규)
- Free / Pro 카드 나란히
- WAKALAB_BETA_STRATEGY.md 섹션 7 기준
- Pro "관심 등록하기" → user_activity_logs에 pro_interest_click 기록
- 클릭 후: "감사합니다! 정식 출시 시 우선 안내해드리겠습니다"

## T9: 하단 CTA 변경
- URL 입력창 반복 (히어로와 동일)
- "지금 바로 경쟁사 영상을 분석해보세요"

## T10: SEO 메타 + 푸터
- title, description, og:title, og:description 변경
- 푸터: 크랩스 정보 + 이용약관/개인정보 링크

## T11: 이벤트 추적
- landing_url_input, landing_cta_click, landing_demo_view, pro_interest_click
- user_activity_logs에 기록

---

## 실행 순서
T1~T11 순차 진행. 총 예상: 포지 기준 ~1.5시간

## 완료 후
- git commit -m 'R27: landing page redesign'
- 변경 파일 목록 보고
