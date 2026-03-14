import uuid
from pathlib import Path

import boto3
import httpx
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


class AnalyzeUrlRequest(BaseModel):
    video_url: str
    product_name: str | None = None
    product_category: str | None = None
    title: str | None = None
    thumbnail_url: str | None = None
    channel_name: str | None = None
    source_url: str | None = None
    posted_at: str | None = None


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
    background_tasks.add_task(run_analysis, job_id, body.r2_key, body.product_name, body.product_category, source_type="upload")

    return {"job_id": job_id}


MAX_URL_FILE_SIZE = 200 * 1024 * 1024  # 200MB


@router.post("/analyze-url")
async def analyze_video_url(
    body: AnalyzeUrlRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Download video from URL, upload to R2, then start analysis."""
    url = body.video_url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="유효한 URL을 입력해주세요.")

    # Extract filename from URL
    url_path = url.split("?")[0]
    filename = url_path.split("/")[-1] or "video.mp4"
    suffix = Path(filename).suffix.lower()
    if not suffix:
        filename += ".mp4"
        suffix = ".mp4"
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식 '{suffix}'. 지원: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Download video from URL
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            # HEAD check first
            head = await client.head(url)
            content_length = int(head.headers.get("content-length", 0))
            if content_length > MAX_URL_FILE_SIZE:
                raise HTTPException(status_code=413, detail="파일이 너무 큽니다. 최대 200MB.")

            # Download
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"영상 다운로드 실패: HTTP {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"영상 다운로드 실패: {str(e)[:100]}")

    video_bytes = resp.content
    file_size_mb = len(video_bytes) / (1024 * 1024)

    if len(video_bytes) > MAX_URL_FILE_SIZE:
        raise HTTPException(status_code=413, detail="파일이 너무 큽니다. 최대 200MB.")

    # Upload to R2
    r2_key = f"uploads/{uuid.uuid4()}/{filename}"
    s3 = get_s3_client()
    s3.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=r2_key,
        Body=video_bytes,
        ContentType=resp.headers.get("content-type", "video/mp4"),
    )

    # Create job
    job_id = str(uuid.uuid4())
    supabase = get_supabase()
    job_data = {
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "video_name": filename,
        "video_size_mb": round(file_size_mb, 2),
        "video_url": r2_key,
        "product_name": body.product_name,
        "product_category": body.product_category,
    }
    if body.title:
        job_data["title"] = body.title
    if body.thumbnail_url:
        job_data["thumbnail_url"] = body.thumbnail_url
    if body.channel_name:
        job_data["channel_name"] = body.channel_name
    if body.source_url:
        job_data["source_url"] = body.source_url
    if body.posted_at:
        job_data["posted_at"] = body.posted_at
    supabase.table("jobs").insert(job_data).execute()

    background_tasks.add_task(run_analysis, job_id, r2_key, body.product_name, body.product_category, source_type="url")

    return {"job_id": job_id, "filename": filename, "file_size_mb": round(file_size_mb, 2)}
