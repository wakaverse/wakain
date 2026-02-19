# WakaIn TODO — 2026-02-20

## 🔴 긴급 (내일 바로)

### 1. R2 presigned URL 업로드
- [ ] Cloudflare R2 활성화 (대시보드)
- [ ] R2 API 토큰 생성 (Access Key + Secret)
- [ ] R2 버킷 `wakain-videos` 생성
- [ ] R2 CORS 설정 (wakain.pages.dev, wakain.site 허용)
- [ ] Cloud Run 환경변수에 R2 키 추가
- [ ] 재배포 + 테스트 (89MB 파일)
- 코드는 포지가 작업 완료함 (plaid-shore 세션)

### 2. 알고리즘 고도화 — Scene Merger
- [x] 타임스탬프 정규화 감지 + 자동 보정 (c347cc9)
- [x] Scene role fallback (hook/body/cta)
- [ ] **여전히 빈틈**: Phase 4 Gemini가 타임스탬프를 비율로 줄 때만 감지됨. 다른 패턴의 오류 가능성 있음
- [ ] Scene description이 동일한 문제 — Gemini scene_roles 프롬프트 개선 필요

### 3. 알고리즘 고도화 — 텍스트 오버레이 영상 지원
- [ ] STT 없는 영상 (BGM + 텍스트만) — 현재 소구 분석은 됨, 씬별 매핑이 안 됨
- [ ] 프레임별 OCR 텍스트 → 씬 매핑 로직 필요
- [ ] 리테일/이커머스 숏폼의 상당수가 이 패턴 — 반드시 해결

## 🟡 중요 (이번 주)

### 4. Summary 빌더 완성
- [x] strengths/weaknesses 필드 매핑 수정
- [ ] overall_score 계산 로직 (retention + effectiveness 가중 평균)
- [ ] improvement_suggestions 자동 생성

### 5. 파이프라인 최적화
- [ ] Phase 2 배칭 (60→12 API콜, -30초)
- [ ] Phase 2 + Phase 4 병렬 실행 (-40초)
- [ ] 목표: 250초 → 120초

### 6. wakain.site 도메인
- [ ] DNS 전파 확인
- [ ] 커스텀 도메인 SSL 확인

### 7. Cold Start 최적화
- [ ] min-instances=1 설정 (월 ~₩15,000)
- [ ] 또는 Cloud Run startup probe 최적화

## 🟢 나중에

### 8. 리포트 UI 개선
- [ ] Scene description 동일 문제 해결 후 UI 확인
- [ ] 모바일 반응형 테스트
- [ ] 에러 핸들링 UX 개선

### 9. 결제/크레딧 (PMF 확인 후)
- SPEC.md Phase 2-4 로드맵 참고

### 10. 벤치마크 DB
- 카테고리별 50+ 영상 수집 필요
