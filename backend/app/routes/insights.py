"""Category insights — aggregate analysis patterns per product category."""

from __future__ import annotations

from collections import Counter, defaultdict

from fastapi import APIRouter, HTTPException
from supabase import create_client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

router = APIRouter(prefix="/insights")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


APPEAL_TYPE_KO = {
    "myth_bust": "통념 깨기",
    "ingredient": "성분/원재료",
    "manufacturing": "제조 공법",
    "track_record": "실적/수상",
    "price": "가격 어필",
    "comparison": "비교",
    "guarantee": "보증/자신감",
    "origin": "원산지",
    "feature_demo": "기능 시연",
    "spec_data": "스펙/수치",
    "design_aesthetic": "디자인",
    "authenticity": "진정성",
    "social_proof": "사회적 증거",
    "urgency": "긴급/한정",
    "lifestyle": "라이프스타일",
    "nostalgia": "향수/추억",
    "authority": "전문성/권위",
    "emotional": "공감",
}

ELEMENT_KO = {
    "authority": "①권위",
    "hook": "②훅",
    "sensory_description": "③묘사",
    "simplicity": "④간편",
    "process": "⑤과정",
    "social_proof": "⑥증거",
    "cta": "⑦CTA",
}

ALPHA_LAYER_MAP = {
    "emotion": "감정",
    "structure": "구조",
    "connection": "연결",
}


def _fetch_all_results():
    """Fetch all results with product_json from Supabase (paginated)."""
    sb = get_supabase()
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table("results")
            .select("id, product_json, recipe_json")
            .not_.is_("product_json", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not resp.data:
            break
        all_rows.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size
    return all_rows


def _categorize_rows(rows):
    """Group rows by category_ko from product_json."""
    by_cat: dict[str, list] = defaultdict(list)
    for row in rows:
        pj = row.get("product_json")
        if not pj or not isinstance(pj, dict):
            continue
        cat = pj.get("category_ko") or pj.get("category")
        if not cat:
            continue
        by_cat[cat].append(row)
    return by_cat


@router.get("/categories")
async def list_categories():
    rows = _fetch_all_results()
    by_cat = _categorize_rows(rows)
    result = [
        {"category": cat, "count": len(items)}
        for cat, items in sorted(by_cat.items(), key=lambda x: -len(x[1]))
    ]
    return result


@router.get("/category/{category_name}")
async def category_detail(category_name: str):
    rows = _fetch_all_results()
    by_cat = _categorize_rows(rows)

    items = by_cat.get(category_name)
    if not items:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")

    video_count = len(items)

    # Aggregate appeal types
    appeal_counter: Counter = Counter()
    element_counter: Counter = Counter()
    flow_counter: Counter = Counter()
    alpha_counters: dict[str, Counter] = {
        "emotion": Counter(),
        "structure": Counter(),
        "connection": Counter(),
    }

    for row in items:
        rj = row.get("recipe_json")
        if not rj or not isinstance(rj, dict):
            continue

        vr = rj.get("video_recipe", {})
        pa = vr.get("persuasion_analysis", {})

        # Appeal types
        for appeal in pa.get("appeal_types", []):
            atype = appeal if isinstance(appeal, str) else appeal.get("type", "")
            if atype:
                appeal_counter[atype] += 1

        # Script analysis — 7 elements
        sa = vr.get("script_analysis", {})
        flow_order = sa.get("flow_order", [])
        for elem_obj in sa.get("elements", []):
            etype = elem_obj.get("type", "") if isinstance(elem_obj, dict) else str(elem_obj)
            if etype:
                element_counter[etype] += 1

        if flow_order:
            flow_str = "→".join(flow_order)
            flow_counter[flow_str] += 1

        # Alpha techniques
        alpha = vr.get("script_alpha", {})
        for layer_key in ("emotion", "structure", "connection"):
            layer_data = alpha.get(layer_key, {})
            techniques = layer_data.get("techniques", [])
            for tech in techniques:
                ttype = tech.get("type", "") if isinstance(tech, dict) else str(tech)
                if ttype:
                    alpha_counters[layer_key][ttype] += 1

    # Build appeal distribution
    appeal_distribution = []
    for atype, count in appeal_counter.most_common():
        appeal_distribution.append({
            "type": atype,
            "label": APPEAL_TYPE_KO.get(atype, atype),
            "count": count,
            "percentage": round(count / video_count * 100),
        })

    # Build element usage
    element_usage = []
    for etype in ["authority", "hook", "sensory_description", "simplicity", "process", "social_proof", "cta"]:
        count = element_counter.get(etype, 0)
        element_usage.append({
            "element": etype,
            "label": ELEMENT_KO.get(etype, etype),
            "count": count,
            "percentage": round(count / video_count * 100) if video_count else 0,
        })

    # Flow patterns top 5
    flow_patterns = [
        {"flow": flow, "count": cnt}
        for flow, cnt in flow_counter.most_common(5)
    ]

    # Alpha techniques
    alpha_techniques = {}
    for layer_key in ("emotion", "structure", "connection"):
        alpha_techniques[layer_key] = [
            {"type": ttype, "label": ttype, "count": cnt}
            for ttype, cnt in alpha_counters[layer_key].most_common(10)
        ]

    # Sample videos (up to 10)
    sample_videos = []
    for row in items[:10]:
        pj = row.get("product_json", {})
        sample_videos.append({
            "job_id": row.get("id", ""),
            "product_name": pj.get("product_name", ""),
            "title": pj.get("product_name", ""),
        })

    return {
        "category": category_name,
        "video_count": video_count,
        "appeal_distribution": appeal_distribution,
        "element_usage": element_usage,
        "flow_patterns": flow_patterns,
        "alpha_techniques": alpha_techniques,
        "sample_videos": sample_videos,
    }
