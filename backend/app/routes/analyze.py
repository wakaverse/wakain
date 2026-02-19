import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from supabase import create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    UPLOAD_DIR,
)
from app.auth import get_current_user
from app.worker import run_analysis

router = APIRouter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@router.post("/analyze")
async def analyze_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    # Validate extension
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max 100MB.",
        )

    # Save to temp file
    job_id = str(uuid.uuid4())
    video_path = UPLOAD_DIR / f"{job_id}{suffix}"
    video_path.write_bytes(content)

    # Create job record in Supabase
    supabase = get_supabase()
    size_mb = len(content) / (1024 * 1024)
    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "video_name": file.filename,
        "video_size_mb": round(size_mb, 2),
    }).execute()

    # Start background analysis
    background_tasks.add_task(run_analysis, job_id, str(video_path))

    return {"job_id": job_id}
