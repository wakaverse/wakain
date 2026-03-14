"""Normalized data persistence: summary, claims, blocks, scenes."""

import json
import logging

from app.services.storage import _supabase
from app.services.category import _resolve_category_id

logger = logging.getLogger(__name__)


def _build_summary(recipe_json: dict) -> dict:
    """Extract key fields from V2 recipe for quick dashboard rendering."""
    identity = recipe_json.get("identity", {})
    product = recipe_json.get("product", {})
    style = recipe_json.get("style", {})
    visual = recipe_json.get("visual", {})
    scenes = visual.get("scenes", [])
    engagement = recipe_json.get("engagement", {})
    meta = recipe_json.get("meta", {})
    summary_block = recipe_json.get("summary", {})
    script = recipe_json.get("script", {})
    retention = engagement.get("retention_analysis", {})
    dropoff = engagement.get("dropoff_analysis", {})

    return {
        "duration_sec": meta.get("duration"),
        "scene_count": len(scenes),
        "category": identity.get("category") or product.get("category"),
        "platform": identity.get("platform") or meta.get("platform"),
        "style_primary": style.get("primary"),
        "style_secondary": style.get("secondary"),
        "strategy": summary_block.get("strategy"),
        "hook_strength": retention.get("hook_strength"),
        "hook_reason": retention.get("hook_reason"),
        "risk_zones_count": len(dropoff.get("risk_zones", [])),
        "product_name": product.get("name"),
        "brand": product.get("brand"),
        "claims_count": len(product.get("claims", [])),
        "block_count": len(script.get("blocks", [])),
        "flow_order": script.get("flow_order", []),
    }


def _save_normalized_data(result_id: str, recipe_json: dict, job_id: str) -> None:
    """분석 결과를 정규화 테이블(analysis_claims, analysis_blocks, analysis_scenes)에 저장."""
    sb = _supabase()
    category_id = _resolve_category_id(recipe_json)
    product = recipe_json.get("product", {})
    script = recipe_json.get("script", {})

    # ── Claims INSERT ──
    claims = product.get("claims", [])
    claim_rows = []
    for c in claims:
        claim_rows.append({
            "result_id": result_id,
            "claim": c.get("claim", ""),
            "claim_type": c.get("type"),
            "claim_layer": c.get("layer"),
            "verifiable": c.get("verifiable"),
            "source": c.get("source"),
            "translation": c.get("translation"),
            "strategy": c.get("strategy"),
            "category_id": category_id,
        })

    claim_id_map: dict[str, str] = {}  # claim text → DB id
    if claim_rows:
        resp = sb.table("analysis_claims").insert(claim_rows).execute()
        if resp.data:
            for row in resp.data:
                claim_id_map[row["claim"]] = row["id"]
        print(f"[pipeline:{job_id[:8]}] 💾 {len(claim_rows)} claims saved", flush=True)

    # ── Blocks INSERT ──
    blocks = script.get("blocks", [])
    block_rows = []
    for i, b in enumerate(blocks):
        # block → claim FK 연결
        claim_ref = b.get("product_claim_ref", "")
        claim_id = claim_id_map.get(claim_ref)

        alpha = b.get("alpha", {})
        block_rows.append({
            "result_id": result_id,
            "claim_id": claim_id,
            "block_order": i,
            "block_type": b.get("block", ""),
            "block_text": b.get("text", ""),
            "alpha_emotion": alpha.get("emotion"),
            "alpha_structure": alpha.get("structure"),
            "alpha_connection": alpha.get("connection"),
            "product_claim_ref": claim_ref or None,
            "benefit_sub": b.get("benefit_sub"),
            "category_id": category_id,
            "time_range": b.get("time_range"),
        })

    if block_rows:
        sb.table("analysis_blocks").insert(block_rows).execute()
        print(f"[pipeline:{job_id[:8]}] 💾 {len(block_rows)} blocks saved", flush=True)

    # ── Scenes INSERT ──
    scenes = recipe_json.get("visual", {}).get("scenes", [])
    scene_rows = []
    for i, scene in enumerate(scenes):
        tr = scene.get("time_range", [0, 0])
        scene_rows.append({
            "result_id": result_id,
            "category_id": category_id,
            "scene_order": i + 1,
            "time_start": tr[0] if len(tr) > 0 else 0,
            "time_end": tr[1] if len(tr) > 1 else 0,
            "style": scene.get("style"),
            "style_sub": scene.get("style_sub"),
            "role": scene.get("role"),
            "visual_forms": json.dumps(scene.get("visual_forms", [])),
            "block_refs": json.dumps(scene.get("block_refs", [])),
            "description": scene.get("description"),
        })

    if scene_rows:
        try:
            sb.table("analysis_scenes").insert(scene_rows).execute()
            print(f"[pipeline:{job_id[:8]}] 💾 {len(scene_rows)} scenes saved", flush=True)
        except Exception as e:
            logger.warning(f"[pipeline:{job_id[:8]}] scenes insert failed: {e}")
