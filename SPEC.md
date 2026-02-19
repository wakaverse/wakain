# WakaIn MVP 설계서

## 서비스 개요
- **이름**: WakaIn (와카인)
- **도메인**: wakain.site
- **한 줄 설명**: "숏폼 영상 넣으면 → 왜 잘되는지 + 어떻게 복제하는지"
- **타겟**: 퍼포먼스 마케터, 광고 대행사, 이커머스

## 아키텍처

```
[사용자 브라우저]
    ↓ 영상 업로드
[Cloudflare Pages — React SPA]
    ↓ API 호출
[Cloud Run — FastAPI]
    ├── POST /api/analyze → 큐 등록 → 즉시 job_id 반환
    ├── GET /api/jobs/{id} → 상태 확인 (polling)
    ├── GET /api/results/{id} → 분석 결과
    └── 워커: video-analyzer 파이프라인 실행
    ↓
[Supabase] Auth + DB (jobs, results, users)
[Cloudflare R2] 영상 파일 저장
[Gemini API] Tier 3 — 분석 엔진
```

## MVP 기능 (v0.1)

### 사용자 플로우
1. 구글 로그인 (Supabase Auth)
2. 영상 업로드 (드래그앤드롭, 최대 100MB)
3. "분석 중..." 상태 표시 (예상 2분)
4. 분석 완료 → 리포트 대시보드
5. 이전 분석 목록 확인

### 리포트 화면
- 📋 기본 정보 (길이, 씬수, 카테고리)
- 🎯 소구 분석 (어필 포인트 + 전략)
- 📈 집중도 커브 (차트)
- ⚠️ 이탈 위험 구간
- 🎬 씬 타임라인 (역할별 색상)
- 🎨 아트 디렉션
- ⚡ 퍼포먼스 메트릭 (11종)
- 💡 개선 제안

### 제한
- Free: 3건/월
- 영상: 최대 100MB, 60초 이하

## 스택

### Frontend
- React 19 + Vite
- Tailwind CSS + shadcn/ui
- Recharts (집중도 차트)
- react-dropzone (업로드)
- Cloudflare Pages 배포

### Backend
- FastAPI (Python 3.12)
- video-analyzer 파이프라인 (기존 코드 import)
- Cloud Run (min 0, max 10 인스턴스)
- 비동기 처리: BackgroundTasks 또는 Cloud Tasks

### DB (Supabase)
```sql
-- jobs 테이블
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  status text default 'pending', -- pending/processing/completed/failed
  video_url text,
  video_name text,
  video_size_mb float,
  duration_sec float,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

-- results 테이블
create table results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  recipe_json jsonb, -- 전체 VideoRecipe
  summary_json jsonb, -- 요약 (빠른 로딩용)
  created_at timestamptz default now()
);

-- RLS
alter table jobs enable row level security;
alter table results enable row level security;
create policy "Users see own jobs" on jobs for select using (auth.uid() = user_id);
create policy "Users see own results" on results for select using (
  job_id in (select id from jobs where user_id = auth.uid())
);
```

### Storage (R2)
- 버킷: `wakain-videos`
- 업로드: presigned URL (프론트 → R2 직접)
- 분석 후 원본 삭제 (프라이버시)

## 프로젝트 구조

```
wakain/
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload.tsx
│   │   │   ├── JobStatus.tsx
│   │   │   ├── Report/
│   │   │   │   ├── ReportPage.tsx
│   │   │   │   ├── AppealSection.tsx
│   │   │   │   ├── AttentionChart.tsx
│   │   │   │   ├── SceneTimeline.tsx
│   │   │   │   ├── ArtDirection.tsx
│   │   │   │   ├── Metrics.tsx
│   │   │   │   └── Suggestions.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── Layout.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/           # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── analyze.py
│   │   │   ├── jobs.py
│   │   │   └── results.py
│   │   ├── worker.py
│   │   ├── config.py
│   │   └── deps.py
│   ├── Dockerfile
│   └── requirements.txt
├── SPEC.md
└── README.md
```

## 배포

### Frontend
- `wakain.pages.dev` → `wakain.site`
- Cloudflare Pages + GitHub 연동

### Backend
- Cloud Run: `wakain-api`
- Region: asia-northeast3 (서울)
- Min instances: 0, Max: 10
- Memory: 2GB, CPU: 2
- Timeout: 300s (분석 시간 고려)

## 비용 (월)

| 항목 | Free tier | 100건/월 | 1,000건/월 |
|------|-----------|----------|------------|
| Cloudflare Pages | ₩0 | ₩0 | ₩0 |
| Cloud Run | ₩0 | ~₩3,000 | ~₩30,000 |
| Supabase | ₩0 | ₩0 | ₩0 |
| R2 | ₩0 | ~₩500 | ~₩5,000 |
| Gemini API | (Tier 3) | ~₩15,000 | ~₩150,000 |
| **합계** | **₩0** | **~₩18,500** | **~₩185,000** |
