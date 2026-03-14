# R-REFACTOR Plan — 코드 구조 리팩토링 + CI/CD 테스트 파이프라인

> 2026-03-14
> 목적: 사이드 이펙트 최소화, 기능별 독립 개발 가능한 구조로 전환

---

## 현재 문제

1. **백엔드 worker.py (841줄)**: 파이프라인 실행 + 썸네일 + 정규화 + content_dna + brand/channel 전부 한 파일
2. **프론트 Report 컴포넌트 20개**: components/Report/ 아래 20개 파일이 모두 ReportPage에서 직접 임포트
3. **테스트 없음**: 코드 수정 후 검증 수단이 수동 확인뿐
4. **CI/CD 없음**: push → 수동 배포 → 기도

---

## T1: 백엔드 모듈 분리

### 변경 전
```
backend/app/worker.py (841줄) — 모든 후처리 로직
```

### 변경 후
```
backend/app/
  worker.py            — run_analysis() + 파이프라인 실행만 (~200줄)
  services/
    __init__.py
    storage.py         — _supabase(), _s3(), R2 업로드/다운로드
    thumbnail.py       — _extract_thumbnails(), _generate_cover_thumbnail()
    normalized.py      — _save_normalized_data(), _build_summary()
    content_dna.py     — _build_content_dna(), _calc_*(), _has_text_overlay()
    brand_channel.py   — _match_or_create_brand(), _extract_channel_from_url(), _upsert_channel()
    category.py        — _resolve_category_id()
```

### 규칙
- worker.py는 services/ 모듈만 import
- 각 서비스 모듈은 서로 import하지 않음 (storage만 예외)
- 기존 함수 시그니처 유지 (내부 이동만)

### 완료 기준
- [x] worker.py 200줄 이하
- [x] services/ 모듈 6개 생성
- [x] 기존 기능 동작 동일 (분석 → 리포트 → content_dna)

---

## T2: 프론트 탭 구조 준비

### 변경 전
```
ReportPage.tsx (185줄) — CollapsibleSection으로 세로 나열
components/Report/ (20개 파일) — 전부 직접 임포트
```

### 변경 후
```
pages/ReportPage.tsx        — 탭 라우터 + 데이터 로딩만 (~80줄)
components/Report/tabs/
  TabSummary.tsx            — 요약 탭 (VideoSummaryCard + 핵심코칭 1줄)
  TabTimeline.tsx           — 타임라인 탭 (UnifiedTimeline)
  TabCoaching.tsx           — 코칭 탭 (CoachingCard + 제작가이드 버튼)
  TabStructure.tsx          — 구조분석 탭 (Positioning + Hook + ProductClaims)
components/Report/          — 기존 컴포넌트 유지 (개별 카드)
```

### 규칙
- ReportPage는 Tab 컴포넌트만 import
- 각 Tab은 자기에게 필요한 Report/ 컴포넌트만 import
- Tab 간 직접 의존 금지

### 완료 기준
- [x] 4개 탭 전환 동작
- [x] 기존 모든 정보 탭에 배치
- [x] 탭 클릭 로그 기록 (user_activity_logs)

---

## T3: CODING_GUIDE.md 작성

프로젝트 루트에 AI 코딩 가이드라인 배치:

```markdown
# CODING_GUIDE.md

## 수정 범위
- 요청받은 기능의 파일만 수정할 것
- 요청 외 파일 임의 수정 금지

## 파일 구조
- 새 API: backend/app/routes/{기능명}.py
- 새 서비스: backend/app/services/{기능명}.py
- 새 프론트 컴포넌트: frontend/src/components/{기능명}/
- 새 탭: frontend/src/components/Report/tabs/

## 코딩 규칙
- import 추가 시 기존 패턴 따를 것
- 타입 명시 (TypeScript strict, Python type hints)
- 함수 독스트링 필수

## 수정 보고
- 수정한 파일 목록 반드시 명시
- 수정 이유 간략 기재
```

### 완료 기준
- [x] CODING_GUIDE.md 생성
- [x] 주요 규칙 10개 이상

---

## T4: 테스트 프레임워크 구축

### 구조
```
tests/
  conftest.py              — 공통 fixture (supabase client, API client)
  samples/
    sample_15s.mp4         — 테스트용 짧은 영상 (15초)
    sample_recipe.json     — 분석 결과 샘플
  backend/
    test_api_analyze.py    — POST /analyze 응답 검증
    test_api_jobs.py       — GET /jobs 응답 검증
    test_api_guide.py      — POST /guide 응답 검증
    test_content_dna.py    — content_dna 생성 검증
    test_brand_channel.py  — brand/channel 매칭 검증
  frontend/
    test_report_tabs.py    — 4개 탭 렌더링 (Playwright)
    test_analyze_flow.py   — 업로드 → 분석 시작 (Playwright)
    test_library.py        — 라이브러리 목록 (Playwright)
  scenarios/
    full_pipeline.yaml     — 풀 파이프라인 시나리오 정의
```

### 테스트 레벨

| 레벨 | 도구 | 실행 시점 |
|------|------|----------|
| 린트/타입 | ESLint + mypy | 매 push |
| 빌드 | vite build + pip install | 매 push |
| API 유닛 | pytest + httpx | 매 push |
| 브라우저 UI | Playwright | 배포 전 |
| 풀 파이프라인 | pytest + Gemini 실제 호출 | 요청 시 |

### 완료 기준
- [x] pytest 설정 (backend/pytest.ini)
- [x] API 테스트 5개 이상
- [x] Playwright 테스트 3개 이상
- [x] 풀 파이프라인 시나리오 1개

---

## T5: GitHub Actions CI 파이프라인

### .github/workflows/ci.yml

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint-and-type:
    # ESLint + TypeScript + mypy
    # ~30초

  build:
    # frontend: npm run build
    # backend: pip install + import check
    # ~1분

  api-tests:
    # pytest tests/backend/
    # Supabase test 환경 사용
    # ~2분

  # 배포 전 수동 트리거
  browser-tests:
    if: github.ref == 'refs/heads/main'
    # Playwright tests/frontend/
    # ~5분
```

### 배포 연결
- main branch push + CI 통과 → Cloud Run / CF Pages 자동 배포
- CI 실패 → 배포 차단 + 슬랙 알림

### 완료 기준
- [x] GitHub Actions 워크플로우 생성
- [x] push 시 자동 실행
- [x] 실패 시 배포 차단

---

## 실행 순서

| 순서 | 태스크 | 예상 소요 |
|------|--------|----------|
| 1 | T1: 백엔드 모듈 분리 | 30분 |
| 2 | T3: CODING_GUIDE.md | 10분 |
| 3 | T4: 테스트 프레임워크 (API 테스트) | 40분 |
| 4 | T5: GitHub Actions CI | 20분 |
| 5 | T2: 프론트 탭 구조 (= R26 T1과 통합) | 40분 |

T2는 R26(리포트 개선)의 T1과 동일 작업이므로 R26에서 진행.

**총 예상: 포지 기준 ~2시간**

---

## 이후 순서
R-REFACTOR → R26(리포트 개선) → R24(회수 제한) → R25(비교 분석)
