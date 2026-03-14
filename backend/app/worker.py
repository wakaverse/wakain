"""Background worker: runs V2 pipeline directly, saves results to Supabase."""

import asyncio
import json
import logging
import math
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

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

logger = logging.getLogger(__name__)


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

def _generate_cover_thumbnail(video_path: str, job_id: str) -> None:
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
            _update_job(job_id, thumbnail_url=r2_key)
            print(f"[pipeline:{job_id[:8]}] Cover thumbnail uploaded: {r2_key}", flush=True)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


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

        # ── V2 Pipeline: direct async call ──────────────────────────────────
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

        # Extract cover thumbnail (mid-point frame) for project listing
        try:
            _generate_cover_thumbnail(str(video_path), job_id)
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
                # Non-fatal: don't fail the job

        # ── R23: content_dna + brand + channel 자동 생성 ──
        if result_id and recipe_json:
            try:
                # T3: Brand 매칭/생성
                brand_name = recipe_json.get("product", {}).get("brand")
                category_id = _resolve_category_id(recipe_json)
                brand_id = _match_or_create_brand(brand_name, category_id)

                # T4: Channel 추출 (URL 분석 시)
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

                # T2: content_dna 생성
                _build_content_dna(result_id, job_id, recipe_json, brand_id, channel_id, source_url)

            except Exception as exc:
                print(f"[pipeline:{job_id[:8]}] ⚠️ content_dna build failed: {exc}", flush=True)
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


# ── T3: Brand 자동 매칭/생성 ─────────────────────────────────────────────


def _match_or_create_brand(brand_name: str | None, category_id: str | None) -> str | None:
    """brands 테이블에서 name/aliases 매칭 시도, 실패 시 신규 INSERT. brand_id 반환."""
    if not brand_name or not brand_name.strip():
        return None

    brand_name = brand_name.strip()
    sb = _supabase()

    # 1) name 정확 매칭 (case-insensitive)
    try:
        resp = sb.table("brands").select("id").ilike("name", brand_name).limit(1).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 2) aliases 배열에 포함 여부 (PostgreSQL ANY)
    try:
        resp = (
            sb.table("brands")
            .select("id")
            .filter("aliases", "cs", f'{{{brand_name}}}')
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 3) 매칭 실패 → 신규 brand INSERT
    try:
        row = {"name": brand_name, "category_id": category_id}
        resp = sb.table("brands").insert(row).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception as e:
        logger.warning(f"[brand] insert failed: {e}")

    return None


# ── T4: Channel 추출 (URL 파싱) ──────────────────────────────────────────

_PLATFORM_PATTERNS = {
    "instagram": re.compile(
        r"instagram\.com/(?:reel|reels|p)/[^/?]+",
        re.IGNORECASE,
    ),
    "tiktok": re.compile(
        r"tiktok\.com/@([^/]+)/video/",
        re.IGNORECASE,
    ),
    "youtube": re.compile(
        r"(?:youtube\.com|youtu\.be)/",
        re.IGNORECASE,
    ),
}


def _extract_channel_from_url(source_url: str | None) -> tuple[str | None, str | None, str | None]:
    """source_url에서 (platform, channel_url, channel_name) 추출.

    Returns (None, None, None) if not parseable.
    """
    if not source_url:
        return None, None, None

    url = source_url.strip()

    # Instagram: instagram.com/reel/xxx → instagram.com/{username}
    if "instagram.com" in url:
        # URL 구조: instagram.com/{username}/reel/xxx 또는 instagram.com/reel/xxx
        parsed = urlparse(url)
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        # /reel/CODE 형태 → username 추출 불가
        # /{username}/reel/CODE 형태
        if len(parts) >= 2 and parts[1] in ("reel", "reels", "p"):
            username = parts[0]
            channel_url = f"instagram.com/{username}"
            return "instagram", channel_url, username
        return "instagram", None, None

    # TikTok: tiktok.com/@user/video/xxx → tiktok.com/@user
    if "tiktok.com" in url:
        m = _PLATFORM_PATTERNS["tiktok"].search(url)
        if m:
            username = m.group(1)
            channel_url = f"tiktok.com/@{username}"
            return "tiktok", channel_url, f"@{username}"
        return "tiktok", None, None

    # YouTube: channel 추출 어려움 → null 허용
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube", None, None

    return None, None, None


