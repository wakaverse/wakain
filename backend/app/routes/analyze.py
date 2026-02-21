import uuid
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
)
from app.auth import get_current_user
from app.worker import run_analysis

router = APIRouter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )


# --- Request / Response models ---

class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    r2_key: str


class AnalyzeRequest(BaseModel):
    r2_key: str
    filename: str
    file_size_mb: float
    product_name: str | None = None
    product_category: str | None = None


# --- Endpoints ---

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    body: UploadUrlRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a presigned PUT URL for direct R2 upload."""
    suffix = Path(body.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    r2_key = f"uploads/{uuid.uuid4()}/{body.filename}"

    s3 = get_s3_client()
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": R2_BUCKET_NAME,
            "Key": r2_key,
            "ContentType": body.content_type,
        },
        ExpiresIn=1800,  # 30 minutes
    )

    return UploadUrlResponse(upload_url=upload_url, r2_key=r2_key)


@router.post("/analyze")
async def analyze_video(
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Start analysis for a video already uploaded to R2."""
    suffix = Path(body.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    if body.file_size_mb > MAX_FILE_SIZE / (1024 * 1024):
        raise HTTPException(status_code=413, detail="File too large. Max 200MB.")

    job_id = str(uuid.uuid4())

    # Create job record in Supabase
    supabase = get_supabase()
    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "video_name": body.filename,
        "video_size_mb": round(body.file_size_mb, 2),
        "video_url": body.r2_key,
        "product_name": body.product_name,
        "product_category": body.product_category,
    }).execute()

    # Start background analysis (worker downloads from R2)
    background_tasks.add_task(run_analysis, job_id, body.r2_key, body.product_name, body.product_category)

    return {"job_id": job_id}
