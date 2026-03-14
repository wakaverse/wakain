"""Thumbnail extraction: scene thumbnails + cover thumbnail."""

import subprocess
from pathlib import Path

from app.config import R2_BUCKET_NAME
from app.services.storage import _s3


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


def _generate_cover_thumbnail(video_path: str, job_id: str, update_job_fn) -> None:
    """Extract mid-point frame as cover thumbnail, upload to R2, update jobs.thumbnail_url."""
    import tempfile

    # Get video duration
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video_path],
        capture_output=True, text=True, timeout=10,
    )
    duration = float(result.stdout.strip())
    mid_t = duration / 2

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(mid_t),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "5",
            "-vf", "scale=480:-1",
            tmp_path,
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)

        if Path(tmp_path).exists() and Path(tmp_path).stat().st_size > 0:
            r2_key = f"thumbnails/{job_id}/cover.jpg"
            _s3().upload_file(
                tmp_path,
                R2_BUCKET_NAME,
                r2_key,
                ExtraArgs={"ContentType": "image/jpeg"},
            )
            update_job_fn(job_id, thumbnail_url=r2_key)
            print(f"[pipeline:{job_id[:8]}] Cover thumbnail uploaded: {r2_key}", flush=True)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass
