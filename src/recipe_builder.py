"""Phase 5: Recipe builder — merge Track 1 (scenes) + Track 2 (video analysis).

Produces the final video_recipe JSON matching the Layer 3 schema.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Optional

from .schemas import (
    ArtDirection,
    Audio,
    BrandVisibility,
    EffectivenessAssessment,
    FrameQual,
    FrameQuant,
    Meta,
    Music,
    ProductionGuide,
    ProductStrategy,
    Scene,
    SceneSequenceItem,
    SceneTimingGuide,
    SFX,
    Structure,
    TranscriptSegment,
    TemporalAnalysis,
    TemporalProfile,
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
    "dissolve": "fade", "zoom_transition": "zoom",
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


def _compute_visual_style(
    scenes: list[Scene],
    quants: list[FrameQuant] | None = None,
    quals: list[FrameQual] | None = None,
) -> VisualStyle:
    """Derive visual_style from scene data + frame-level data when available."""
    if not scenes:
        raise ValueError("No scenes to build visual style from")

    total_duration = sum(s.duration for s in scenes)

    # Overall mood = most common color_mood across scenes
    mood_counts = Counter(s.visual_summary.color_mood for s in scenes)
    overall_mood = mood_counts.most_common(1)[0][0]

    # Color palette: collect from scenes' enriched visual_summary
    seen_colors: dict[str, int] = {}
    for s in scenes:
        for hex_code in s.visual_summary.color_palette:
            seen_colors[hex_code] = seen_colors.get(hex_code, 0) + 1
    color_palette = [c for c, _ in sorted(seen_colors.items(), key=lambda x: x[1], reverse=True)[:5]]

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

    # Cut stats — count from frame_quant edge_diff > 40 (actual cut transitions)
    if quants:
        total_cuts = sum(1 for q in quants[1:] if q.edge_diff > 40)
    else:
        total_cuts = sum(s.visual_summary.cut_count for s in scenes)
    avg_cut_interval = round(total_duration / max(total_cuts, 1), 2)

    # Transition style: prefer scene-level transition data if available
    trans_types: list[str] = []
    for s in scenes:
        if s.visual_summary.transition_in != "none":
            trans_types.append(s.visual_summary.transition_in)
        if s.visual_summary.transition_out != "none":
            trans_types.append(s.visual_summary.transition_out)

    if trans_types:
        trans_counts = Counter(trans_types)
        top_trans, top_count = trans_counts.most_common(1)[0]
        total_trans = sum(trans_counts.values())
        raw_style = top_trans if top_count > total_trans * 0.6 else "mixed"
        transition_style = _normalize(raw_style, _TRANSITION_STYLE_MAP, "mixed")
    else:
        # Fallback to motion-based heuristic
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

    # Screen time ratios — use frame_qual data when available for accuracy
    if quals:
        frame_interval = 0.5  # 2fps extraction
        total_frames = len(quals)
        total_frame_time = total_frames * frame_interval
        human_frames = sum(
            1 for q in quals
            if q.subject_type in ("person_with_product", "person_only")
        )
        product_frames = sum(
            1 for q in quals
            if q.product_presentation.visibility in ("full", "in_use", "partial")
        )
        face_frames = sum(
            1 for q in quals
            if q.subject_type in ("person_with_product", "person_only")
            and q.shot_type in ("closeup", "medium")
        )
        human_ratio = round(human_frames / total_frames, 2) if total_frames else 0
        product_ratio = round(product_frames / total_frames, 2) if total_frames else 0
        face_ratio = round(face_frames / total_frames, 2) if total_frames else 0
    else:
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
        human_ratio = round(human_time / total_duration, 2) if total_duration else 0
        product_ratio = round(product_time / total_duration, 2) if total_duration else 0
        face_ratio = round(face_time / total_duration, 2) if total_duration else 0

    return VisualStyle(
        overall_mood=overall_mood,
        color_palette=color_palette,
        color_grading=color_grading,
        brightness_profile=brightness_profile,
        avg_cut_interval=avg_cut_interval,
        total_cuts=total_cuts,
        transition_style=transition_style,
        text_usage=text_usage,
        human_screen_time_ratio=human_ratio,
        product_screen_time_ratio=product_ratio,
        face_time_ratio=face_ratio,
    )


def _build_temporal_profile(
    temporal: TemporalAnalysis,
) -> TemporalProfile:
    """Summarise key temporal patterns into a compact profile."""
    total_duration = 0.0
    if temporal.energy_curve.points:
        pts = temporal.energy_curve.points
        total_duration = pts[-1].timestamp - pts[0].timestamp + 0.5

    # Cut rhythm summary
    cr = temporal.cut_rhythm
    if cr.total_cuts > 0:
        cut_summary = f"{cr.total_cuts} cuts, {cr.avg_interval:.1f}s avg interval, {cr.pattern}"
    else:
        cut_summary = "no significant cuts detected"

    # Text density
    td = temporal.text_dwell
    if td.texts_per_second > 0.5:
        text_density = "high"
    elif td.texts_per_second > 0.2:
        text_density = "medium"
    elif td.items:
        text_density = "low"
    else:
        text_density = "none"

    # Product/human balance
    ec = temporal.exposure_curve
    if ec.total_product_time_ratio > 0.6:
        balance = "product-dominant"
    elif ec.total_human_time_ratio > 0.6:
        balance = "human-dominant"
    elif ec.total_product_time_ratio > 0.3 and ec.total_human_time_ratio > 0.3:
        balance = "balanced"
    else:
        balance = "mixed"

    return TemporalProfile(
        total_duration=round(total_duration, 2),
        energy_arc=temporal.energy_curve.energy_arc,
        cut_rhythm_summary=cut_summary,
        dominant_transition=temporal.transition_texture.dominant_type,
        text_density=text_density,
        product_human_balance=balance,
    )


def _build_production_guide(
    scenes: list[Scene],
    temporal: TemporalAnalysis,
) -> ProductionGuide:
    """Build actionable per-scene production guide from temporal data."""
    scene_guides: list[SceneTimingGuide] = []

    # Pre-index temporal data by timestamp range
    energy_pts = {round(p.timestamp, 2): p for p in temporal.energy_curve.points}
    cut_ts_set = set(temporal.cut_rhythm.cut_timestamps)

    for scene in scenes:
        s_start, s_end = scene.time_range
        scene_duration = scene.duration

        # Energy level for this scene
        scene_energy_pts = [
            p for p in temporal.energy_curve.points
            if s_start <= p.timestamp <= s_end
        ]
        if scene_energy_pts:
            avg_e = sum(p.score for p in scene_energy_pts) / len(scene_energy_pts)
            peak_in_scene = [p for p in scene_energy_pts if p.score > 0.5]
            if peak_in_scene:
                peak_ts = max(peak_in_scene, key=lambda p: p.score)
                energy_desc = f"{peak_ts.section} energy, peak at {peak_ts.timestamp:.1f}s (score {peak_ts.score:.2f})"
            else:
                section = scene_energy_pts[0].section
                energy_desc = f"{section} energy, avg score {avg_e:.2f}"
        else:
            energy_desc = "no data"

        # Cut rhythm for this scene
        scene_cuts = [
            ts for ts in temporal.cut_rhythm.cut_timestamps
            if s_start <= ts <= s_end
        ]
        if scene_cuts:
            n_cuts = len(scene_cuts)
            avg_iv = scene_duration / max(n_cuts, 1)
            cut_desc = f"{n_cuts} cuts, ~{avg_iv:.1f}s/cut"
        else:
            cut_desc = "no cuts"

        # Text timing for this scene
        scene_texts = [
            t for t in temporal.text_dwell.items
            if t.first_appear >= s_start and t.first_appear <= s_end
        ]
        if scene_texts:
            first_text = min(scene_texts, key=lambda t: t.first_appear)
            relative_appear = first_text.first_appear - s_start
            text_desc = f"text appears at {relative_appear:.1f}s, stays {first_text.duration:.1f}s"
        else:
            text_desc = "no text overlay"

        # Camera suggestion from visual journey
        scene_shots = [
            q.shot_type for q in [
                # We don't have direct access to quals here, use visual_summary
            ]
        ]
        # Use scene's visual summary for camera suggestion
        dominant_shot = scene.visual_summary.dominant_shot
        motion = scene.visual_summary.motion_level
        camera_desc = f"{dominant_shot} shot, {motion} motion"

        # Check zoom events in this scene
        scene_zooms = [
            z for z in temporal.zoom_events
            if z.time_range[0] >= s_start and z.time_range[0] <= s_end
        ]
        if scene_zooms:
            zoom_desc = ", ".join(
                f"{z.direction} ({z.scale_change:.0%})" for z in scene_zooms
            )
            camera_desc += f", {zoom_desc}"

        scene_guides.append(SceneTimingGuide(
            scene_id=scene.scene_id,
            role=scene.role,
            time_range=scene.time_range,
            duration=scene.duration,
            cut_rhythm=cut_desc,
            text_timing=text_desc,
            energy_level=energy_desc,
            camera_suggestion=camera_desc,
            key_technique=scene.content_summary.key_action,
        ))

    # Overall recommendations
    cr = temporal.cut_rhythm
    recommended_rhythm = f"{cr.pattern} rhythm, target {cr.avg_interval:.1f}s avg interval"

    td = temporal.text_dwell
    if td.items:
        avg_dwell = sum(t.duration for t in td.items) / len(td.items)
        text_strategy = (
            f"{len(td.items)} text overlays, avg dwell {avg_dwell:.1f}s, "
            f"{td.texts_per_second:.2f} texts/sec"
        )
    else:
        text_strategy = "no text overlays used"

    zoom_count = len(temporal.zoom_events)
    broll_count = len(temporal.broll_segments)
    camera_notes = []
    if zoom_count:
        camera_notes.append(f"{zoom_count} zoom events")
    if broll_count:
        camera_notes.append(f"{broll_count} B-roll segments")
    camera_notes_str = ", ".join(camera_notes) if camera_notes else "static camera work"

    ec = temporal.energy_curve
    energy_target = f"{ec.energy_arc}, avg energy {ec.avg_energy:.2f}"
    if ec.peak_timestamps:
        energy_target += f", peaks at {', '.join(f'{t:.1f}s' for t in ec.peak_timestamps)}"

    return ProductionGuide(
        scene_guides=scene_guides,
        recommended_cut_rhythm=recommended_rhythm,
        text_overlay_strategy=text_strategy,
        camera_movement_notes=camera_notes_str,
        energy_curve_target=energy_target,
    )


def build_recipe(
    scenes: list[Scene],
    video_analysis: dict,
    quants: list[FrameQuant] | None = None,
    quals: list[FrameQual] | None = None,
    temporal: TemporalAnalysis | None = None,
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

    # hook_time = total duration of all hook-role scenes
    hook_scenes = [s for s in scenes if s.role == "hook"]
    hook_time = sum(s.duration for s in hook_scenes) if hook_scenes else raw_struct.get("hook_time", 0)

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

    # ── Visual style (from Track 1 scenes + frame data) ────────────────
    visual_style = _compute_visual_style(scenes, quants=quants, quals=quals)

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
            transcript=[TranscriptSegment.model_validate(seg) for seg in raw_voice.get("transcript", [])],
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

    # ── Persuasion analysis (from Track 2) ─────────────────────────────
    raw_pa = video_analysis.get("persuasion_analysis")
    persuasion_analysis = None
    if raw_pa:
        from .schemas import (
            PersuasionAnalysis, PresenterProfile, VideoStyle,
            AppealPoint, VisualProof, ProductEmphasis,
        )
        try:
            presenter = PresenterProfile(
                type=raw_pa.get("presenter", {}).get("type", "none"),
                face_shown=raw_pa.get("presenter", {}).get("face_shown", False),
                credibility_factor=raw_pa.get("presenter", {}).get("credibility_factor", ""),
            )
            video_style_data = raw_pa.get("video_style", {})
            video_style_obj = VideoStyle(
                type=video_style_data.get("type", "demo"),
                sub_style=video_style_data.get("sub_style", ""),
            )
            appeal_points = []
            for ap in raw_pa.get("appeal_points", []):
                vp = ap.get("visual_proof", {})
                appeal_points.append(AppealPoint(
                    type=ap.get("type", "sensory"),
                    claim=ap.get("claim", ""),
                    visual_proof=VisualProof(
                        technique=vp.get("technique", "none"),
                        description=vp.get("description", ""),
                        timestamp=vp.get("timestamp"),
                    ),
                    audio_sync=ap.get("audio_sync", "independent"),
                    strength=ap.get("strength", "moderate"),
                ))
            pe = raw_pa.get("product_emphasis", {})
            product_emphasis = ProductEmphasis(
                first_appear=pe.get("first_appear", 0),
                screen_time_ratio=pe.get("screen_time_ratio", 0),
                hero_shots=pe.get("hero_shots", 0),
                emphasis_techniques=pe.get("emphasis_techniques", []),
                key_visual_moment=pe.get("key_visual_moment", ""),
                key_visual_timestamp=pe.get("key_visual_timestamp"),
            )
            persuasion_analysis = PersuasionAnalysis(
                presenter=presenter,
                video_style=video_style_obj,
                appeal_points=appeal_points,
                product_emphasis=product_emphasis,
                primary_appeal=raw_pa.get("primary_appeal", "sensory"),
                appeal_layering=raw_pa.get("appeal_layering", ""),
                persuasion_summary=raw_pa.get("persuasion_summary", ""),
            )
        except Exception as e:
            print(f"  ⚠ Persuasion analysis parse error: {e}")

    # ── Art direction (from Track 2) ──────────────────────────────────
    raw_ad = video_analysis.get("art_direction")
    art_direction = None
    if raw_ad:
        try:
            art_direction = ArtDirection(
                tone_and_manner=raw_ad.get("tone_and_manner", ""),
                heading_font=raw_ad.get("heading_font", ""),
                body_font=raw_ad.get("body_font", ""),
                font_color_system=raw_ad.get("font_color_system", []),
                highlight_method=raw_ad.get("highlight_method", ""),
                brand_colors=raw_ad.get("brand_colors", []),
                background_style=raw_ad.get("background_style", "mixed"),
                color_temperature=raw_ad.get("color_temperature", "neutral"),
                graphic_style=raw_ad.get("graphic_style", "clean_minimal"),
                recurring_elements=raw_ad.get("recurring_elements", []),
                text_position_pattern=raw_ad.get("text_position_pattern", ""),
                frame_composition_rule=raw_ad.get("frame_composition_rule", ""),
                visual_consistency=raw_ad.get("visual_consistency", "medium"),
                style_reference=raw_ad.get("style_reference", ""),
            )
        except Exception as e:
            print(f"  ⚠ Art direction parse error: {e}")

    # ── Temporal profile + production guide (from temporal analysis) ────
    temporal_profile = None
    production_guide = None
    if temporal:
        temporal_profile = _build_temporal_profile(temporal)
        production_guide = _build_production_guide(scenes, temporal)

    return VideoRecipe(
        meta=meta,
        structure=structure,
        visual_style=visual_style,
        audio=audio,
        product_strategy=product_strategy,
        persuasion_analysis=persuasion_analysis,
        art_direction=art_direction,
        effectiveness_assessment=effectiveness,
        scenes=[s for s in scenes],
        temporal_profile=temporal_profile,
        production_guide=production_guide,
    )
