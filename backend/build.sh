#!/usr/bin/env bash
# Build script for Cloud Run deployment.
# Copies video-analyzer source into backend/ so Docker can bundle it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANALYZER_SRC="${SCRIPT_DIR}/../../video-analyzer"

if [ ! -d "$ANALYZER_SRC" ]; then
  echo "ERROR: video-analyzer not found at $ANALYZER_SRC"
  exit 1
fi

echo "→ Copying video-analyzer into backend/video-analyzer/ ..."
rm -rf "${SCRIPT_DIR}/video-analyzer"
mkdir -p "${SCRIPT_DIR}/video-analyzer/src"

cp "$ANALYZER_SRC/main.py" "${SCRIPT_DIR}/video-analyzer/"
cp "$ANALYZER_SRC/src/"*.py "${SCRIPT_DIR}/video-analyzer/src/"

echo "→ Done. Ready for docker build."
echo ""
echo "Next steps:"
echo "  cd ${SCRIPT_DIR}"
echo "  docker build -t wakain-api ."
echo "  # or: gcloud run deploy wakain-api --source ."
