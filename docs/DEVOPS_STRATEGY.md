# WakaLab DEV/PROD 구축 전략

> 작성: 2026-03-07 | 팀: 3명 (대표 + 개발자 2명)

---

## 1. 현재 상태 (AS-IS)

```
단일 환경 — 개발도 여기, 서비스도 여기

GitHub: main 브랜치 1개
    ↓
Cloudflare Pages: wakain.site
    ↓
Cloud Run: wakain-api (API + 분석 일체형)
    ↓
Gemini API Key (AI Studio, rate limit 15 RPM)
    ↓
Supabase: 1개 프로젝트 (DB + Auth)
    ↓
R2: 1개 버킷 (영상 저장)
```

**문제:**
- 개발 중 버그 → 바로 사용자에게 노출
- DB 스키마 변경 테스트 → PROD 데이터 위험
- 동시 분석 3건이면 Gemini rate limit
- 배포 실수 → 롤백 어려움

---

## 2. 목표 상태 (TO-BE)

```
┌─────────────────────────────────────────────────────────┐
│                        DEV 환경                          │
│                                                          │
│  GitHub: develop 브랜치                                   │
│      ↓ (push 시 자동 배포)                                │
│  Cloudflare Pages: dev.wakain.site                       │
│      ↓                                                   │
│  Cloud Run: wakain-api-dev (API)                         │
│      ↓                                                   │
│  Cloud Tasks: wakain-analysis-dev (큐)                   │
│      ↓                                                   │
│  Cloud Run: wakain-worker-dev (분석 Worker)               │
│      ↓                                                   │
│  Vertex AI: Gemini Flash (개발용 quota)                   │
│      ↓                                                   │
│  Supabase: DEV 프로젝트 (무료)                            │
│      ↓                                                   │
│  R2: wakain-dev 버킷                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                       PROD 환경                          │
│                                                          │
│  GitHub: main 브랜치                                      │
│      ↓ (PR merge 시 자동 배포)                            │
│  Cloudflare Pages: wakain.site                           │
│      ↓                                                   │
│  Cloud Run: wakain-api (API)                             │
│      ↓                                                   │
│  Cloud Tasks: wakain-analysis (큐)                       │
│      ↓                                                   │
│  Cloud Run: wakain-worker (분석 Worker, min=1)            │
│      ↓                                                   │
│  Vertex AI: Gemini Flash (PROD quota, 상향 가능)          │
│      ↓                                                   │
│  Supabase: PROD 프로젝트 (현재, 향후 Pro)                 │
│      ↓                                                   │
│  R2: wakain-prod 버킷                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 환경별 설정

### 3-1. 도메인/URL

| 항목 | DEV | PROD |
|------|-----|------|
| 프론트 | dev.wakain.site | wakain.site |
| API | wakain-api-dev-xxx.run.app | wakain-api-xxx.run.app |
| Worker | wakain-worker-dev-xxx.run.app | wakain-worker-xxx.run.app |
| Supabase | (새 프로젝트 URL) | btektycyknkqetmfmywc.supabase.co |

### 3-2. 환경변수

```bash
# ─── DEV (.env.dev) ─────────────────────────
VITE_API_URL=https://wakain-api-dev-xxx.run.app
SUPABASE_URL=https://xxx-dev.supabase.co
SUPABASE_SERVICE_KEY=xxx-dev
SUPABASE_ANON_KEY=xxx-dev
GCP_PROJECT=bridge-487513
GCP_LOCATION=asia-northeast3
WORKER_URL=https://wakain-worker-dev-xxx.run.app
CLOUD_TASKS_QUEUE=wakain-analysis-dev
ENV=development

