# R27-B Plan — 랜딩 변경 + 온보딩 + 문의하기

> 2026-03-14
> 참조: docs/WAKALAB_LANDING_CHANGES.md

---

## T1: 히어로 헤드라인 로테이션
- 3개 헤드라인 3초 간격 fade+slide-up 전환
- 우측 이미지도 동기 전환 (placeholder)
- 하단 인디케이터 점 3개 (클릭 가능)
- 서브카피 + CTA 버튼은 고정

## T2: URL 입력창 → 베타 CTA 버튼
- 히어로 + 하단 CTA에서 URL 입력창 제거
- "베타 무료 시작하기 →" 버튼으로 교체 → /login 이동
- UrlInput 컴포넌트 제거 또는 미사용 처리
- 하단 텍스트: "현재 베타 서비스 중 · 무료로 모든 기능을 체험해보세요"

## T3: BETA 뱃지
- 로고 옆 또는 히어로 뱃지에 "BETA" 추가
- 작은 라운드 뱃지

## T4: 온보딩 설문 + user_profiles
- user_profiles 테이블 (마이그레이션)
  - user_id, name, job_role, company_type, categories(text[]), acquisition_channel, onboarding_completed
- 가입 후 온보딩 설문 페이지 (/onboarding)
  - 4개 질문: 직무, 회사유형, 카테고리(복수), 유입경로
  - "건너뛰기" 버튼 항상 표시
  - 완료/건너뛰기 → /app/analyze로 이동
- RLS: 본인 행만 읽기/쓰기

## T5: 요금제 카드 베타 표시
- Free: "베타 기간 동안 무료로 시작하세요"
- Pro: "베타 특별가 준비 중", 버튼 "출시 알림 받기" → pro_interest_click

## T6: Enterprise/API 섹션
- 요금제 아래 신규 섹션
- 2카드: Enterprise + API
- 각 버튼 → /contact?type=enterprise 또는 /contact?type=api

## T7: 문의하기 페이지 전면 교체
- /contact 경로
- 좌: 안내 정보 (이메일, 응답시간)
- 우: 문의 폼 (관심서비스, 회사명, 이름, 이메일, 직함, 연락처, 내용)
- contact_inquiries 테이블 (마이그레이션)
- ?type= 쿼리로 관심서비스 프리셋
- 제출 → DB 저장 + 확인 메시지
- 어드민 사이드바에 🔴 새 문의 뱃지 + 문의 관리 페이지 추가

---

## 마이그레이션
1. user_profiles 테이블 + RLS
2. contact_inquiries 테이블 + RLS (public insert, admin read)

## 실행 순서
T2 → T3 → T5 → T1 → T6 → T7 → T4

## 완료 후
- git add -A && git commit -m 'R27-B: hero rotation, beta CTA, onboarding, contact page, enterprise section'
- 변경 파일 목록 보고
