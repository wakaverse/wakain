from fastapi import HTTPException, Request
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY


async def get_current_user(request: Request) -> dict:
    """Extract and verify user from Supabase JWT in Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    token = auth_header.split(" ", 1)[1]
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    try:
        resp = sb.auth.get_user(token)
        if not resp.user:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        return {"id": resp.user.id, "email": resp.user.email}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="인증에 실패했습니다")
