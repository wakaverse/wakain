"""Appeal type Korean labels and visual technique labels."""

# ── 소구 타입 한국어 라벨 ────────────────────────────────────────────────────

APPEAL_TYPE_KO = {
    # 이성 소구
    "myth_bust": "오해반박",
    "ingredient": "원재료/성분",
    "process": "제조공정",
    "manufacturing": "제조공정",
    "achievement": "실적/수치",
    "track_record": "실적/수상",
    "price": "가격/혜택",
    "comparison": "비교우위",
    "guarantee": "보장/환불",
    "origin": "원산지",
    "specification": "스펙/기능",
    "feature_demo": "기능시연",
    "spec_data": "스펙수치",
    # 감성 소구
    "sensory": "감각자극",
    "design_aesthetic": "디자인감성",
    "authenticity": "진정성/리얼",
    "social_proof": "사회적증거",
    "urgency": "긴급/한정",
    "scarcity": "희소성",
    "lifestyle": "라이프스타일",
    "nostalgia": "향수/추억",
    "authority": "권위/전문가",
    "emotional": "감정호소",
    "brand_story": "브랜드스토리",
    "humor": "유머",
    "surprise": "반전/놀라움",
    "trend": "트렌드",
    "relatability": "공감",
}

# ── 시각 기법 한국어 라벨 ────────────────────────────────────────────────────

VISUAL_TECHNIQUE_KO = {
    "closeup": "클로즈업",
    "zoom_in": "줌인",
    "slow_motion": "슬로모션",
    "process_shot": "공정 촬영",
    "graph_number": "그래프/수치",
    "before_after": "비포/애프터",
    "text_overlay": "텍스트 오버레이",
    "package_shot": "패키지/박스샷",
    "ingredient_shot": "원재료/성분 촬영",
    "lifestyle_shot": "라이프스타일 촬영",
    "split_screen": "화면 분할",
    "unboxing": "언박싱",
    "demo": "시연",
    "reaction": "리액션",
    "review": "리뷰",
    "testimonial": "증언/후기",
    "infographic": "인포그래픽",
    "texture_detail": "질감 디테일",
    "steam_sizzle": "스팀/지글",
    "comparison_shot": "비교 촬영",
    "certificate": "인증서/수상",
    "celebrity": "셀럽/인플루언서",
    "screen_recording": "화면 녹화",
    "timelapse": "타임랩스",
    "overhead": "탑뷰",
    "handheld": "핸드헬드",
    "bokeh": "아웃포커스",
}


def appeal_ko(appeal_type: str) -> str:
    """Get Korean label for appeal type."""
    return APPEAL_TYPE_KO.get(appeal_type, appeal_type)


def technique_ko(technique: str) -> str:
    """Get Korean label for visual technique."""
    return VISUAL_TECHNIQUE_KO.get(technique, technique)


def format_appeal(appeal: dict) -> str:
    """Format a single appeal point into readable Korean string.

    Example: "사회적증거 (클로즈업) — '150억 팔린 조미김' 텍스트로 증명"
    """
    atype = appeal.get("type", "")
    ko = appeal_ko(atype)

    vp = appeal.get("visual_proof", {})
    if isinstance(vp, dict):
        tech = technique_ko(vp.get("technique", ""))
        desc = vp.get("description", "")
        ts = vp.get("timestamp")
        strength = appeal.get("strength", "")

        parts = [ko]
        if tech:
            parts[0] = f"{ko} ({tech})"
        if desc:
            # Truncate long descriptions
            desc_short = desc[:60] + "..." if len(desc) > 60 else desc
            parts.append(f"— {desc_short}")
        if ts is not None:
            parts.append(f"[{ts:.1f}s]")

        return " ".join(parts)
    else:
        return ko
