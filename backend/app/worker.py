"""Background worker: runs V2 pipeline directly, saves results to Supabase."""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from supabase import create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    OUTPUT_DIR,
    UPLOAD_DIR,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
)


def _supabase():
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_job(job_id: str, **fields) -> None:
    _supabase().table("jobs").update(fields).eq("id", job_id).execute()




def _clamp_appeal_structure(appeal_structure: dict, video_path: str) -> dict:
    """Clamp appeal_structure scene time_ranges to actual video duration via ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=10
        )
        actual_duration = float(result.stdout.strip())
    except Exception:
        return appeal_structure

    scenes = appeal_structure.get("scenes", [])
    for scene in scenes:
        tr = scene.get("time_range")
        if tr and len(tr) == 2:
            scene["time_range"] = [min(tr[0], actual_duration), min(tr[1], actual_duration)]
        for cut in scene.get("cuts", []):
            ctr = cut.get("time_range")
            if ctr and len(ctr) == 2:
                cut["time_range"] = [min(ctr[0], actual_duration), min(ctr[1], actual_duration)]
    return appeal_structure


def _extract_thumbnails(video_path: str, scenes: list[dict], job_id: str) -> dict:
    """Extract thumbnail frames for each scene using ffmpeg, upload to R2, return URL map."""
    import tempfile

    if not scenes:
        return {}

    s3 = _s3()
    thumb_map = {}  # sceneKey -> r2_key

    for scene in scenes:
        scene_id = scene.get("scene_id", 0)
        tr = scene.get("time_range", [0, 0])
        mid_t = (tr[0] + tr[1]) / 2
        cut_key = f"{scene_id}"

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(mid_t),
                "-i", video_path,
                "-frames:v", "1",
                "-q:v", "5",
                "-vf", "scale=320:-1",
                tmp_path,
            ]
            subprocess.run(cmd, capture_output=True, timeout=10)

            if Path(tmp_path).exists() and Path(tmp_path).stat().st_size > 0:
                r2_thumb_key = f"thumbnails/{job_id}/{cut_key}.jpg"
                s3.upload_file(
                    tmp_path,
                    R2_BUCKET_NAME,
                    r2_thumb_key,
                    ExtraArgs={"ContentType": "image/jpeg"},
                )
                thumb_map[cut_key] = r2_thumb_key
        except Exception:
            pass
        finally:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass

    return thumb_map

def run_analysis(job_id: str, r2_key: str, product_name: str | None = None, product_category: str | None = None) -> None:
    """Download video from R2, run V2 pipeline, persist results, clean up."""
    output_dir = str(OUTPUT_DIR / job_id)

    # Determine local path for downloaded video
    filename = Path(r2_key).name
    suffix = Path(filename).suffix
    video_path = UPLOAD_DIR / f"{job_id}{suffix}"

    # Mark job as processing
    _update_job(job_id, status="processing", started_at=_now())

    try:
        # Download from R2
        s3 = _s3()
        s3.download_file(R2_BUCKET_NAME, r2_key, str(video_path))

        # Downscale to 480p (short side) to save processing time & storage
        downscaled_path = UPLOAD_DIR / f"{job_id}_480p{suffix}"
        try:
            ds_proc = subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(video_path),
                    "-vf", "scale='if(gt(iw,ih),-2,480)':'if(gt(iw,ih),480,-2)'",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    str(downscaled_path),
                ],
                capture_output=True, text=True, timeout=120,
            )
            if ds_proc.returncode == 0 and downscaled_path.exists():
                print(f"[worker:{job_id[:8]}] Downscaled to 480p: {video_path.stat().st_size // 1024}KB -> {downscaled_path.stat().st_size // 1024}KB")
                video_path.unlink()
                downscaled_path.rename(video_path)
            else:
                print(f"[worker:{job_id[:8]}] Downscale failed, using original: {ds_proc.stderr[:200]}")
                if downscaled_path.exists():
                    downscaled_path.unlink()
        except Exception as e:
            print(f"[worker:{job_id[:8]}] Downscale error, using original: {e}")
            if downscaled_path.exists():
                downscaled_path.unlink()

        # ── V2 Pipeline: direct async call ──────────────────────────────────
        from core.orchestrator import PipelineConfig, run_pipeline

        config = PipelineConfig(
            video_path=str(video_path),
            output_dir=output_dir,
            gemini_api_key=os.environ.get("GEMINI_API_KEY"),
            gemini_api_key_pro=os.environ.get("GEMINI_API_KEY_PRO"),
            soniox_api_key=os.environ.get("SONIOX_API_KEY"),
        )

        pipeline_result = asyncio.run(run_pipeline(config))

        if pipeline_result.recipe is None:
            _update_job(
                job_id,
                status="failed",
                completed_at=_now(),
                error_message="V2 pipeline completed but recipe is None",
            )
            return

        recipe_json = pipeline_result.recipe.model_dump(mode="json")

        # Build a lightweight summary for fast loading
        try:
            summary = _build_summary(recipe_json)
        except Exception as exc:
            print(f"[pipeline:{job_id[:8]}] ⚠️ Summary build failed: {exc}", flush=True)
            summary = {}

        # Extract thumbnails from V2 scenes
        thumbnails_json = None
        v2_scenes = recipe_json.get("visual", {}).get("scenes", [])
        if v2_scenes:
            # Clamp time_ranges to actual video duration
            clamped = _clamp_appeal_structure({"scenes": v2_scenes}, str(video_path))
            v2_scenes = clamped.get("scenes", v2_scenes)
            try:
                thumb_map = _extract_thumbnails(str(video_path), v2_scenes, job_id)
                if thumb_map:
                    thumbnails_json = thumb_map
                    print(f"[pipeline:{job_id[:8]}] Extracted {len(thumb_map)} thumbnails", flush=True)
            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] Thumbnail extraction failed: {exc}", flush=True)

        # Save to results table
        try:
            insert_data = {
                "job_id": job_id,
                "recipe_json": recipe_json,
                "summary_json": summary,
                "thumbnails_json": thumbnails_json,
            }
            resp = _supabase().table("results").insert(insert_data).execute()
            result_id = resp.data[0]["id"] if resp.data else None
        except Exception as exc:
            print(f"[pipeline:{job_id[:8]}] ⚠️ Results insert failed: {exc}", flush=True)
            import traceback
            traceback.print_exc()
            raise

        # Save normalized analysis data (claims + blocks)
        if result_id and recipe_json:
            try:
                _save_normalized_data(result_id, recipe_json, job_id)
            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] ⚠️ Normalized data insert failed: {exc}", flush=True)
                import traceback
                traceback.print_exc()
                # Non-fatal: don't fail the job

        # Mark job completed
        _update_job(job_id, status="completed", completed_at=_now())

    except Exception as exc:  # noqa: BLE001
        _update_job(
            job_id,
            status="failed",
            completed_at=_now(),
            error_message=str(exc)[:2000],
        )
    finally:
        # Clean up local video file
        try:
            Path(video_path).unlink(missing_ok=True)
        except Exception:
            pass
        # Keep video in R2 for frontend video player
        # (presigned GET URLs are generated on demand by the results endpoint)


def _load_extra_analysis(analysis_dir: Path, video_name: str) -> dict:
    """Load optional analysis JSON files produced by the pipeline."""
    extra: dict = {}
    file_map = {
        "diagnosis_json": f"{video_name}_diagnosis.json",
        "prescriptions_json": f"{video_name}_prescriptions.json",
        "stt_json": f"{video_name}_stt.json",
        "product_json": f"{video_name}_product.json",
        "appeal_structure_json": f"{video_name}_appeal_structure.json",
        "temporal_json": f"{video_name}_temporal.json",
        "style_json": f"{video_name}_style.json",  # backward compat
        "caption_map_json": f"{video_name}_caption_map.json",
        "verdict_json": f"{video_name}_verdict.json",
    }
    for col, fname in file_map.items():
        fpath = analysis_dir / fname
        if fpath.exists():
            try:
                extra[col] = json.loads(fpath.read_text(encoding="utf-8"))
            except Exception:
                pass
    return extra


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


# ── 카테고리 ID 매핑 ──────────────────────────────────────────────────────

_CATEGORY_KO_TO_ID = {
    "식품": "food", "전자제품": "electronics", "뷰티": "beauty",
    "패션": "fashion", "건강": "health", "건강/의료": "health",
    "생활": "home", "생활/가전": "home", "스포츠": "sports",
    "스포츠/레저": "sports", "교육": "education", "금융": "finance",
    "금융/보험": "finance", "여행": "travel", "유아": "kids",
    "유아/아동": "kids", "반려동물": "pet", "자동차": "auto",
    "엔터테인먼트": "entertainment",
}


def _resolve_category_id(recipe_json: dict) -> str | None:
    """recipe_json에서 카테고리 ID를 추출."""
    identity = recipe_json.get("identity", {})
    cat_ko = identity.get("category_ko", "")
    if not cat_ko:
        return None
    # 정확 매칭
    if cat_ko in _CATEGORY_KO_TO_ID:
        return _CATEGORY_KO_TO_ID[cat_ko]
    # 부분 매칭
    for k, v in _CATEGORY_KO_TO_ID.items():
        if k in cat_ko or cat_ko in k:
            return v
    return "other"


def _save_normalized_data(result_id: str, recipe_json: dict, job_id: str) -> None:
    """분석 결과를 정규화 테이블(analysis_claims, analysis_blocks)에 저장."""
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
