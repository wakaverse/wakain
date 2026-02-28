# WakaLab 영상 분석 아키텍처

> "이 영상이 이 제품을 팔 수 있는가? 왜? 어떻게 더 잘 팔 수 있는가?"

## 📐 전체 구조

```
영상 업로드 → [14단계 파이프라인] → 분석 리포트
                                    ├─ 영상 구조 (소구 분석)
                                    ├─ 개선 의견 (진단 + 처방)
                                    └─ 아트 디렉션 (디자인 분석)
```

### 기술 스택
| 레이어 | 기술 |
|--------|------|
| **Frontend** | React + TypeScript + Vite + Tailwind |
| **Backend API** | FastAPI (Python) on Cloud Run |
| **AI 분석** | Gemini 2.5 Flash / Flash Lite |
| **STT** | Soniox API |
| **DB** | Supabase (PostgreSQL) |
| **영상 저장** | Cloudflare R2 |
| **프론트 배포** | Cloudflare Pages |
| **백엔드 배포** | Google Cloud Run (asia-northeast3) |

---

## 🔬 파이프라인 14단계

### Track A: 전처리 (병렬 실행, ~5초)

| Phase | 이름 | 방식 | 하는 일 |
|-------|------|------|---------|
| **0** | STT 추출 | Soniox API | 음성→텍스트 (단어별 타임스탬프), 나레이션 유형 감지 (음성/캡션/무음) |
| **0.1** | 제품 스캐너 | Gemini Flash Lite (1회) | 영상 속 제품명, 브랜드, 카테고리 자동 추출 |
| **0.5** | 장면 감지 | PySceneDetect (로컬) | 컷 전환점 감지 (adaptive threshold 27→20→15→10, 6초 초과 시 강제 분할) |
| **0+1** | 프레임 추출+수치 분석 | OpenCV (로컬) | 2fps 프레임 추출, 밝기/채도/대비/색상/엣지/텍스트영역/얼굴감지 수치화 |

### Track B: 프레임 분석 + 영상 분석 (병렬 실행, ~70-90초)

| Phase | 이름 | 방식 | 하는 일 |
|-------|------|------|---------|
| **2** | 프레임 의미 분석 | Gemini Flash Lite (배치 5장/호출) | 프레임별: 샷타입, 구도, 텍스트오버레이, 제품노출, 인물, 색감, 아트워크(타이포/그래픽/레이아웃/컬러) |
| **4a** | 영상 종합 분석 | Gemini Flash (전체 영상 1회) | 9축 분석: 소구포인트, 내러티브, 페르소나, 공감트리거, 리텐션, 소구기법, 시각전략, 정보설계, CTA |
| **4b** | 아트 디렉션 | Gemini Flash (1회) | 타이포그래피, 컬러팔레트, 레이아웃, 그래픽요소, 모션, 트렌드 적합도 |
| **4c** | 몰입도 분석 | Gemini Flash (1회) | 훅 강도, 감정 곡선, 이탈 구간, 재시청 요소, CTA 효과 |

> 4b와 4c는 `asyncio.gather`로 병렬 실행 (~15-20초 절감)

### Track C: 로컬 분석 (API 호출 없음, ~1초)

| Phase | 이름 | 방식 | 하는 일 |
|-------|------|------|---------|
| **2.5** | 시계열 분석 | 로컬 연산 | 11개 시간축 레이어: attention_curve, cut_rhythm, playback_speed, text_dwell, visual_journey, exposure_curve, color_change, b-roll, zoom, caption_pattern, transition_texture |
| **3** | 씬 통합 | 로컬 연산 | 프레임들을 씬으로 묶기 (Phase 0.5 컷 기반), 씬별 visual_summary + content_summary 계산 |
| **5** | 씬 병합 | 로컬 연산 | Phase 3(프레임 기반) + Phase 4a(영상 기반) 씬 데이터 병합, 역할(hook/body/cta) 부여 |

### Track D: 소구 구조화 (Gemini 2-3회)

| Phase | 이름 | 방식 | 하는 일 |
|-------|------|------|---------|
| **5.5** | 소구 구조 | Gemini Flash Lite (2-3회) | 6-signal 기반 씬 클러스터링 → 씬 요약 → 소구그룹 묶기. 3단계 계층: 소구그룹 → 소구씬 → 컷 |

> 6가지 merge signal: speech_continuity(+3), caption_continuity(+2), same_appeal_type(+2), empty_cut(+1), smooth_transition(+1), visual_continuity(+1). 임계값 ≥3

### Track E: 레시피 + 진단 + 판결

