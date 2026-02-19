from fastapi import APIRouter, HTTPException
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    supabase = get_supabase()
    response = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return response.data


@router.get("/results/{job_id}")
async def get_result(job_id: str):
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
    return response.data
