# WakaIn 배포 가이드

## Architecture

```
[Frontend: React SPA] → Cloudflare Pages (wakain.pages.dev → wakain.site)
[Backend: FastAPI]    → Google Cloud Run (asia-northeast3)
[Database/Auth]       → Supabase (Google OAuth)
```

---

## 1. Environment Variables

### Backend (Cloud Run)

| Variable               | Required | Description                        |
|------------------------|----------|------------------------------------|
| `SUPABASE_URL`         | Yes      | Supabase project URL               |
| `SUPABASE_SERVICE_KEY` | Yes      | Supabase service role key           |
| `GEMINI_API_KEY`       | Yes      | Google Gemini API key (Flash)       |
| `GEMINI_API_KEY_PRO`   | Yes      | Google Gemini API key (Pro)         |
| `ALLOWED_ORIGINS`      | No       | Comma-separated CORS origins. Default: `*`. Production: `https://wakain.site,https://wakain.pages.dev` |
| `PORT`                 | No       | Server port. Default: `8080` (set by Cloud Run automatically) |
| `ANALYZER_DIR`         | No       | Path to video-analyzer. Default: `/app/video-analyzer` in container |

### Frontend (Cloudflare Pages)

| Variable                 | Required | Description                  |
|--------------------------|----------|------------------------------|
| `VITE_SUPABASE_URL`     | Yes      | Supabase project URL          |
| `VITE_SUPABASE_ANON_KEY`| Yes      | Supabase anonymous (public) key|
| `VITE_API_URL`           | Yes      | Backend API URL (Cloud Run)   |

---

## 2. Backend — Cloud Run Deploy

### Prerequisites
- Google Cloud SDK (`gcloud`) installed & authenticated
- Docker (for local testing)

### Steps

```bash
cd backend

# 1. Bundle video-analyzer source into backend/
./build.sh

# 2. Deploy to Cloud Run (Seoul region)
gcloud run deploy wakain-api \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10

# 3. Set environment variables
gcloud run services update wakain-api \
  --region asia-northeast3 \
  --set-env-vars "SUPABASE_URL=<your-url>" \
  --set-env-vars "SUPABASE_SERVICE_KEY=<your-key>" \
  --set-env-vars "GEMINI_API_KEY=<your-key>" \
  --set-env-vars "GEMINI_API_KEY_PRO=<your-key>" \
  --set-env-vars "ALLOWED_ORIGINS=https://wakain.site,https://wakain.pages.dev"
```

### Local Docker Test

```bash
cd backend
./build.sh
docker build -t wakain-api .
docker run -p 8080:8080 --env-file .env wakain-api
# Test: curl http://localhost:8080/api/health
```

---

## 3. Frontend — Cloudflare Pages Deploy

### Prerequisites
- Cloudflare account
- `wrangler` CLI (optional — can use Cloudflare dashboard)

### Cloudflare Dashboard Setup

1. Go to Cloudflare Dashboard → Pages → Create a project
2. Connect your Git repository
3. Build settings:
   - **Framework preset**: None
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
4. Environment variables (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `VITE_API_URL` = your Cloud Run backend URL (e.g., `https://wakain-api-xxxxx-du.a.run.app`)

### Custom Domain (wakain.site)

1. In Cloudflare Pages → Custom domains → Add custom domain
2. Enter `wakain.site`
3. DNS will be configured automatically if domain is on Cloudflare

---

## 4. Supabase Setup

### Google OAuth Configuration

1. **GCP Console** → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard** → Authentication → Providers → Google
4. Enable Google provider
5. Enter Client ID and Client Secret from GCP
6. Add authorized redirect URLs for your frontend:
   - `https://wakain.site`
   - `https://wakain.pages.dev`
   - `http://localhost:5173` (for local dev)

### Database Tables

The following tables should exist in Supabase (created during Phase A):

- **`jobs`**: `id`, `user_id`, `status`, `video_name`, `video_size_mb`, `error_message`, `started_at`, `completed_at`, `created_at`
- **`results`**: `id`, `job_id`, `recipe_json`, `summary_json`, `created_at`

---

## 5. Post-Deploy Checklist

- [ ] Backend health check: `curl https://<cloud-run-url>/api/health`
- [ ] Frontend loads at `https://wakain.site`
- [ ] Google OAuth login works
- [ ] Video upload + analysis pipeline completes
- [ ] CORS: no cross-origin errors in browser console
- [ ] Results page renders correctly
