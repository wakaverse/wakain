import boto3
from datetime import datetime, timezone
from botocore.config import Config as BotoConfig
from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
)
from app.auth import get_current_user

router = APIRouter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )


@router.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user)):
    """List jobs for the authenticated user, ordered by created_at desc."""
    supabase = get_supabase()
    response = (
        supabase.table("jobs")
        .select("*")
        .eq("user_id", user["id"])
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return response.data


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    response = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return response.data


@router.get("/results/{job_id}")
async def get_result(job_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    response = (
        supabase.table("results")
        .select("*")
        .eq("job_id", job_id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Result not found")

    result = response.data

    # Generate presigned video URL from the R2 key stored in jobs.video_url
    job_resp = supabase.table("jobs").select("video_url").eq("id", job_id).single().execute()
    r2_key = job_resp.data.get("video_url") if job_resp.data else None
    if r2_key and r2_key.startswith("uploads/"):
        try:
            result["video_url"] = _s3().generate_presigned_url(
                "get_object",
                Params={"Bucket": R2_BUCKET_NAME, "Key": r2_key},
                ExpiresIn=3600,
            )
        except Exception:
            result["video_url"] = None
    else:
        result["video_url"] = None

    # Generate presigned URLs for thumbnails
    thumb_map = result.get("thumbnails_json")
    if thumb_map and isinstance(thumb_map, dict):
        s3 = _s3()
        thumb_urls = {}
        for cut_key, r2_key in thumb_map.items():
            try:
                thumb_urls[cut_key] = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": R2_BUCKET_NAME, "Key": r2_key},
                    ExpiresIn=3600,
                )
            except Exception:
                pass
        result["thumbnails"] = thumb_urls
    else:
        result["thumbnails"] = {}

    return result


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    """Soft delete a job (set deleted_at timestamp)."""
    supabase = get_supabase()
    # Verify ownership
    job = supabase.table("jobs").select("user_id").eq("id", job_id).single().execute()
    if not job.data or job.data.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    
    supabase.table("jobs").update({
        "deleted_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()
    
    return {"ok": True}
