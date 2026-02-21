# WakaLab 프론트엔드 업데이트 태스크

## 목표
마케터가 **영상을 보면서** 분석 결과를 확인할 수 있는 리포트 페이지 구현.
텔레그램 텍스트가 아닌, 영상 플레이어와 함께 인터랙티브하게.

## 핵심 레이아웃
```
┌─────────────────────────────────────────┐
│  영상 플레이어 (좌측 또는 상단 고정)       │
│  ┌─────────┐                            │
│  │ ▶ video │  ← 씬 클릭 시 해당 시점 이동  │
│  └─────────┘                            │
│                                         │
│  ── 탭 네비게이션 ──                      │
│  [소구 흐름도] [씬 카드] [진단서] [아트]    │
│                                         │
│  (탭 콘텐츠 영역)                         │
└─────────────────────────────────────────┘
```

## 데이터 소스
백엔드에서 이미 생성되는 JSON 파일들:
- `{name}_video_recipe.json` — scenes, meta, audio, art_direction, persuasion_analysis
- `{name}_diagnosis.json` — dimensions, engagement_score, diagnoses, scene_analyses, strengths, weaknesses
- `{name}_prescriptions.json` — prescriptions, top_3_actions
- `{name}_stt.json` — narration_type, full_transcript, segments
- `{name}_style.json` — primary_format, primary_intent, format_ko, intent_ko
- `{name}_caption_map.json` — caption_count, narrative_flow, events
- `{name}_temporal.json` — cut_rhythm, attention_curve

### API 엔드포인트
기존 `GET /api/result/{job_id}` 가 video_recipe를 반환함.
**새로 필요**: diagnosis, prescriptions, stt, style, caption_map도 함께 반환하도록 백엔드 수정 필요.
또는 별도 엔드포인트: `GET /api/result/{job_id}/diagnosis` 등.

## 탭 1: 소구 흐름도 (Appeal Flow)
- 타임라인 바: 영상 길이에 비례, 씬 역할별 색상 구분
  - hook=빨강, demo=파랑, proof=초록, solution=보라, cta=주황, brand=노랑
- 소구 포인트 마커: 타임라인 위에 아이콘으로 표시
  - 🎬 비주얼 연출 = 채워진 원, 📝 자막 = 빈 원
- 소구 공백 구간: 빗금 또는 빨간 하이라이트
- 클릭 시 영상 해당 시점으로 이동
- 하단에 소구 목록 (시간순, 타입+claim+technique)

## 탭 2: 씬 카드 (Scene Cards)
- 씬별 카드 UI (그리드 또는 리스트)
- 각 카드: 
  - 씬 번호, 역할 뱃지, 시간 범위
  - 집중도 바 (색상: 🟢>60, 🟡30-60, 🔴<30)
  - 소구 포인트 목록 (있으면)
  - 텍스트 효과 수
  - 설명 텍스트
- 카드 클릭 → 영상 해당 시점 이동
- 집중도 높은 씬 / 낮은 씬 필터

## 탭 3: 진단서 (Diagnosis)
- 상단: 5차원 레이더 차트 또는 바 차트
  - 시각자극도, 설득밀도, 정보밀도, 편집리듬, 청각자극도
  - 각 차원 evidence 툴팁
- 종합 점수 큰 숫자 표시
- 강점 (✅ 리스트)
- 약점 + 처방 (⚠️ 리스트, severity 색상 구분)
  - 각 처방에 time_range 있으면 → 클릭 시 영상 이동
- 처방 우선순위 (prescriptions top_3)

## 탭 4: 아트 디렉션
- 톤 & 매너
- 폰트 정보 (헤딩/본문)
- 컬러 팔레트 (색상 칩으로 시각화)
- 브랜드 컬러
- 강조 방법
- 구도/레이아웃 규칙
- 일관성 점수
- 스타일 레퍼런스

## 영상 플레이어
- HTML5 `<video>` 태그
- 영상 URL: 업로드된 영상의 URL (R2 또는 로컬)
- `currentTime` 조작으로 씬/소구 클릭 시 점프
- 현재 재생 시점 → 해당 씬 카드/소구 하이라이트 연동

## 기존 컴포넌트 참고
- `frontend/src/components/Report/` — 기존 7개 컴포넌트 (리팩토링 대상)
- `frontend/src/pages/ReportPage.tsx` — 기존 리포트 페이지
- `frontend/src/types/index.ts` — 타입 정의 (확장 필요)

## 스타일
- Tailwind CSS + shadcn/ui (기존 프로젝트 스택)
- 다크모드 불필요 (라이트 모드만)
- 모바일 반응형은 후순위 (데스크톱 우선)

## 주의사항
- `gemini-2.0-flash` 절대 사용 금지 → `gemini-2.5-flash` 사용
- 백엔드 코드는 `~/.openclaw/workspace-coder/projects/video-analyzer/`에 있음
- 프론트엔드 코드는 `~/.openclaw/workspace-coder/projects/wakain/frontend/`에 있음
- 백엔드 API 수정도 필요하면 함께 진행