| Phase | 이름 | 방식 | 하는 일 |
|-------|------|------|---------|
| **6** | 레시피 빌드 | 로컬 연산 | Track B+C+D 통합 → 영상 레시피 JSON (meta, scenes, art_direction, engagement) |
| **7 (C-8)** | 캡션 매핑 | 로컬 연산 | STT 자막을 씬/컷에 시간 매핑 |
| **7 (C-9)** | 3축 진단 | 로컬 연산 | 소구구조(40%) + 소구포인트(30%) + 편집리듬(30%) 3축 점수 산출 |
| **7 (C-10)** | 처방전 | 로컬 연산 | 11가지 체크 → severity(danger/warning/info) + 구체적 개선 권고 |
| **7b** | 마케터 판결 | Gemini Flash (1회) | 최종 판결 (집행 권장/조건부/불가), 3초 훅 분석, 마케팅 키워드 분석, 액션플랜 |

---

## 📊 현재 분석 가능 항목

### A. 영상 구조 분석
- **소구 구조 3단계 드릴다운**: 소구그룹 → 소구씬 → 개별 컷
- **소구 타임라인 바**: 컬러코딩된 시간축 시각화
- **씬별 소구포인트**: 타입(감성/논리/사회적증거 등), 강도(strong/moderate/weak), 소스(시각/대본)
- **컷별 대본 표시**: word-level 타임스탬프 기반 정확한 자막 슬라이싱

### B. 개선 의견
- **3초 훅 진단**: 첫 3초 프레임 분석, 훅 강도 평가 + 개선 제안
- **마케팅 키워드 분석**: 현재 사용 중 / 누락 추천 / 경쟁 키워드
- **마케터 판결**: 집행 권장/조건부/불가 + 근거 + 액션플랜
- **즉시 개선 Top 3**: 우선순위 높은 3개 액션
- **상세 처방전 (11가지 체크)**:
  1. 빈 소구 구간 (appeal gap)
  2. 약한 소구 비율
  3. 소구 다양성 부족
  4. 시각 소구 부족
  5. 대본 소구 부족
  6. 소구구조 점수 저조
  7. 소구포인트 점수 저조
  8. 편집리듬 점수 저조
  9. 훅(첫 3초) 부재
  10. CTA 부재
  11. 전체 점수 위험

### C. 아트 디렉션
- **타이포그래피**: 폰트 패밀리, 두께, 컬러, 아웃라인, 하이라이트 기법
- **컬러 팔레트**: 주요색/강조색, 조화 유형
- **레이아웃**: 상/중/하 영역별 구성
- **그래픽 요소**: 아이콘, 스티커, 화살표, 뱃지 등

### D. 기본 메타
- **제품 정보**: 제품명, 브랜드, 카테고리 자동 추출
- **나레이션 유형**: 음성/캡션/무음 자동 분류
- **영상 길이, 컷 수, 평균 컷 간격**

---

## 🚀 확장 가능한 분석 (미구현)

### 1단계: 단기 추가 가능 (기존 데이터 활용)

| 기능 | 설명 | 난이도 |
|------|------|--------|
| **Phase 2.6 연출 진단** | Phase 1(수치)+2(의미)+2.5(시계열) 합쳐 "제품 클로즈업인데 밝기 부족", "화자 얼굴 노출 12%로 신뢰감 부족" 등 구체적 연출 문제 진단 | ★★☆ |
| **이탈 예측 (Drop-off)** | attention_curve + cut_rhythm 기반 이탈 위험 구간 표시 (`drop_off_predictor.py` 이미 존재) | ★☆☆ |
| **편집 리듬 시각화** | 10-layer temporal data를 차트로 표시 (attention curve, cut rhythm 등) | ★★☆ |
| **업로드 시 제품 입력** | 사용자가 제품명/카테고리 직접 지정 → Phase 0.1 정확도 향상 | ★☆☆ |
| **분석 진행 상태 표시** | 현재 로딩 스피너 → Phase별 진행률 표시 | ★★☆ |
| **SNS URL 확장** | Instagram/TikTok URL → `yt-dlp`로 다운로드 → 분석 | ★★☆ |

### 2단계: 중기 신규 기능

| 기능 | 설명 | 난이도 |
|------|------|--------|
| **영상 비교 (A/B 테스트)** | "내 영상 vs 잘 나가는 영상" 벤치마킹 (`compare_engine.py` 이미 존재) | ★★★ |
| **카테고리별 벤치마크** | 식품/뷰티/전자 등 카테고리별 평균 점수 대비 내 영상 위치 | ★★★ |
| **히트맵 오버레이** | 영상 위에 attention 히트맵 시각화 | ★★★ |
| **경쟁사 분석** | 같은 카테고리 영상들 수집 → 트렌드 분석 | ★★★ |
| **자동 썸네일 추천** | attention_curve 피크 프레임 → 썸네일 후보 추출 | ★★☆ |
| **A/B 카피 제안** | 현재 자막/캡션 → 대안 카피 3개 자동 생성 | ★★☆ |

### 3단계: 장기 고도화

