"""Background worker: runs video-analyzer pipeline via subprocess, saves results to Supabase."""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    ANALYZER_DIR,
    OUTPUT_DIR,
)


def _supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_job(job_id: str, **fields) -> None:
    _supabase().table("jobs").update(fields).eq("id", job_id).execute()


def run_analysis(job_id: str, video_path: str) -> None:
    """Run full video-analyzer pipeline and persist results to Supabase."""
    output_dir = str(OUTPUT_DIR / job_id)

    # Mark job as processing
    _update_job(job_id, status="processing", started_at=_now())

    try:
        # Use the current Python interpreter (works in both local and container)
        python_bin = sys.executable

        result = subprocess.run(
            [
                python_bin,
                "main.py",
                "analyze",
                video_path,
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
        # Clean up uploaded video
        try:
            Path(video_path).unlink(missing_ok=True)
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
