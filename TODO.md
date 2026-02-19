# WakaIn TODO — 2026-02-20 업데이트

## ✅ 완료 (오늘)
- [x] 소구(Appeal) enum 재설계 — 17개→18개, 한국어 정의 명시
- [x] 텍스트 오버레이 영상 자동 감지 + 프롬프트 분기 (Phase 4)
- [x] Phase 2 OCR → Phase 4 프롬프트 주입
- [x] 커밋 + 푸시 + Cloud Run/Cloudflare 배포

## 🔴 HIGH — 내일 우선
- [ ] **유지율(retention) 100점 버그** — dropoff_predictor.py 기준값 조정
  - 집중도 < 20 → < 40, 소구공백 5초→3초, 씬정체 4초→3초
  - 집중도 커브(per-second) 직접 반영 (현재 씬당 1개 점수만 사용)
- [ ] **summary_json 빈 배열 버그** — worker.py `_build_summary()` 경로 수정
  - strengths/weaknesses/suggestions가 비어있음
  - recipe JSON 경로와 불일치 (effectiveness_assessment 키 매핑)
- [ ] **0220.mp4 재분석** — enum 변경 + 텍스트 오버레이 개선 후 결과 확인
- [ ] **R2 presigned URL 업로드** — 포지(plaid-shore) 작업 확인
  - R2 대시보드 활성화 (주인님 Cloudflare 대시보드에서)
  - R2 API 토큰 생성 필요

## 🟡 MEDIUM
- [ ] **wakain.site 커스텀 도메인** — DNS 전파 확인
- [ ] **프론트엔드 소구 흐름 한국어 매핑** — 신규 enum 반영 확인
- [ ] **text_effects 타임스탬프 0.0초 집중** — Gemini가 text_effects만 다른 패턴으로 반환하는 문제
- [ ] **GCP OAuth 프로덕션 게시** — 현재 테스트 모드

## 🟢 LOW
- [ ] Pipeline 최적화 — Phase 2 배칭 (60→12 호출) + Phase 2/4 병렬
- [ ] Benchmark DB — 50+ 영상 분석 후 카테고리별 기준선
- [ ] Template engine — 레시피 → 재사용 가능한 템플릿 추상화
- [ ] 대용량 영상(>20MB) 직접 업로드 대응 (R2 완료 후)

## 📊 현재 상태
- 프론트: https://wakain.pages.dev ✅
- 백엔드: https://wakain-api-191739349431.asia-northeast3.run.app ✅
- Supabase: btektycyknkqetmfmywc ✅
- 분석 완료 영상: 1건 (0220.mp4 — 쿠진 칼 살균기)
