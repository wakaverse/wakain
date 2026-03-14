"""Background worker: runs V2 pipeline directly, saves results to Supabase."""

import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from app.config import (
    OUTPUT_DIR,
    UPLOAD_DIR,
    R2_BUCKET_NAME,
)
from app.services.storage import _supabase, _s3
from app.services.thumbnail import _clamp_appeal_structure, _extract_thumbnails, _generate_cover_thumbnail
from app.services.normalized import _build_summary, _save_normalized_data
from app.services.category import _resolve_category_id
from app.services.brand_channel import _match_or_create_brand, _extract_channel_from_url, _upsert_channel
from app.services.content_dna import _build_content_dna

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_job(job_id: str, **fields) -> None:
    _supabase().table("jobs").update(fields).eq("id", job_id).execute()


def run_analysis(job_id: str, r2_key: str, product_name: str | None = None, product_category: str | None = None, source_type: str | None = None) -> None:
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

        # ── V2 Pipeline: direct async call ──
        from core.orchestrator import PipelineConfig, run_pipeline

        config = PipelineConfig(
            video_path=str(video_path),
            output_dir=output_dir,
            gemini_api_key=os.environ.get("GEMINI_API_KEY"),
            gemini_api_key_pro=os.environ.get("GEMINI_API_KEY_PRO"),
            soniox_api_key=os.environ.get("SONIOX_API_KEY"),
            job_id=job_id,
            source_type=source_type,
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
            clamped = _clamp_appeal_structure({"scenes": v2_scenes}, str(video_path))
            v2_scenes = clamped.get("scenes", v2_scenes)
            try:
                thumb_map = _extract_thumbnails(str(video_path), v2_scenes, job_id)
                if thumb_map:
                    thumbnails_json = thumb_map
                    print(f"[pipeline:{job_id[:8]}] Extracted {len(thumb_map)} thumbnails", flush=True)
            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] Thumbnail extraction failed: {exc}", flush=True)

        # Extract cover thumbnail (mid-point frame) for project listing
        try:
            _generate_cover_thumbnail(str(video_path), job_id, _update_job)
        except Exception as exc:
            print(f"[pipeline:{job_id[:8]}] Cover thumbnail failed: {exc}", flush=True)

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

        # ── content_dna + brand + channel 자동 생성 ──
        if result_id and recipe_json:
            try:
                brand_name = recipe_json.get("product", {}).get("brand")
                category_id = _resolve_category_id(recipe_json)
                brand_id = _match_or_create_brand(brand_name, category_id)

                source_url = None
                try:
                    job_resp = _supabase().table("jobs").select("source_url").eq("id", job_id).limit(1).execute()
                    if job_resp.data:
                        source_url = job_resp.data[0].get("source_url")
                except Exception:
                    pass

                channel_id = None
                if source_url:
                    plat, ch_url, ch_name = _extract_channel_from_url(source_url)
                    channel_id = _upsert_channel(plat, ch_url, ch_name, brand_id)

                _build_content_dna(result_id, job_id, recipe_json, brand_id, channel_id, source_url)

            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] ⚠️ content_dna build failed: {exc}", flush=True)
                import traceback
                traceback.print_exc()

        # Log analyze_complete event
        try:
            job_resp = _supabase().table("jobs").select("user_id").eq("id", job_id).limit(1).execute()
            if job_resp.data and job_resp.data[0].get("user_id"):
                _supabase().table("user_activity_logs").insert({
                    "user_id": job_resp.data[0]["user_id"],
                    "action": "analyze_complete",
                    "result_id": result_id,
                    "metadata": {"job_id": job_id},
                }).execute()
        except Exception as exc:
            logger.warning("analyze_complete log failed: %s", exc)

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