# ─── PROD (.env.prod) ───────────────────────
VITE_API_URL=https://wakain-api-xxx.run.app
SUPABASE_URL=https://btektycyknkqetmfmywc.supabase.co
SUPABASE_SERVICE_KEY=xxx-prod
SUPABASE_ANON_KEY=xxx-prod
GCP_PROJECT=bridge-487513
GCP_LOCATION=asia-northeast3
WORKER_URL=https://wakain-worker-xxx.run.app
CLOUD_TASKS_QUEUE=wakain-analysis
ENV=production
```

### 3-3. Cloud Run 스펙

| 항목 | DEV | PROD |
|------|-----|------|
| API 메모리 | 1Gi | 2Gi |
| API min-instances | 0 | 0 |
| API max-instances | 2 | 5 |
| Worker 메모리 | 2Gi | 4Gi |
| Worker min-instances | 0 | **1** (콜드스타트 방지) |
| Worker max-instances | 2 | **10** |
| Worker concurrency | 1 | 1 |
| Worker timeout | 900s | 900s |

### 3-4. Cloud Tasks 큐

| 항목 | DEV | PROD |
|------|-----|------|
| 큐 이름 | wakain-analysis-dev | wakain-analysis |
| max dispatches/s | 2 | 5 |
| max concurrent | 2 | 10 |
| max attempts | 2 | 3 |
| min backoff | 30s | 60s |

---

## 4. Git 워크플로우

### 4-1. 브랜치 전략

```
main ─────────●──────────●──────────── PROD
               ↑          ↑
              PR (승인)   PR (승인)
               │          │
develop ──●──●──●──●──●──●──●──●───── DEV
            ↑       ↑         ↑
           merge   merge     merge
            │       │         │
feature/A ──●──●──●  │         │       개발자 1
feature/B ─────────●──●        │       개발자 2
hotfix/C ──────────────────────●       긴급 수정
```

### 4-2. 팀 규칙

```
┌──────────────────────────────────────────────┐
│  역할        │ 권한                           │
├──────────────┼───────────────────────────────┤
│  대표 (주인님) │ main merge 승인, PROD 배포     │
│  개발자 A     │ feature → develop PR           │
│  개발자 B     │ feature → develop PR           │
│  브릿지 (AI)  │ develop push, feature 생성     │
└──────────────┴───────────────────────────────┘

금지 사항:
  ❌ main 직접 push
  ❌ PROD 환경변수 임의 변경
  ❌ 승인 없이 develop → main merge
```

### 4-3. 커밋 컨벤션

```
feat: 새 기능 (feat: 배치 분석 API)
fix:  버그 수정 (fix: Gemini timeout 처리)
docs: 문서 (docs: API 스펙 추가)
refactor: 리팩토링 (refactor: 타입 파일 분리)
chore: 설정/빌드 (chore: CI/CD 파이프라인)
test: 테스트 (test: 인사이트 API 테스트)
```

---

## 5. CI/CD 파이프라인

### 5-1. GitHub Actions

```yaml
# .github/workflows/deploy-dev.yml
name: Deploy DEV
on:
  push:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
      # - run: cd backend && pytest (향후)

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
        env:
          VITE_API_URL: ${{ secrets.DEV_API_URL }}
          VITE_SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.DEV_SUPABASE_ANON_KEY }}
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          projectName: wakain
          directory: frontend/dist
          branch: dev

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: wakain-api-dev
          source: .
          region: asia-northeast3

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: wakain-worker-dev
          source: .
          region: asia-northeast3
```

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy PROD
on:
  push:
    branches: [main]

# 동일 구조, 환경변수만 PROD용
# wakain-api, wakain-worker, branch: main
```

### 5-2. 배포 플로우

```
개발자가 feature/xxx 개발 완료
    ↓
develop에 PR → 빌드 테스트 자동 실행
    ↓ (테스트 통과)
merge → DEV 자동 배포
    ↓
dev.wakain.site에서 확인
    ↓ (문제 없으면)
develop → main PR 생성
    ↓
주인님 승인
    ↓
merge → PROD 자동 배포
    ↓
wakain.site 반영 완료
```

---

## 6. DB 관리

### 6-1. 마이그레이션

```
DEV Supabase:
  - PROD 스키마 복제 (pg_dump --schema-only)
  - 테스트 데이터만 (분석 결과 10건 정도)
  - 스키마 변경은 항상 DEV에서 먼저

PROD Supabase:
  - 현재 데이터 유지 (106건)
  - 스키마 변경 = DEV 검증 후 적용
```

### 6-2. 스키마 변경 프로세스

