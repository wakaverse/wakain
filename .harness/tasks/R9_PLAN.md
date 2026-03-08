# R9: 프론트엔드 V2 UI 전면 교체

## 목표
기존 V1 메뉴/네비게이션/라우팅을 V2 구조로 통일

## 태스크 분할

### R9-01: AppShell 메뉴 교체
- V1 메뉴: radar, hack(분석), script(CS), expand(CS), library, compare(CS), insight
- V2 메뉴: 분석(업로드+목록), 라이브러리, 레이더, 인사이트, 가이드
- "Coming Soon" 항목 제거, 실제 동작하는 것만 남기기
- 파일: `src/components/App/AppShell.tsx`

### R9-02: 라우팅 정리
- `/app/hack` → `/app/analyze` (분석 페이지)
- `/app/results/:id` → V2 ReportPage (이미 수정됨)
- `/app/radar`, `/app/library`, `/app/insight` 유지
- Coming Soon 라우트 제거 (script, expand, compare)
- `/app/guide` 추가 (GuidePage)
- 파일: `src/App.tsx`

### R9-03: AnalyzePage V2 스타일 개선
- 업로드 UI 유지 (동작함)
- 잡 목록 카드 V2 스타일로 개선
- 분석 완료 시 V2 리포트로 연결 확인
- 파일: `src/pages/AnalyzePage.tsx`

### R9-04: V2 리포트 ↔ 기존 V1 결과 호환
- V1 recipe 감지 → 폴백 메시지 or V1 리포트 렌더
- V2 recipe → V2 리포트 정상 렌더
- schema_version 체크로 분기
- 파일: `src/pages/ReportPage.tsx`

### R9-05: 빌드 + 배포 + E2E 테스트
- npm run build 성공
- wrangler pages deploy --branch main
- 새 영상 업로드 → V2 분석 → V2 리포트 확인

## 완료 기준
- 사이드바 메뉴가 V2 구조
- 새 분석 → V2 리포트 정상 표시
- 기존 V1 결과 클릭 시 깨지지 않음
- 빌드 성공 + 배포 완료
