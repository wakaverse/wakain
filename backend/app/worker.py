"""Background worker: runs video-analyzer pipeline via subprocess, saves results to Supabase."""

import json
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
    ANALYZER_DIR,
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


def run_analysis(job_id: str, r2_key: str) -> None:
    """Download video from R2, run pipeline, persist results, clean up."""
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

        # Use the current Python interpreter (works in both local and container)
        python_bin = sys.executable

        result = subprocess.run(
            [
                python_bin,
                "main.py",
                "analyze",
                str(video_path),
                "--output",
                output_dir,
            ],
            capture_output=True,
            text=True,
            cwd=ANALYZER_DIR,
            timeout=600,  # 10 min hard limit
        )

        if result.returncode != 0:
            error_msg = result.stderr[-2000:] if result.stderr else "Pipeline exited non-zero"
            _update_job(
                job_id,
                status="failed",
                completed_at=_now(),
                error_message=error_msg,
            )
            return

        # Find the recipe JSON produced by the pipeline.
        # The pipeline's _resolve_output_dir avoids double-nesting when output_dir already
        # ends with the video stem (job_id), so the recipe lives directly in output_dir/.
        video_name = Path(video_path).stem
        recipe_path = Path(output_dir) / f"{video_name}_video_recipe.json"
        if not recipe_path.exists():
            # Fallback: pipeline may have nested further
            recipe_path = Path(output_dir) / video_name / f"{video_name}_video_recipe.json"

        if not recipe_path.exists():
            _update_job(
                job_id,
                status="failed",
                completed_at=_now(),
                error_message=f"Recipe file not found at {recipe_path}",
            )
            return

        recipe_json = json.loads(recipe_path.read_text(encoding="utf-8"))

        # Build a lightweight summary for fast loading
        summary = _build_summary(recipe_json)

        # Save to results table
        _supabase().table("results").insert({
            "job_id": job_id,
            "recipe_json": recipe_json,
            "summary_json": summary,
        }).execute()

        # Mark job completed
        _update_job(job_id, status="completed", completed_at=_now())

    except subprocess.TimeoutExpired:
        _update_job(
            job_id,
            status="failed",
            completed_at=_now(),
            error_message="Pipeline timed out (>10 min)",
        )
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
        # Clean up video from R2 (privacy)
        try:
            _s3().delete_object(Bucket=R2_BUCKET_NAME, Key=r2_key)
        except Exception:
            pass


def _build_summary(recipe_json: dict) -> dict:
    """Extract key fields for quick dashboard rendering."""
    recipe = recipe_json.get("video_recipe", recipe_json)
    meta = recipe.get("meta", {})
    effectiveness = recipe.get("effectiveness_assessment", {})
    structure = recipe.get("structure", {})
    scenes = recipe.get("scenes", [])
    return {
        "duration_sec": meta.get("duration"),
        "scene_count": len(scenes),
        "category": meta.get("category"),
        "platform": meta.get("platform"),
        "structure_type": structure.get("type"),
        "overall_score": effectiveness.get("viral_potential_score"),
        "strengths": effectiveness.get("strengths", [])[:3],
        "weaknesses": effectiveness.get("weaknesses", [])[:3],
        "improvement_suggestions": effectiveness.get("improvement_suggestions", [])[:3],
    }