def _upsert_channel(
    platform: str | None,
    channel_url: str | None,
    channel_name: str | None,
    brand_id: str | None = None,
) -> str | None:
    """channels 테이블에 UPSERT (channel_url 기준). channel_id 반환."""
    if not channel_url:
        return None

    sb = _supabase()

    # 기존 채널 조회
    try:
        resp = sb.table("channels").select("id").eq("channel_url", channel_url).limit(1).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception:
        pass

    # 신규 INSERT
    try:
        row = {
            "platform": platform or "unknown",
            "channel_url": channel_url,
            "channel_name": channel_name,
            "brand_id": brand_id,
        }
        resp = sb.table("channels").insert(row).execute()
        if resp.data:
            return resp.data[0]["id"]
    except Exception as e:
        logger.warning(f"[channel] insert failed: {e}")

    return None


# ── T2: content_dna 자동 생성 ────────────────────────────────────────────


def _calc_first_3s_dynamics(recipe_json: dict) -> float | None:
    """첫 3초 어텐션 커브 평균."""
    try:
        points = recipe_json["visual"]["rhythm"]["attention_curve"]["points"]
        vals = [p["score"] for p in points if p["t"] <= 3.0]
        return round(sum(vals) / len(vals), 1) if vals else None
    except (KeyError, TypeError, ZeroDivisionError):
        return None


def _calc_dynamics_stats(recipe_json: dict) -> tuple[float | None, float | None]:
    """어텐션 커브에서 dynamics_avg, dynamics_std 계산."""
    try:
        points = recipe_json["visual"]["rhythm"]["attention_curve"]["points"]
        scores = [p["score"] for p in points]
        if not scores:
            return None, None
        avg = sum(scores) / len(scores)
        variance = sum((s - avg) ** 2 for s in scores) / len(scores)
        return round(avg, 1), round(math.sqrt(variance), 1)
    except (KeyError, TypeError):
        return None, None


def _calc_appeal_distribution(recipe_json: dict) -> dict | None:
    """claims의 claim_type별 비율 계산."""
    try:
        claims = recipe_json.get("product", {}).get("claims", [])
        if not claims:
            return None
        type_counts: dict[str, int] = {}
        for c in claims:
            ct = c.get("type")
            if ct:
                type_counts[ct] = type_counts.get(ct, 0) + 1
        total = sum(type_counts.values())
        if total == 0:
            return None
        return {k: round(v / total, 2) for k, v in type_counts.items()}
    except (KeyError, TypeError):
        return None


def _has_text_overlay(recipe_json: dict) -> bool | None:
    """P4 classify frames에서 has_text 여부 확인. recipe_json에서는 scenes의 production.text_usage로 판단."""
    try:
        scenes = recipe_json.get("visual", {}).get("scenes", [])
        for s in scenes:
            prod = s.get("production", {})
            text_usage = prod.get("text_usage")
            if text_usage and text_usage not in ("none", "없음"):
                return True
        return False
    except (KeyError, TypeError):
        return None


