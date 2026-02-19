# WakaIn — AI 숏폼 마케팅 영상 분석 서비스

> 영상 넣으면 → 왜 잘되는지 + 어떻게 복제하는지

## Stack
- Frontend: React + Vite + Tailwind + shadcn/ui → Cloudflare Pages
- Backend: FastAPI → Cloud Run (auto-scaling)
- DB: Supabase (Auth + PostgreSQL)
- Storage: Cloudflare R2 (영상 파일)
- Analysis: video-analyzer pipeline + Gemini API
- Domain: wakain.site
