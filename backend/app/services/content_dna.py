"""content_dna 자동 생성: recipe_json에서 DNA 지표 추출 후 저장."""

import json
import math

from app.services.storage import _supabase
from app.services.brand_channel import _extract_channel_from_url


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
    """scenes의 production.text_usage로 텍스트 오버레이 여부 판단."""
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
