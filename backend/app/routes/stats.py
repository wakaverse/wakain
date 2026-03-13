"""Stats — aggregate statistics across analyzed videos."""

from __future__ import annotations

from fastapi import APIRouter
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter(prefix="/stats")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@router.get("/dynamics-avg")
async def dynamics_avg():
    """Return the global average of attention_curve.avg across all results."""
    sb = get_supabase()
    resp = (
        sb.table("results")
        .select("recipe_json")
        .not_.is_("recipe_json", "null")
        .execute()
    )

    values: list[float] = []
    for row in resp.data or []:
        rj = row.get("recipe_json")
        if not rj:
            continue
        try:
            avg = rj["visual"]["rhythm"]["attention_curve"]["avg"]
            if isinstance(avg, (int, float)) and avg > 0:
                values.append(float(avg))
        except (KeyError, TypeError):
            continue

    if not values:
        return {"global_avg": 0, "count": 0}

    global_avg = round(sum(values) / len(values), 1)
    return {"global_avg": global_avg, "count": len(values)}
