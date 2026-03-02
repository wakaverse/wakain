import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ directory (no-op in container where env vars are set directly)
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://btektycyknkqetmfmywc.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_KEY_PRO = os.getenv("GEMINI_API_KEY_PRO")

# --- RapidAPI (Instagram Looter) ---
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")

MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm"}

# --- Cloudflare R2 (S3-compatible) ---
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "30394601614039e785c78d10d7e0fbc9")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "wakain-videos")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Path to video-analyzer project (used by subprocess worker)
# Default: /app/video-analyzer in container, sibling dir in local dev
ANALYZER_DIR = os.getenv(
    "ANALYZER_DIR",
    "/app/video-analyzer" if os.path.exists("/app/video-analyzer") else str(
        Path(__file__).parent.parent.parent.parent / "video-analyzer"
    ),
)

# Server port (Cloud Run sets PORT env var)
PORT = int(os.getenv("PORT", "8080"))

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Temp dir for uploaded videos
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Output dir for pipeline results
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
