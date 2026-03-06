# WakaLab GCP 마이그레이션 + DEV/PROD 분리 설계서

> 작성: 2026-03-06 | 착수: 주말 (3/8~9)

## 목표
1. Gemini API Key → Vertex AI 전환 (rate limit 해소)
2. Cloud Tasks 큐 + Worker 분리 (대용량 분석 대비)
3. DEV/PROD 환경 분리

---

## 현재 아키텍처

```
Cloudflare Pages (wakain.site)
    ↓
Cloud Run: wakain-api (API + 분석 일체형)
    ↓
Gemini API Key (AI Studio) ← rate limit 15 RPM
    ↓
Supabase (DB + Auth)
    ↓
R2 (영상 저장)
```

## 목표 아키텍처

```
Cloudflare Pages
  ├── wakain.site (PROD)
  └── dev.wakain.site (DEV)
         ↓
Cloud Run: wakain-api (API 서버, 가벼움)
  ├── 분석 요청 접수 → Cloud Tasks 큐에 넣기
  ├── 결과 조회 / 인사이트 / 라이브러리
  └── 라우팅만 담당 (분석 로직 없음)
         ↓
Cloud Tasks (큐)
  └── 분석 작업 순서대로 전달
         ↓
Cloud Run: wakain-worker (Worker, 분석 전담)
  ├── 영상 다운로드
  ├── FFmpeg 프레임 추출
  ├── Whisper STT
  ├── Vertex AI Gemini 5회 호출
  └── 결과 저장 → Supabase
         ↓
Vertex AI (Gemini Flash) ← quota 상향 가능
         ↓
Supabase (DB + Auth, 유지)
         ↓
R2 (영상 저장, 유지)
```

---

## Step 1: Vertex AI 전환

### 변경 사항
- `google-genai` SDK는 AI Studio / Vertex AI 둘 다 지원
- 인증: API Key → Application Default Credentials (ADC)
- Cloud Run에서는 서비스 계정이 자동으로 ADC 제공

### 코드 변경

```python
# 현재 (AI Studio)
import google.generativeai as genai
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# 변경 (Vertex AI)
import google.generativeai as genai
genai.configure(
    # ADC 자동 인식 — API Key 불필요
    # Cloud Run 서비스 계정에 Vertex AI User 역할 필요
)
# 또는 vertexai 라이브러리 사용:
# import vertexai
# vertexai.init(project="bridge-487513", location="asia-northeast3")
```

### GCP 설정
```bash
# Vertex AI API 활성화
gcloud services enable aiplatform.googleapis.com --project=bridge-487513

# Cloud Run 서비스 계정에 Vertex AI 권한 부여
gcloud projects add-iam-policy-binding bridge-487513 \
  --member="serviceAccount:$(gcloud iam service-accounts list --project=bridge-487513 --format='value(email)' | head -1)" \
  --role="roles/aiplatform.user"
```

### 환경변수 변경
```
삭제: GEMINI_API_KEY, GEMINI_API_KEY_PRO
추가: GCP_PROJECT=bridge-487513, GCP_LOCATION=asia-northeast3
유지: SUPABASE_URL, SUPABASE_SERVICE_KEY 등
```

### 확인 사항
- [ ] `google-genai` SDK가 vertexai 모드 지원하는지 확인
  - 아니면 `google-cloud-aiplatform` + `vertexai` SDK로 교체
- [ ] Gemini Flash 모델명: `gemini-2.0-flash` (Vertex AI에서 동일한지)
- [ ] 현재 사용 중인 response_schema (JSON mode) Vertex AI 호환 확인

### 예상 시간: 2~3시간

---

## Step 2: Cloud Tasks 큐 + Worker 분리

### 2-1. Cloud Tasks 설정

```bash
# Cloud Tasks API 활성화
gcloud services enable cloudtasks.googleapis.com --project=bridge-487513

# 큐 생성
gcloud tasks queues create wakain-analysis \
  --project=bridge-487513 \
  --location=asia-northeast3 \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --min-backoff=60s
```

