from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter()


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class WaitlistRequest(BaseModel):
    email: str
    name: str | None = None
    company: str | None = None
    role: str | None = None


@router.post("/waitlist")
async def join_waitlist(body: WaitlistRequest):
    """Add email to waitlist."""
    supabase = get_supabase()
    try:
        supabase.table("waitlist").insert({
            "email": body.email,
            "name": body.name,
            "company": body.company,
            "role": body.role,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "message": "등록되었습니다!"}
