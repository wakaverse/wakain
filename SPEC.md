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

## 확장 로드맵

### Phase 2: 결제 + 크레딧 (PMF 확인 후)
```sql
-- users 확장
alter table users add column plan text default 'free'; -- free/pro/business
alter table users add column credits_remaining int default 3;
alter table users add column credits_reset_at timestamptz;

-- 결제 이력
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  plan text not null,
  provider text not null, -- stripe/portone
  provider_sub_id text,
  status text default 'active', -- active/canceled/past_due
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  amount int not null, -- +충전 / -사용
  reason text, -- 'monthly_reset', 'analysis', 'bonus'
  job_id uuid references jobs(id),
  created_at timestamptz default now()
);
```
- 결제: Stripe (글로벌) + 포트원 (국내)
- 크레딧: Free 3건/월, Pro 50건/월, Business 무제한
- `middleware/billing.py` — 분석 전 크레딧 차감 체크

### Phase 3: 팀 + 공유 (유료 전환 시)
```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text default 'business',
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id),
  user_id uuid references auth.users(id),
  role text default 'member', -- owner/admin/member/viewer
  primary key (org_id, user_id)
);

-- jobs에 org 컬럼 추가
alter table jobs add column org_id uuid references organizations(id);

-- 공유 링크
create table shared_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  token text unique not null,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```
- RLS: `org_members`에 기반한 팀 단위 접근 제어
- 공유: 토큰 기반 공개 URL (`/shared/{token}`)
- 팀 대시보드: 팀원별 분석 현황

### Phase 4: 엔터프라이즈 (B2B 수요 확인 시)
- SSO (SAML/OIDC)
- API Key 발급 (`api_keys` 테이블) → 외부 연동
- 대량 분석 배치 API
- 커스텀 벤치마크 DB (자사 영상끼리 비교)
- SLA + 전용 Cloud Run 인스턴스
- 감사 로그 (`audit_logs` 테이블)

### 확장 설계 원칙
1. **모든 테이블에 `user_id` FK** → Phase 3에서 `org_id` 추가만으로 팀 전환
2. **RLS 정책 기반 권한** → 코드 변경 없이 정책만 추가
3. **서비스 레이어 분리** → `services/billing.py`, `services/sharing.py` 등 독립 모듈
4. **config 기반 제한** → plan별 limits를 config/DB로 관리 (하드코딩 금지)

## 비용 (월)

| 항목 | Free tier | 100건/월 | 1,000건/월 |
|------|-----------|----------|------------|
| Cloudflare Pages | ₩0 | ₩0 | ₩0 |
| Cloud Run | ₩0 | ~₩3,000 | ~₩30,000 |
| Supabase | ₩0 | ₩0 | ₩0 |
| R2 | ₩0 | ~₩500 | ~₩5,000 |
| Gemini API | (Tier 3) | ~₩15,000 | ~₩150,000 |
| **합계** | **₩0** | **~₩18,500** | **~₩185,000** |