def _build_content_dna(
    result_id: str,
    job_id: str,
    recipe_json: dict,
    brand_id: str | None,
    channel_id: str | None,
    source_url: str | None,
) -> None:
    """recipe_json에서 content_dna 1행 생성."""
    sb = _supabase()

    identity = recipe_json.get("identity", {})
    product = recipe_json.get("product", {})
    meta = recipe_json.get("meta", {})
    script = recipe_json.get("script", {})
    visual = recipe_json.get("visual", {})
    engagement = recipe_json.get("engagement", {})
    retention = engagement.get("retention_analysis", {})
    rhythm = visual.get("rhythm", {})
    human = meta.get("human_presence", {})
    audio = meta.get("audio", {})

    # 분류 축
    category = identity.get("category") or product.get("category")
    subcategory = identity.get("sub_category") or product.get("sub_category")
    # platform: identity에서 우선, 없으면 URL에서 추출
    platform = identity.get("platform") or meta.get("platform")
    if not platform and source_url:
        p, _, _ = _extract_channel_from_url(source_url)
        platform = p
    duration = meta.get("duration")

    # 구조 DNA
    blocks = script.get("blocks", [])
    block_sequence = [b.get("block", "") for b in blocks]
    block_count = len(blocks)
    appeal_distribution = _calc_appeal_distribution(recipe_json)
    style_distribution = visual.get("style_distribution") or None

    # 훅 DNA
    hook_scan = retention.get("hook_scan", {}) or {}
    hook_type = hook_scan.get("hook_type") if hook_scan else None
    hook_strength = retention.get("hook_strength")
    first_3s_dynamics = _calc_first_3s_dynamics(recipe_json)
    product_first_appear = meta.get("product_first_appear")

    # 리듬 DNA
    cut_count = rhythm.get("total_cuts")
    cut_avg_duration = rhythm.get("avg_cut_duration")
    cut_rhythm_val = rhythm.get("cut_rhythm")
    dynamics_avg, dynamics_std = _calc_dynamics_stats(recipe_json)

    # 혼동 변수
    human_type = human.get("type")
    has_person = human_type not in (None, "none")
    person_role = human_type if has_person else None
    face_exposure = human.get("face_exposure")
    face_visible = face_exposure not in (None, "none") if face_exposure else None
    voice_type = audio.get("voice", {}).get("type")
    bgm_genre = audio.get("music", {}).get("genre")
    has_text_ov = _has_text_overlay(recipe_json)

    # job에서 user_id, organization_id 조회
    user_id = None
    organization_id = None
    try:
        job_resp = sb.table("jobs").select("user_id, organization_id").eq("id", job_id).limit(1).execute()
        if job_resp.data:
            user_id = job_resp.data[0].get("user_id")
            organization_id = job_resp.data[0].get("organization_id")
    except Exception:
        pass

    row = {
        "result_id": result_id,
        "job_id": job_id,
        "organization_id": organization_id,
        "user_id": user_id,
        "brand_id": brand_id,
        "channel_id": channel_id,
        # 분류
        "category": category,
        "subcategory": subcategory,
        "platform": platform,
        "duration": duration,
        # 구조 DNA
        "block_sequence": block_sequence or None,
        "block_count": block_count,
        "appeal_distribution": json.dumps(appeal_distribution) if appeal_distribution else None,
        "style_distribution": json.dumps(style_distribution) if style_distribution else None,
        # 훅 DNA
        "hook_type": hook_type,
        "hook_strength": hook_strength,
        "first_3s_dynamics": first_3s_dynamics,
        "product_first_appear": product_first_appear,
        # 리듬 DNA
        "cut_count": cut_count,
        "cut_avg_duration": cut_avg_duration,
        "cut_rhythm": cut_rhythm_val,
        "dynamics_avg": dynamics_avg,
        "dynamics_std": dynamics_std,
        # 혼동 변수
        "has_person": has_person,
        "person_role": person_role,
        "face_visible": face_visible,
        "voice_type": voice_type,
        "bgm_genre": bgm_genre,
        "has_text_overlay": has_text_ov,
        "channel_followers": None,  # channels에서 나중에 업데이트
        "trend_tag": None,  # 추후 연동
    }

    # None 값 제거 (Supabase가 null로 처리)
    row = {k: v for k, v in row.items() if v is not None}
    # 필수 FK는 유지
    row.setdefault("result_id", result_id)
    row.setdefault("job_id", job_id)

    sb.table("content_dna").insert(row).execute()
    print(f"[pipeline:{job_id[:8]}] 💾 content_dna saved", flush=True)