```
1. DEV Supabase에서 스키마 변경
2. DEV 환경에서 테스트
3. SQL 마이그레이션 파일 작성 (migrations/001_xxx.sql)
4. PR에 마이그레이션 포함
5. main merge 후 PROD Supabase에 적용
```

### 6-3. 마이그레이션 폴더 구조

```
wakain/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_temporal_json.sql
│   ├── 003_add_script_alpha.sql
│   └── README.md (적용 순서 기록)
```

---

## 7. 비밀 관리

```
GitHub Secrets (환경별 분리):
├── DEV_API_URL
├── DEV_SUPABASE_URL
├── DEV_SUPABASE_SERVICE_KEY
├── DEV_SUPABASE_ANON_KEY
├── PROD_API_URL
├── PROD_SUPABASE_URL
├── PROD_SUPABASE_SERVICE_KEY
├── PROD_SUPABASE_ANON_KEY
├── GCP_SA_KEY (서비스 계정 JSON)
├── CF_API_TOKEN (Cloudflare)
└── RAPIDAPI_KEY

절대 코드에 하드코딩 ❌
.env 파일은 .gitignore ❌ (이미 되어있음)
```

---

## 8. 모니터링

### DEV
```
- Cloud Run 로그 (gcloud run services logs)
- 에러 시 Slack #8-시스템-알림-dev 알림
```

### PROD
```
- Cloud Run 로그 + Error Reporting
- 에러 시 Slack #8-시스템-알림-prod 알림
- Uptime Check: wakain.site (5분 간격)
- 분석 실패율 모니터링
```

---

## 9. 롤백 전략

```
프론트 롤백:
  Cloudflare Pages → 이전 배포 클릭 → 즉시 롤백 (1분)

백엔드 롤백:
  Cloud Run → 이전 revision으로 트래픽 전환 (1분)
  gcloud run services update-traffic wakain-api \
    --to-revisions=wakain-api-00075-zw6=100

DB 롤백:
  마이그레이션 역방향 SQL 준비
  Supabase 일일 백업에서 복구 (최후 수단)
```

---

## 10. 구축 일정

### Week 1 (주말: 3/8~9)
| 일정 | 작업 | 담당 |
|------|------|------|
| 토 오전 | Vertex AI 전환 + 테스트 | 브릿지+포지 |
| 토 오후 | Cloud Tasks + Worker 분리 | 포지 |
| 일 오전 | Supabase DEV 프로젝트 생성 + 스키마 복제 | 브릿지 |
| 일 오후 | DEV Cloud Run 배포 + E2E 테스트 | 포지 |

### Week 2
| 일정 | 작업 | 담당 |
|------|------|------|
| 월~화 | GitHub Actions CI/CD 설정 | 포지 |
| 수 | dev.wakain.site 연결 + 테스트 | 브릿지 |
| 목~금 | PROD 전환 + 모니터링 설정 | 전원 |

### Week 3
| 일정 | 작업 | 담당 |
|------|------|------|
| | 팀원 온보딩 + 첫 feature 브랜치 작업 | 전원 |

---

## 11. 체크리스트

### 인프라
- [ ] Vertex AI API 활성화
- [ ] Cloud Tasks API 활성화
- [ ] Supabase DEV 프로젝트 생성
- [ ] R2 DEV 버킷 생성
- [ ] Cloud Run DEV 서비스 배포 (API + Worker)
- [ ] Cloud Tasks DEV 큐 생성
- [ ] dev.wakain.site DNS 설정
- [ ] GCP 서비스 계정 생성 (CI/CD용)

### CI/CD
- [ ] GitHub Secrets 등록
- [ ] deploy-dev.yml 작성
- [ ] deploy-prod.yml 작성
- [ ] 자동 배포 테스트

### 보안
- [ ] .env.dev / .env.prod 분리
- [ ] 코드 내 하드코딩 키 제거
- [ ] Cloud Run Worker: 인증 필수 (--no-allow-unauthenticated)
- [ ] PROD Supabase RLS 정책 점검

### 팀
- [ ] 팀원 GitHub collaborator 초대
- [ ] 팀 규칙 공유 (커밋 컨벤션, PR 프로세스)
- [ ] 온보딩 문서 작성
