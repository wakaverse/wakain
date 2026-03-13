# R20 Plan — 베타 오픈 구성

> 작성: 2026-03-13 23:36 KST

---

## T7. 제작가이드 메뉴 완성

### 현재 상태
- `GuidePage.tsx` — 사용법 안내 페이지 (업로드→분석→리포트 3단계 설명)
- 실제 "제작가이드" 기능 없음 — 분석 결과 기반 가이드가 아닌 단순 how-to

### 구현 내용

**7-1. 제작가이드 리포트 페이지** (`GuidReportPage.tsx` 신규)
- 분석 결과(result_id)를 받아 제작 방향 리포트 생성
- 3개 섹션:

| 섹션 | 내용 | 데이터 소스 |
|------|------|------------|
| **구조 개선** | Hook/Body/CTA 각 구간 개선안 | `evaluation.structure.hook/body/cta.improvements[]` |
| **레시피 리팩토링** | 현재 블록 순서 vs 제안 순서 + 이유 | `evaluation.recipe_eval` |
| **핵심 개선** | 종합 개선 포인트 (fact + suggestion) | `evaluation.improvements[]` |

**7-2. 대본 초안 생성 MVP** (버튼 1개)
- "이 영상과 비슷한 대본 생성" 버튼
- 백엔드: `POST /api/generate-script`
  - 입력: result_id
  - 로직: recipe.script.blocks 순서 + alpha 기법 + product.claims → Gemini 1콜
  - 출력: 대본 텍스트 (마크다운)
- 프론트: 모달로 대본 표시 + 복사 버튼

### 변경 파일
| 파일 | 변경 |
|------|------|
| `GuidReportPage.tsx` | 신규 페이지 |
| `backend/app/routes/guide.py` | 신규 라우트 (`/api/generate-script`) |
| `backend/app/main.py` | 라우터 등록 |
| `App.tsx` | 라우팅 추가 |
| `ReportPage.tsx` | "제작가이드 보기" 버튼 추가 |

### 완료 기준
- [ ] 분석 결과에서 "제작가이드" 버튼 클릭 → 가이드 페이지 이동
- [ ] 구조 개선 / 레시피 리팩토링 / 핵심 개선 3섹션 표시
- [ ] "대본 생성" 버튼 → Gemini 1콜 → 대본 텍스트 표시
- [ ] 대본 복사 버튼 동작
- [ ] `npm run build` + 백엔드 테스트 통과

**예상: 2~3일**

---

## T8. 레이더 메뉴 MVP

### 현재 상태
- **백엔드**: `radar.py` — 채널 CRUD, 릴 수집, 피드 조회 **이미 구현됨**
- **프론트**: `RadarPage.tsx` — 채널 등록, 피드 보기, 수집 버튼 **이미 구현됨**
- **DB**: `radar_channels`, `radar_reels` 테이블 존재
- **문제**: RapidAPI 의존, 안정성 미검증, 자동 분석 미연결

### 남은 작업

**8-1. 레이더 → 자동 분석 연결**
- 현재: 레이더에서 영상 수집만 함. 분석은 별도 수동
- 변경: 수집된 릴에 "분석하기" 버튼 → job 생성 → 분석 후 결과 연결
- `radar_reels.job_id` FK 활용 (이미 컬럼 존재)

**8-2. 경쟁사 대시보드**
- 채널별 최근 분석 결과 카드 목록
- 정렬: 최신순 / 조회수순 / spike_multiplier순

**8-3. 알림 (MVP: 인앱)**
- 새 릴 감지 시 대시보드 뱃지 표시
- (이메일 알림은 후순위)

**8-4. 안정성**
- RapidAPI 실패 시 graceful degradation (마지막 성공 데이터 유지)
- 수집 실패 시 "업데이트 실패" 표시

### 변경 파일
| 파일 | 변경 |
|------|------|
| `RadarPage.tsx` | "분석하기" 버튼 + 분석 결과 연결 + 뱃지 |
| `radar.py` | 분석 트리거 엔드포인트 + 에러 핸들링 |
| `worker.py` | 레이더 영상 분석 job 처리 |

### 완료 기준
- [ ] 채널 등록 → 릴 수집 → "분석하기" → 결과 확인 E2E 동작
- [ ] 수집 실패 시 graceful degradation
- [ ] 채널별 분석 결과 목록 표시
- [ ] `npm run build` + 백엔드 테스트 통과

**예상: 3~4일** (백엔드 대부분 완료, 프론트 연결 + 안정성 위주)

---

## 실행 순서

| 순서 | 태스크 | 예상 |
|------|--------|------|
| 1 | T7 제작가이드 | 2~3일 |
| 2 | T8 레이더 MVP | 3~4일 |

**총 예상: 5~7일**
