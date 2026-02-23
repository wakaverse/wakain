#!/usr/bin/env bash
# Build & deploy script for Cloud Run.
# 빌드 컨텍스트: 프로젝트 루트 (Dockerfile은 backend/ 안에 있지만 루트에서 빌드)
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "→ Building from project root: $PROJECT_ROOT"
echo "→ Dockerfile: backend/Dockerfile"
echo "→ Context includes: analyzer/ + backend/"
echo ""

gcloud builds submit \
  --tag asia-northeast3-docker.pkg.dev/bridge-487513/cloud-run-source-deploy/wakain-api:latest \
  --project bridge-487513 \
  --region asia-northeast3 \
  -f backend/Dockerfile \
  .

echo ""
echo "→ Build complete. Deploy with:"
echo "  gcloud run deploy wakain-api \\"
echo "    --image asia-northeast3-docker.pkg.dev/bridge-487513/cloud-run-source-deploy/wakain-api:latest \\"
echo "    --region asia-northeast3 --project bridge-487513"