### 2-2. API 서버 변경 (wakain-api)

현재 분석 플로우:
```
POST /api/jobs → worker.py에서 직접 분석 실행 (12분 블로킹)
```

변경 후:
```
POST /api/jobs → Cloud Tasks에 태스크 생성 → 즉시 응답 (0.1초)
```

```python
# backend/app/routes/jobs.py 변경

from google.cloud import tasks_v2

async def create_job(...):
    # 1. DB에 job 생성 (status: "queued")
    job = create_job_in_db(...)
    
    # 2. Cloud Tasks에 태스크 추가
    client = tasks_v2.CloudTasksClient()
    task = {
        "http_request": {
            "http_method": "POST",
            "url": f"{WORKER_URL}/api/worker/analyze",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"job_id": job.id}).encode(),
            "oidc_token": {
                "service_account_email": SERVICE_ACCOUNT,
            },
        }
    }
    client.create_task(parent=QUEUE_PATH, task=task)
    
    # 3. 즉시 응답
    return {"id": job.id, "status": "queued"}
```

### 2-3. Worker 서비스 (wakain-worker) — 신규

별도 Cloud Run 서비스로 배포:

```python
# worker/main.py

from fastapi import FastAPI, Request
app = FastAPI()

@app.post("/api/worker/analyze")
async def analyze(request: Request):
    body = await request.json()
    job_id = body["job_id"]
    
    # 기존 worker.py 로직 그대로
    # 1. job 정보 로드
    # 2. 영상 다운로드
    # 3. 프레임 추출
    # 4. STT
    # 5. Gemini 분석 5회 (Vertex AI)
    # 6. 결과 저장
    # 7. job status → "done"
    
    return {"status": "ok"}
```

### Worker Cloud Run 설정
```bash
gcloud run deploy wakain-worker \
  --source=. \
  --region=asia-northeast3 \
  --project=bridge-487513 \
  --no-allow-unauthenticated \  # Cloud Tasks만 호출 가능
  --memory=4Gi \                 # 영상 처리용 큰 메모리
  --cpu=2 \
  --timeout=900 \                # 15분
  --min-instances=0 \
  --max-instances=10 \           # 동시 분석 최대 10건
  --concurrency=1                # 인스턴스당 1건만 처리
```

### 2-4. 프론트엔드 변경

```
변경 없음!
- POST /api/jobs → 기존과 동일 (응답만 빨라짐)
- GET /api/jobs/:id → 폴링으로 상태 확인 (기존과 동일)
- 분석 완료 시 status: "done" → 기존 플로우 그대로
```

### 2-5. 파일 구조 변경

```
wakain/
├── backend/           # API 서버 (기존)
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── jobs.py      ← Cloud Tasks로 보내는 로직 추가
│   │   │   ├── insights.py
│   │   │   └── library.py
│   │   └── worker.py        ← 기존 (API 서버에서는 미사용)
│   └── requirements.txt
│
├── worker/            # Worker 서비스 (신규)
│   ├── Dockerfile
│   ├── main.py        ← 분석 엔드포인트
│   ├── analyze.py     ← 기존 worker.py 로직 이동
│   └── requirements.txt
│
├── analyzer/          # 분석 코어 (공유)
│   └── src/
│       └── video_analyzer.py
│
└── frontend/          # 변경 없음
```

### 예상 시간: 반나절 (4~6시간)

---

## Step 3: DEV/PROD 환경 분리

### DEV 환경
```
프론트: dev.wakain.pages.dev (Cloudflare Pages preview)
백엔드: wakain-api-dev (Cloud Run, 별도 서비스)
Worker: wakain-worker-dev (Cloud Run, 별도 서비스)
DB:     Supabase 새 프로젝트 (무료 tier)
큐:     wakain-analysis-dev (Cloud Tasks 별도 큐)
```