| 기능 | 설명 | 난이도 |
|------|------|--------|
| **성과 데이터 연동** | 실제 CTR/CVR/조회수 연동 → 분석 정확도 학습 | ★★★★ |
| **자동 리믹스** | 진단 결과 기반 영상 자동 재편집 (WakaShorts 연동) | ★★★★ |
| **실시간 분석 대시보드** | 브랜드별 영상 성과 모니터링 | ★★★★ |
| **팀 협업** | 여러 마케터가 같은 영상에 코멘트/태그 | ★★★ |
| **커스텀 체크리스트** | 브랜드별 맞춤 진단 기준 설정 | ★★★ |
| **음악/효과음 분석** | BGM 장르, 효과음 위치, 음악-영상 싱크 분석 | ★★★ |

---

## 📁 폴더 구조

```
wakain/
├── analyzer/              # 분석 엔진 (Python)
│   ├── main.py            # 파이프라인 오케스트레이터
│   └── src/
│       ├── stt.py                 # Phase 0: STT
│       ├── product_scanner.py     # Phase 0.1: 제품 스캐너
│       ├── scene_detect.py        # Phase 0.5: 장면 감지
│       ├── frame_extractor.py     # Phase 0+1: 프레임 추출
│       ├── frame_quant.py         # Phase 1: 수치 분석
│       ├── frame_qual.py          # Phase 2: 의미 분석 (Gemini)
│       ├── temporal_analyzer.py   # Phase 2.5: 시계열
│       ├── scene_aggregator.py    # Phase 3: 씬 통합
│       ├── video_analyzer.py      # Phase 4a/4b/4c: 영상 분석 (Gemini)
│       ├── scene_merger.py        # Phase 5: 씬 병합
│       ├── appeal_clusterer.py    # Phase 5.5: 소구 구조화
│       ├── recipe_builder.py      # Phase 6: 레시피 빌드
│       ├── caption_mapper.py      # Phase 7 C-8: 캡션 매핑
│       ├── integrated_analyzer.py # Phase 7 C-9: 통합 분석
│       ├── diagnosis_engine.py    # Phase 7 C-9: 3축 진단
│       ├── prescription_engine.py # Phase 7 C-10: 처방전
│       ├── marketer_judge.py      # Phase 7b: 마케터 판결
│       ├── schemas.py             # Pydantic 데이터 모델
│       ├── compare_engine.py      # (미사용) 영상 비교
│       ├── drop_off_predictor.py  # (미사용) 이탈 예측
│       └── report_generator.py    # (미사용) 리포트 생성
│
├── backend/               # FastAPI 서버
│   ├── app/
│   │   ├── routes/analyze.py     # POST /api/analyze, /api/analyze-url
│   │   ├── routes/results.py     # GET /api/results/:id
│   │   ├── worker.py             # 백그라운드 분석 실행
│   │   └── jobs.py               # 작업 상태 관리
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/              # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AnalyzePage.tsx   # 업로드 + URL 입력
│   │   │   └── ReportPage.tsx    # 분석 결과 리포트
│   │   ├── components/Report/
│   │   │   ├── PersuasionStructure.tsx  # 영상 구조 탭
│   │   │   ├── DiagnosisTab.tsx         # 개선 의견 탭
│   │   │   ├── ArtDirectionPanel.tsx    # 아트 디렉션 탭
│   │   │   ├── AppealTimelineBar.tsx    # 소구 타임라인
│   │   │   ├── VideoPlayer.tsx          # 영상 플레이어
│   │   │   └── DimensionChart.tsx       # 5축 레이더 차트
│   │   ├── lib/api.ts            # API 클라이언트
│   │   └── types/index.ts        # TypeScript 타입
│   └── .env
│
└── cloudbuild.yaml        # Cloud Build 설정
```

---

## 💰 비용 구조 (영상 1개, 30초 기준)

| 항목 | 비용 |
|------|------|
| Gemini Flash Lite (Phase 2, 0.1, 5.5) | ~₩7 |
| Gemini Flash (Phase 4a, 4b, 4c, 7b) | ~₩19 |
| Soniox STT (Phase 0) | ~₩3 |
| **합계** | **~₩25-30** |

---

## ⚡ 성능 (30초 영상 기준)

| 구간 | 소요 시간 |
|------|-----------|
| 전처리 (Phase 0~1, 병렬) | ~5초 |
| 프레임+영상 분석 (Phase 2+4, 병렬) | ~70-90초 |
| 로컬 처리 (Phase 2.5~3~5) | ~1초 |
| 소구 구조화 (Phase 5.5) | ~10초 |
| 레시피+진단+판결 (Phase 6~7b) | ~15초 |
| **총 소요** | **~90-120초** |

---

*코드 규모: 11,896줄 (Python analyzer + main.py)*
*최종 업데이트: 2026-02-27*
