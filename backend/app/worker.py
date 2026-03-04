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


def _extract_thumbnails(video_path: str, appeal_structure: dict, job_id: str, recipe: dict | None = None) -> dict:
    """Extract thumbnail frames for each cut using ffmpeg, upload to R2, return URL map."""
    import tempfile
    scenes = appeal_structure.get("scenes", [])
    
    # Fallback: if no appeal_structure scenes, use recipe scenes
    if not scenes and recipe:
        recipe_scenes = recipe.get("video_recipe", {}).get("scenes", [])
        if recipe_scenes:
            scenes = []
            for rs in recipe_scenes:
                scenes.append({
                    "scene_id": rs.get("scene_id", 0),
                    "cuts": [{"cut_id": rs.get("scene_id", 0), "time_range": rs.get("time_range", [0, 0])}],
                })
    
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
        try:
            summary = _build_summary(recipe_json)
        except Exception as exc:
            print(f"[pipeline:{job_id[:8]}] ⚠️ Summary build failed: {exc}", flush=True)
            summary = {}

        # Extract thumbnails for each cut
        thumbnails_json = None
        appeal_json = extra.get("appeal_structure_json") or {}
        if appeal_json and appeal_json.get("scenes"):
            appeal_json = _clamp_appeal_structure(appeal_json, str(video_path))
            extra["appeal_structure_json"] = appeal_json
        recipe_for_thumbs = extra.get("recipe_json") or recipe_json
        if appeal_json or recipe_for_thumbs:
            try:
                thumb_map = _extract_thumbnails(
                    str(video_path), appeal_json, job_id, recipe=recipe_for_thumbs
                )
                if thumb_map:
                    thumbnails_json = thumb_map
                    print(f"[pipeline:{job_id[:8]}] Extracted {len(thumb_map)} thumbnails", flush=True)
            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] Thumbnail extraction failed: {exc}", flush=True)

        # Phase 4d: Persuasion Lens analysis
        persuasion_lens_json = None
        try:
            from src.persuasion_lens import analyze_persuasion_lens
            stt_text = extra.get('stt_json', {}).get('full_transcript', '') if extra.get('stt_json') else ''
            persuasion_lens_json = analyze_persuasion_lens(recipe_json, stt_text or None)
            print(f'[pipeline:{job_id[:8]}] Persuasion lens analysis complete', flush=True)
        except Exception as exc:
            print(f'[pipeline:{job_id[:8]}] Persuasion lens failed (non-fatal): {exc}', flush=True)

        # Save to results table
        try:
            insert_data = {
                "job_id": job_id,
                "recipe_json": recipe_json,
                "summary_json": summary,
                "thumbnails_json": thumbnails_json,
                "persuasion_lens_json": persuasion_lens_json,
            }
            # Merge extra fields, skipping None values that might cause issues
            for k, v in extra.items():
                if v is not None:
                    insert_data[k] = v
            _supabase().table("results").insert(insert_data).execute()
        except Exception as exc:
            print(f"[pipeline:{job_id[:8]}] ⚠️ Results insert failed: {exc}", flush=True)
            import traceback
            traceback.print_exc()
            raise

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
