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



def _extract_thumbnails(video_path: str, appeal_structure: dict, job_id: str) -> dict:
    """Extract thumbnail frames for each cut using ffmpeg, upload to R2, return URL map."""
    import tempfile
    scenes = appeal_structure.get("scenes", [])
    if not scenes:
        return {}

    s3 = _s3()
    thumb_map = {}  # cutKey -> r2_key

    for scene in scenes:
        for cut in scene.get("cuts", []):
            cut_id = cut.get("cut_id", 0)
            tr = cut.get("time_range", [0, 0])
            mid_t = (tr[0] + tr[1]) / 2
            cut_key = f"{scene['scene_id']}-{cut_id}"

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

        cmd = [
            python_bin,
            "main.py",
            "analyze",
            str(video_path),
            "--output",
            output_dir,
        ]
        if product_name:
            cmd.extend(["--product-name", product_name])
        if product_category:
            cmd.extend(["--product-category", product_category])

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=ANALYZER_DIR,
            env={**__import__('os').environ, "PYTHONUNBUFFERED": "1"},
        )

        # Stream output to Cloud Logging in real-time via print (stdout → Cloud Logging)
        output_lines = []
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                print(f"[pipeline:{job_id[:8]}] {line}", flush=True)
                output_lines.append(line)

        proc.wait(timeout=600)

        if proc.returncode != 0:
            error_msg = "\n".join(output_lines[-50:]) or "Pipeline exited non-zero"
            _update_job(
                job_id,
                status="failed",
                completed_at=_now(),
                error_message=error_msg[-2000:],
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

        # Load additional analysis files (optional — may not exist)
        analysis_dir = recipe_path.parent
        extra = _load_extra_analysis(analysis_dir, video_name)

        # Build a lightweight summary for fast loading
        summary = _build_summary(recipe_json)

        # Extract thumbnails for each cut and embed in appeal_structure_json
        if extra.get("appeal_structure_json"):
            try:
                thumb_map = _extract_thumbnails(
                    str(video_path), extra["appeal_structure_json"], job_id
                )
                if thumb_map:
                    extra["appeal_structure_json"]["thumbnails"] = thumb_map
                    print(f"[pipeline:{job_id[:8]}] Extracted {len(thumb_map)} thumbnails", flush=True)
            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] Thumbnail extraction failed: {exc}", flush=True)

        # Save to results table
        _supabase().table("results").insert({
            "job_id": job_id,
            "recipe_json": recipe_json,
            "summary_json": summary,

            **extra,
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
    """Extract key fields for quick dashboard rendering."""
    recipe = recipe_json.get("video_recipe", recipe_json)
    meta = recipe.get("meta", {})
    effectiveness = recipe.get("effectiveness_assessment", {})
    structure = recipe.get("structure", {})
    scenes = recipe.get("scenes", [])
    dropoff = recipe.get("dropoff_analysis", {})
    performance = recipe.get("performance_metrics", {})
    return {
        "duration_sec": meta.get("duration"),
        "scene_count": len(scenes),
        "category": meta.get("category"),
        "platform": meta.get("platform"),
        "structure_type": structure.get("type"),
        "overall_score": effectiveness.get("viral_potential_score") or effectiveness.get("hook_rating"),
        "retention_score": dropoff.get("overall_retention_score"),
        "attention_avg": performance.get("attention_avg"),
        "strengths": effectiveness.get("standout_elements", effectiveness.get("strengths", []))[:3],
        "weaknesses": effectiveness.get("weak_points", effectiveness.get("weaknesses", []))[:3],
        "improvement_suggestions": effectiveness.get("improvement_suggestions", [])[:3],
    }
