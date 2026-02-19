import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ directory
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://btektycyknkqetmfmywc.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_KEY_PRO = os.getenv("GEMINI_API_KEY_PRO")

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm"}

# Path to video-analyzer project (used by subprocess worker)
ANALYZER_DIR = os.getenv(
    "ANALYZER_DIR",
    str(Path(__file__).parent.parent.parent.parent / "video-analyzer"),
)

# Temp dir for uploaded videos
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Output dir for pipeline results
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
