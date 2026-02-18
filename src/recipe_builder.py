"""Phase 5: Recipe builder — merge Track 1 (scenes) + Track 2 (video analysis).

Produces the final video_recipe JSON matching the Layer 3 schema.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from .schemas import (
    Audio,
    BrandVisibility,
    EffectivenessAssessment,
    Meta,
    Music,
    ProductStrategy,
    Scene,
    SceneSequenceItem,
    SFX,
    Structure,
    TextUsage,
    VideoRecipe,
    VisualStyle,
    Voice,
)

# ── Normalization maps for LLM outputs ──────────────────────────────────────

_PLATFORM_MAP = {
    "tiktok": "tiktok", "reels": "reels", "shorts": "shorts", "ad": "ad",
    "instagram reels": "reels", "youtube shorts": "shorts",
}

_CATEGORY_MAP = {
    "beauty": "beauty", "food": "food", "tech": "tech", "fashion": "fashion",
    "health": "health", "home": "home", "finance": "finance", "education": "education",
    "food & beverage": "food", "food_beverage": "food",
    "skincare": "beauty", "cosmetics": "beauty",
    "technology": "tech", "electronics": "tech",
    "fitness": "health", "wellness": "health",
}

_STRUCTURE_TYPE_MAP = {
    "problem_solution": "problem_solution", "before_after": "before_after",
    "demo": "demo", "review": "review", "listicle": "listicle",
    "story": "story", "trend_ride": "trend_ride",
    "demonstration": "demo", "product_demo": "demo",
    "problem/solution": "problem_solution", "problem solution": "problem_solution",
}

_MUSIC_GENRE_MAP = {
    "upbeat_pop": "upbeat_pop", "lo_fi": "lo_fi", "dramatic": "dramatic",
    "trending_sound": "trending_sound", "acoustic": "acoustic", "edm": "edm", "none": "none",
    "n/a": "none", "no music": "none",
}

_ENERGY_PROFILE_MAP = {
    "steady": "steady", "building": "building", "drop": "drop", "calm_to_hype": "calm_to_hype",
    "n/a": "steady",
}

_VOICE_TYPE_MAP = {
    "narration": "narration", "dialogue": "dialogue", "voiceover": "voiceover",
    "tts": "tts", "none": "none",
    "female": "voiceover", "male": "voiceover",
    "female voiceover": "voiceover", "male voiceover": "voiceover",
    "n/a": "none",
}

_VOICE_TONE_MAP = {
    "conversational": "conversational", "professional": "professional",
    "excited": "excited", "asmr": "asmr", "storytelling": "storytelling",
    "informative": "professional", "enthusiastic": "excited",
}

_SFX_FREQ_MAP = {
    "heavy": "heavy", "moderate": "moderate", "minimal": "minimal", "none": "none",
    "n/a": "none",
}

_REVEAL_TIMING_MAP = {
    "immediate": "immediate", "gradual": "gradual", "delayed_reveal": "delayed_reveal",
    "teaser": "teaser", "early": "immediate",
}

_DEMO_METHOD_MAP = {
    "in_use": "in_use", "comparison": "comparison", "transformation": "transformation",
    "testimonial": "testimonial", "spec_highlight": "spec_highlight", "unboxing": "unboxing",
    "demonstration": "in_use", "demo": "in_use",
}

_PRICE_FRAMING_MAP = {
    "discount": "discount", "per_day": "per_day", "vs_competitor": "vs_competitor",
    "bundle": "bundle", "none": "none",
    "secret": "discount", "special": "discount", "exclusive": "discount",
}

_SOCIAL_PROOF_MAP = {
    "reviews": "reviews", "ugc": "ugc", "numbers": "numbers",
    "celebrity": "celebrity", "expert": "expert", "none": "none",
    "n/a": "none",
}

_URGENCY_MAP = {
    "time_limit": "time_limit", "stock_limit": "stock_limit",
    "trend": "trend", "none": "none",
    "hurry": "time_limit", "limited": "stock_limit",
}

_ASPECT_RATIO_MAP = {
    "9:16": "9:16", "1:1": "1:1", "16:9": "16:9",
}

_COLOR_GRADING_MAP = {
    "warm_filter": "warm_filter", "natural": "natural", "high_contrast": "high_contrast",
    "desaturated": "desaturated", "brand_color_heavy": "brand_color_heavy",
}

_BRIGHTNESS_PROFILE_MAP = {
    "consistent": "consistent", "dark_to_bright": "dark_to_bright",
    "bright_to_dark": "bright_to_dark", "varied": "varied",
}

_TRANSITION_STYLE_MAP = {
    "hard_cut": "hard_cut", "fade": "fade", "swipe": "swipe",
    "zoom": "zoom", "mixed": "mixed",
}


def _normalize(value: str, mapping: dict[str, str], default: str) -> str:
    """Normalize a string value using a lookup map (case-insensitive)."""
    lower = value.lower().strip()
    if lower in mapping:
        return mapping[lower]
    # Fuzzy: check if any key is contained in value
    for key, mapped in mapping.items():
        if key in lower:
            return mapped
    return default


def _compute_visual_style(scenes: list[Scene]) -> VisualStyle:
    """Derive visual_style from scene data."""
    if not scenes:
        raise ValueError("No scenes to build visual style from")

    total_duration = sum(s.duration for s in scenes)

    # Overall mood = most common color_mood across scenes
    mood_counts = Counter(s.visual_summary.color_mood for s in scenes)
    overall_mood = mood_counts.most_common(1)[0][0]

    # Color palette: collect unique dominant colors from scene data (not available
    # directly, so we use mood as a proxy and leave palette minimal)
    color_palette: list[str] = []

    # Color grading from mood
    mood_to_grading = {
        "warm_cozy": "warm_filter",
        "cool_professional": "natural",
        "vibrant_energetic": "high_contrast",
        "muted_luxury": "desaturated",
        "natural_organic": "natural",
        "bold_contrast": "high_contrast",
    }
    color_grading = mood_to_grading.get(overall_mood, "natural")

    # Brightness profile: check if there's a clear trend
    brightness_profile = "consistent"

    # Cut stats
    total_cuts = sum(s.visual_summary.cut_count for s in scenes)
    cut_intervals = [s.visual_summary.avg_cut_interval for s in scenes if s.visual_summary.cut_count > 0]
    avg_cut_interval = round(sum(cut_intervals) / len(cut_intervals), 2) if cut_intervals else total_duration

    # Transition style (from motion levels)
    motion_counts = Counter(s.visual_summary.motion_level for s in scenes)
    dominant_motion = motion_counts.most_common(1)[0][0]
    if dominant_motion == "jump_cut":
        transition_style = "hard_cut"
    elif dominant_motion in ("fast", "moderate"):
        transition_style = "hard_cut"
    else:
        transition_style = "mixed"

    # Text usage
    scenes_with_text = sum(1 for s in scenes if s.content_summary.text_overlays)
    if scenes_with_text == len(scenes):
        text_freq = "every_scene"
    elif scenes_with_text > len(scenes) * 0.5:
        text_freq = "key_moments"
    elif scenes_with_text > 0:
        text_freq = "minimal"
    else:
        text_freq = "none"

    text_usage = TextUsage(
        frequency=text_freq,
        style_consistency="high",  # Most shortform ads are consistent
        language_tone="casual",
    )

    # Screen time ratios
    human_time = sum(
        s.duration for s in scenes
        if s.content_summary.subject_type in ("person_with_product", "person_only")
    )
    product_time = sum(
        s.duration for s in scenes
        if s.content_summary.product_visibility in ("full", "in_use", "partial")
    )
    face_time = sum(
        s.duration for s in scenes
        if s.content_summary.subject_type in ("person_with_product", "person_only")
        and s.visual_summary.dominant_shot in ("closeup", "medium")
    )

    return VisualStyle(
        overall_mood=overall_mood,
        color_palette=color_palette,
        color_grading=color_grading,
        brightness_profile=brightness_profile,
        avg_cut_interval=avg_cut_interval,
        total_cuts=total_cuts,
        transition_style=transition_style,
        text_usage=text_usage,
        human_screen_time_ratio=round(human_time / total_duration, 2) if total_duration else 0,
        product_screen_time_ratio=round(product_time / total_duration, 2) if total_duration else 0,
        face_time_ratio=round(face_time / total_duration, 2) if total_duration else 0,
    )


def build_recipe(
    scenes: list[Scene],
    video_analysis: dict,
) -> VideoRecipe:
    """Merge scene data (Track 1) + video analysis (Track 2) into VideoRecipe."""

    # ── Meta (from Track 2) ──────────────────────────────────────────────
    raw_meta = video_analysis.get("meta", {})
    meta = Meta(
        platform=_normalize(raw_meta.get("platform", "ad"), _PLATFORM_MAP, "ad"),
        duration=raw_meta.get("duration", sum(s.duration for s in scenes)),
        aspect_ratio=raw_meta.get("aspect_ratio", "9:16"),
        category=_normalize(raw_meta.get("category", "food"), _CATEGORY_MAP, "food"),
        sub_category=raw_meta.get("sub_category", ""),
        target_audience=raw_meta.get("target_audience", ""),
    )

    # ── Structure (from Track 2, enriched with Track 1 scenes) ───────────
    raw_struct = video_analysis.get("structure", {})
    scene_sequence = [
        SceneSequenceItem(
            role=s.role,
            duration=s.duration,
            technique=s.content_summary.key_action or s.role,
        )
        for s in scenes
    ]

    hook_scenes = [s for s in scenes if s.role == "hook"]
    hook_time = hook_scenes[0].duration if hook_scenes else raw_struct.get("hook_time", 0)

    product_scenes = [
        s for s in scenes
        if s.content_summary.product_visibility in ("full", "in_use", "partial")
    ]
    product_first_appear = product_scenes[0].time_range[0] if product_scenes else raw_struct.get("product_first_appear", 0)

    cta_scenes = [s for s in scenes if s.role == "cta"]
    cta_start = cta_scenes[0].time_range[0] if cta_scenes else raw_struct.get("cta_start", 0)

    structure = Structure(
        type=_normalize(raw_struct.get("type", "demo"), _STRUCTURE_TYPE_MAP, "demo"),
        scene_sequence=scene_sequence,
        hook_time=hook_time,
        product_first_appear=product_first_appear,
        cta_start=cta_start,
    )

    # ── Visual style (from Track 1 scenes) ───────────────────────────────
    visual_style = _compute_visual_style(scenes)

    # ── Audio (from Track 2) ─────────────────────────────────────────────
    raw_audio = video_analysis.get("audio", {})
    raw_music = raw_audio.get("music", {})
    raw_voice = raw_audio.get("voice", {})
    raw_sfx = raw_audio.get("sfx", {})

    audio = Audio(
        music=Music(
            present=raw_music.get("present", False),
            genre=_normalize(raw_music.get("genre", "none"), _MUSIC_GENRE_MAP, "none"),
            energy_profile=_normalize(raw_music.get("energy_profile", "steady"), _ENERGY_PROFILE_MAP, "steady"),
            bpm_range=raw_music.get("bpm_range", "unknown"),
            mood_match=raw_music.get("mood_match", ""),
            beat_sync=raw_music.get("beat_sync", ""),
        ),
        voice=Voice(
            type=_normalize(raw_voice.get("type", "none"), _VOICE_TYPE_MAP, "none"),
            tone=_normalize(raw_voice.get("tone", "conversational"), _VOICE_TONE_MAP, "conversational"),
            language=raw_voice.get("language", "ko"),
            script_summary=raw_voice.get("script_summary", ""),
            hook_line=raw_voice.get("hook_line", ""),
            cta_line=raw_voice.get("cta_line", ""),
        ),
        sfx=SFX(
            used=raw_sfx.get("used", False),
            types=raw_sfx.get("types", []),
            frequency=_normalize(raw_sfx.get("frequency", "none"), _SFX_FREQ_MAP, "none"),
        ),
        audio_visual_sync=raw_audio.get("audio_visual_sync", ""),
    )

    # ── Product strategy (from Track 2) ──────────────────────────────────
    raw_ps = video_analysis.get("product_strategy", {})
    raw_bv = raw_ps.get("brand_visibility", {})

    product_strategy = ProductStrategy(
        reveal_timing=_normalize(raw_ps.get("reveal_timing", "immediate"), _REVEAL_TIMING_MAP, "immediate"),
        demonstration_method=_normalize(raw_ps.get("demonstration_method", "in_use"), _DEMO_METHOD_MAP, "in_use"),
        key_benefit_shown=raw_ps.get("key_benefit_shown", ""),
        price_shown=raw_ps.get("price_shown", False),
        price_framing=_normalize(raw_ps.get("price_framing", "none"), _PRICE_FRAMING_MAP, "none"),
        offer_type=raw_ps.get("offer_type", "none"),
        social_proof=_normalize(raw_ps.get("social_proof", "none"), _SOCIAL_PROOF_MAP, "none"),
        urgency_trigger=_normalize(raw_ps.get("urgency_trigger", "none"), _URGENCY_MAP, "none"),
        brand_visibility=BrandVisibility(
            logo_shown=raw_bv.get("logo_shown", False),
            brand_color_used=raw_bv.get("brand_color_used", False),
            brand_mention_count=raw_bv.get("brand_mention_count", 0),
        ),
    )

    # ── Effectiveness assessment (from Track 2) ──────────────────────────
    raw_ea = video_analysis.get("effectiveness_assessment", {})
    effectiveness = EffectivenessAssessment(
        hook_rating=raw_ea.get("hook_rating", ""),
        flow_rating=raw_ea.get("flow_rating", ""),
        message_clarity=raw_ea.get("message_clarity", ""),
        cta_strength=raw_ea.get("cta_strength", ""),
        replay_factor=raw_ea.get("replay_factor", ""),
        standout_elements=raw_ea.get("standout_elements", []),
        weak_points=raw_ea.get("weak_points", []),
    )

    return VideoRecipe(
        meta=meta,
        structure=structure,
        visual_style=visual_style,
        audio=audio,
        product_strategy=product_strategy,
        effectiveness_assessment=effectiveness,
        scenes=[s for s in scenes],
    )