### PROD 환경
```
프론트: wakain.site (Cloudflare Pages production)
백엔드: wakain-api (Cloud Run, 기존)
Worker: wakain-worker (Cloud Run)
DB:     Supabase 현재 프로젝트 (향후 Pro 전환)
큐:     wakain-analysis (Cloud Tasks)
```

### 환경변수 관리

```bash
# .env.dev
API_URL=https://wakain-api-dev-xxxxx.run.app
SUPABASE_URL=https://xxxxx.supabase.co  # DEV 프로젝트
SUPABASE_SERVICE_KEY=xxx
GCP_PROJECT=bridge-487513
GCP_LOCATION=asia-northeast3
WORKER_URL=https://wakain-worker-dev-xxxxx.run.app
QUEUE_NAME=wakain-analysis-dev

# .env.prod
API_URL=https://wakain-api-191739349431.asia-northeast3.run.app
SUPABASE_URL=https://btektycyknkqetmfmywc.supabase.co
SUPABASE_SERVICE_KEY=xxx
GCP_PROJECT=bridge-487513
GCP_LOCATION=asia-northeast3
WORKER_URL=https://wakain-worker-xxxxx.run.app
QUEUE_NAME=wakain-analysis
```

### 프론트 빌드
```bash
# DEV
VITE_API_URL=$DEV_API_URL npm run build && wrangler pages deploy dist --branch=dev

# PROD
VITE_API_URL=$PROD_API_URL npm run build && wrangler pages deploy dist --branch=main
```

### 예상 시간: 3~4시간

---

## 주말 타임라인

### 토요일
| 시간 | 작업 | 예상 |
|------|------|------|
| 오전 | Step 1: Vertex AI 전환 + 테스트 | 2~3h |
| 오후 | Step 2: Cloud Tasks + Worker 분리 | 4~6h |

### 일요일
| 시간 | 작업 | 예상 |
|------|------|------|
| 오전 | Step 3: DEV 환경 세팅 + Supabase DEV 프로젝트 | 3~4h |
| 오후 | 통합 테스트 + 기존 기능 회귀 테스트 | 2~3h |

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| Vertex AI SDK 호환 | 사전 확인, 안 되면 vertexai SDK로 교체 |
| Worker 분리 시 import 경로 | analyzer/ 공유 모듈 경로 정리 |
| Cloud Tasks 인증 | OIDC 토큰 + Cloud Run invoker 역할 |
| DEV Supabase 스키마 | pg_dump → pg_restore로 복제 |
| 기존 기능 깨짐 | PROD 배포 전 DEV에서 전체 플로우 테스트 |

---

## 체크리스트

### Step 1 (Vertex AI)
- [ ] `aiplatform.googleapis.com` API 활성화
- [ ] 서비스 계정 Vertex AI User 역할 부여
- [ ] SDK 호환성 확인 (google-genai vs vertexai)
- [ ] 모델명 확인 (gemini-2.0-flash-001)
- [ ] JSON mode (response_schema) Vertex AI 동작 확인
- [ ] 로컬 테스트
- [ ] Cloud Run 배포 + 테스트

### Step 2 (Cloud Tasks + Worker)
- [ ] `cloudtasks.googleapis.com` API 활성화
- [ ] 큐 생성 (wakain-analysis)
- [ ] Worker Dockerfile 작성
- [ ] Worker Cloud Run 배포
- [ ] API 서버 jobs.py → Cloud Tasks 연동
- [ ] Cloud Tasks → Worker 인증 (OIDC)
- [ ] 분석 요청 → 큐 → Worker → 결과 저장 E2E 테스트

### Step 3 (DEV/PROD 분리)
- [ ] Supabase DEV 프로젝트 생성
- [ ] DEV 스키마 복제
- [ ] Cloud Run DEV 서비스 배포 (API + Worker)
- [ ] Cloud Tasks DEV 큐 생성
- [ ] Cloudflare Pages DEV 브랜치 설정
- [ ] 환경변수 분리 (.env.dev / .env.prod)
- [ ] DEV E2E 테스트
- [ ] PROD E2E 회귀 테스트
