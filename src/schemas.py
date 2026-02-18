"""Pydantic models for the video analyzer pipeline schemas."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ── frame_quant (Phase 1: OpenCV quantitative) ──────────────────────────────


class DominantColor(BaseModel):
    hex: str = Field(description="Hex color code, e.g. #E8C4A0")
    ratio: float = Field(description="Ratio of this color in the frame (0.0-1.0)")


class TextRegion(BaseModel):
    detected: bool
    area_ratio: float = Field(description="Ratio of text area to frame area")
    position: Literal[
        "top_third", "middle_third", "bottom_third", "full", "none"
    ]


class FrameQuant(BaseModel):
    timestamp: float
    edge_diff: float = Field(description="Sobel edge L1 diff vs previous frame (16x16 grid)")
    color_diff: float = Field(description="RGB histogram distance vs previous frame (64bin x 3ch)")
    is_stagnant: bool = Field(description="True if both edge_diff and color_diff are below threshold")
    dominant_colors: list[DominantColor]
    brightness: float = Field(description="Average brightness 0.0-1.0")
    saturation: float = Field(description="Average saturation 0.0-1.0")
    contrast: float = Field(description="Contrast level 0.0-1.0")
    text_region: TextRegion
    face_detected: bool
    face_area_ratio: float = Field(description="Ratio of face area to frame area")
    subject_area_ratio: float = Field(description="Ratio of main subject area to frame area")


# ── frame_qual (Phase 2: Gemini Flash qualitative) ──────────────────────────


class Composition(BaseModel):
    layout: Literal[
        "center", "rule_of_thirds", "diagonal", "symmetry", "frame_in_frame"
    ]
    visual_weight: Literal["left", "right", "center", "balanced"]
    depth: Literal["flat", "shallow_dof", "deep"]


class TextOverlay(BaseModel):
    content: str = Field(description="OCR text content")
    purpose: Literal[
        "hook_question", "pain_point", "benefit", "social_proof",
        "price_offer", "cta", "brand", "subtitle",
    ]
    font_style: Literal["bold_impact", "elegant", "handwritten", "minimal"]
    readability: Literal["high", "medium", "low"]
    font_color: Optional[str] = Field(default=None, description="Hex color or name like 'white', 'yellow'")
    outline: Optional[bool] = Field(default=None, description="Has outline/stroke")
    shadow: Optional[bool] = Field(default=None, description="Has drop shadow")
    background_box: Optional[bool] = Field(default=None, description="Has background box/banner")
    font_size: Optional[Literal["large", "medium", "small"]] = Field(default=None)


class ProductPresentation(BaseModel):
    visibility: Literal["hidden", "glimpse", "partial", "full", "in_use"]
    angle: Literal["front", "side", "top", "360", "packaging", "detail_macro"]
    context: Literal[
        "studio", "lifestyle", "comparison", "transformation", "unboxing"
    ]


class HumanElement(BaseModel):
    role: Literal["presenter", "user", "model", "hand_only", "none"]
    emotion: Literal[
        "excited", "confident", "surprised", "satisfied", "neutral", "concerned"
    ]
    eye_contact: bool
    gesture: Literal[
        "pointing", "holding_product", "demonstrating", "reaction", "none"
    ]


class FrameQual(BaseModel):
    timestamp: float
    shot_type: Literal[
        "closeup", "medium", "wide", "overhead", "pov", "split_screen"
    ]
    subject_type: Literal[
        "product_only", "person_with_product", "person_only",
        "text_graphic", "lifestyle_scene", "before_after",
    ]
    composition: Composition
    text_overlay: Optional[TextOverlay] = Field(
        None, description="Text overlay analysis; null if no text detected"
    )
    product_presentation: ProductPresentation
    human_element: HumanElement
    color_mood: Literal[
        "warm_cozy", "cool_professional", "vibrant_energetic",
        "muted_luxury", "natural_organic", "bold_contrast",
    ]
    attention_element: str = Field(
        description="One-line description of the key attention-grabbing element"
    )


# ── Combined frame result ───────────────────────────────────────────────────


class FrameAnalysis(BaseModel):
    """Combined quant + qual result for a single frame."""
    quant: FrameQuant
    qual: Optional[FrameQual] = None


# ── Layer 2: Scene (Phase 3: scene_merger) ─────────────────────────────────


class SceneTextOverlay(BaseModel):
    content: str
    purpose: str = Field(description="e.g. hook_question, benefit, cta")
    font_style: str = Field(description="e.g. bold_impact, elegant")
    position: str = Field(description="Text region position, e.g. top_third")
    dwell_time: float = Field(description="Seconds text is on screen (frames × 0.5)")


class SceneHumanElement(BaseModel):
    role: str = Field(description="Most common human role in scene")
    emotion: str = Field(description="Most common emotion")
    eye_contact: bool = Field(description="Majority eye_contact across frames")
    gesture: str = Field(description="Most common gesture")


class SceneEnergy(BaseModel):
    avg_score: float
    peak_score: float
    peak_timestamp: float
    section: Literal["강", "중", "정적", "클라이막스"]
    is_climax: bool = Field(description="True if peak_score >= 0.75")


class VisualSummary(BaseModel):
    dominant_shot: Literal[
        "closeup", "medium", "wide", "overhead", "pov", "split_screen"
    ]
    shot_sequence: list[str] = Field(
        default_factory=list,
        description="Shot types from each frame in order",
    )
    composition: str = Field(
        default="center",
        description="Most common composition layout",
    )
    cut_count: int = 0
    avg_cut_interval: float = 0.0
    motion_level: Literal["static", "slow", "moderate", "fast", "jump_cut"]
    color_consistency: float = Field(description="0.0-1.0")
    color_mood: Literal[
        "warm_cozy", "cool_professional", "vibrant_energetic",
        "muted_luxury", "natural_organic", "bold_contrast",
    ]
    color_palette: list[str] = Field(
        default_factory=list,
        description="Top 3 hex colors by total ratio across frames",
    )
    zoom_events: list[ZoomEvent] = Field(
        default_factory=list,
        description="Zoom events from temporal analysis within scene time range",
    )
    transition_in: str = Field(
        default="none",
        description="Transition type at scene start (hard_cut, dissolve, fade, zoom_transition, none)",
    )
    transition_out: str = Field(
        default="none",
        description="Transition type at scene end",
    )


class ContentSummary(BaseModel):
    subject_type: Literal[
        "product_only", "person_with_product", "person_only",
        "text_graphic", "lifestyle_scene", "before_after",
    ]
    product_visibility: Literal["hidden", "glimpse", "partial", "full", "in_use"]
    product_angle: str = Field(
        default="front",
        description="Most common product angle across frames",
    )
    product_context: str = Field(
        default="studio",
        description="Most common product context across frames",
    )
    human_element: Optional[SceneHumanElement] = Field(
        None, description="Aggregated human element; null if no human in scene",
    )
    text_overlays: list[SceneTextOverlay] = Field(default_factory=list)
    attention_elements: list[str] = Field(
        default_factory=list,
        description="Unique attention-grabbing element descriptions from frames",
    )
    key_action: str = ""


class EffectivenessSignals(BaseModel):
    hook_strength: str
    information_density: Literal["high", "medium", "low"]
    emotional_trigger: Literal[
        "curiosity", "fomo", "trust", "desire", "humor", "none"
    ]


class TranscriptSegment(BaseModel):
    start: float = Field(description="Start time in seconds")
    end: float = Field(description="End time in seconds")
    text: str = Field(description="Spoken text in original language")
    speaker: Optional[str] = Field(default=None, description="Speaker label if identifiable")


class Scene(BaseModel):
    scene_id: int
    role: Literal[
        "hook", "problem", "solution", "demo", "proof",
        "cta", "transition", "brand_intro", "recap",
    ]
    time_range: list[float] = Field(description="[start, end]")
    duration: float
    visual_summary: VisualSummary
    content_summary: ContentSummary
    effectiveness_signals: EffectivenessSignals
    energy: Optional[SceneEnergy] = None
    transcript_segments: list[TranscriptSegment] = Field(default_factory=list)
    text_effects: list = Field(default_factory=list)


# ── Layer 3: Video Recipe (Phase 5: recipe_builder) ────────────────────────


class Meta(BaseModel):
    platform: Literal["tiktok", "reels", "shorts", "ad"]
    duration: float
    aspect_ratio: Literal["9:16", "1:1", "16:9"]
    category: Literal[
        "beauty", "food", "tech", "fashion", "health", "home", "finance", "education"
    ]
    sub_category: str
    target_audience: str


class SceneSequenceItem(BaseModel):
    role: str
    duration: float
    technique: str


class Structure(BaseModel):
    type: Literal[
        "problem_solution", "before_after", "demo", "review",
        "listicle", "story", "trend_ride",
    ]
    scene_sequence: list[SceneSequenceItem]
    hook_time: float
    product_first_appear: float
    cta_start: float


class TextUsage(BaseModel):
    frequency: Literal["every_scene", "key_moments", "minimal", "none"]
    style_consistency: Literal["high", "medium", "low"]
    language_tone: Literal["casual", "professional", "urgent", "playful"]


class VisualStyle(BaseModel):
    overall_mood: str
    color_palette: list[str]
    color_grading: Literal[
        "warm_filter", "natural", "high_contrast", "desaturated", "brand_color_heavy"
    ]
    brightness_profile: Literal[
        "consistent", "dark_to_bright", "bright_to_dark", "varied"
    ]
    avg_cut_interval: float
    total_cuts: int
    transition_style: Literal["hard_cut", "fade", "swipe", "zoom", "mixed"]
    text_usage: TextUsage
    human_screen_time_ratio: float
    product_screen_time_ratio: float
    face_time_ratio: float


class Music(BaseModel):
    present: bool
    genre: Literal[
        "upbeat_pop", "lo_fi", "dramatic", "trending_sound",
        "acoustic", "edm", "none",
    ]
    energy_profile: Literal["steady", "building", "drop", "calm_to_hype"]
    bpm_range: str
    mood_match: str
    beat_sync: str


class Voice(BaseModel):
    type: Literal["narration", "dialogue", "voiceover", "tts", "none"]
    tone: Literal[
        "conversational", "professional", "excited", "asmr", "storytelling"
    ]
    language: str
    script_summary: str
    hook_line: str
    cta_line: str
    transcript: list[TranscriptSegment] = Field(default_factory=list, description="Timestamped speech transcript")


class SFX(BaseModel):
    used: bool
    types: list[str]
    frequency: Literal["heavy", "moderate", "minimal", "none"]


class Audio(BaseModel):
    music: Music
    voice: Voice
    sfx: SFX
    audio_visual_sync: str


class BrandVisibility(BaseModel):
    logo_shown: bool
    brand_color_used: bool
    brand_mention_count: int


class ProductStrategy(BaseModel):
    reveal_timing: Literal["immediate", "gradual", "delayed_reveal", "teaser"]
    demonstration_method: Literal[
        "in_use", "comparison", "transformation", "testimonial",
        "spec_highlight", "unboxing",
    ]
    key_benefit_shown: str
    price_shown: bool
    price_framing: Literal[
        "discount", "per_day", "vs_competitor", "bundle", "none"
    ]
    offer_type: str
    social_proof: Literal[
        "reviews", "ugc", "numbers", "celebrity", "expert", "none"
    ]
    urgency_trigger: Literal["time_limit", "stock_limit", "trend", "none"]
    brand_visibility: BrandVisibility


class EffectivenessAssessment(BaseModel):
    hook_rating: str
    flow_rating: str
    message_clarity: str
    cta_strength: str
    replay_factor: str
    standout_elements: list[str]
    weak_points: list[str]


# ── Layer 2.5: Temporal Analysis (Phase 2.5: temporal_analyzer) ──────────────


class EnergyPoint(BaseModel):
    timestamp: float
    score: float = Field(description="Energy score 0.0-1.0")
    section: Literal["강", "중", "정적", "클라이막스"]


class EnergyCurve(BaseModel):
    points: list[EnergyPoint]
    peak_timestamps: list[float] = Field(description="Timestamps of energy peaks")
    avg_energy: float
    energy_arc: str = Field(description="Overall energy arc description, e.g. 'building→peak→fade'")


class CutRhythm(BaseModel):
    cut_timestamps: list[float]
    intervals: list[float] = Field(description="Intervals between consecutive cuts in seconds")
    pattern: Literal["accelerating", "decelerating", "constant", "irregular"]
    avg_interval: float
    min_interval: float
    max_interval: float
    total_cuts: int


class PlaybackSpeedSegment(BaseModel):
    time_range: list[float] = Field(description="[start, end]")
    type: Literal["normal", "slow_motion", "timelapse"]
    avg_edge_diff: float


class TextDwellItem(BaseModel):
    content: str
    first_appear: float
    last_appear: float
    duration: float
    position: str


class TextDwellAnalysis(BaseModel):
    items: list[TextDwellItem]
    texts_per_second: float = Field(description="Information delivery speed")
    total_text_screen_time: float


class ShotTransition(BaseModel):
    timestamp: float
    from_shot: str
    to_shot: str


class VisualJourney(BaseModel):
    shot_sequence: list[str] = Field(description="Ordered shot_type sequence")
    transitions: list[ShotTransition]
    dominant_pattern: str = Field(description="e.g. 'closeup→wide→medium→closeup cycle'")
    transition_counts: dict[str, int] = Field(description="Count per transition type, e.g. 'closeup→wide': 3")


class ExposureSegment(BaseModel):
    time_range: list[float]
    human_ratio: float
    product_ratio: float


class ExposureCurve(BaseModel):
    segments: list[ExposureSegment]
    total_human_time_ratio: float
    total_product_time_ratio: float
    circulation_pattern: str = Field(description="e.g. '제품→사람→제품 클로즈업'")


class ColorChangePoint(BaseModel):
    timestamp: float
    brightness: float
    saturation: float


class ColorShift(BaseModel):
    timestamp: float
    type: Literal["abrupt", "gradual"]
    brightness_delta: float
    saturation_delta: float


class ColorChangeCurve(BaseModel):
    points: list[ColorChangePoint]
    shifts: list[ColorShift]
    overall_pattern: Literal[
        "consistent", "gradual_warm", "gradual_cool",
        "high_variance", "dark_to_bright", "bright_to_dark",
    ]


class BRollSegment(BaseModel):
    time_range: list[float]
    frame_count: int
    reason: str = Field(description="Why classified as B-roll")


class ZoomEvent(BaseModel):
    time_range: list[float]
    direction: Literal["zoom_in", "zoom_out"]
    scale_change: float = Field(description="Absolute change in subject_area_ratio")


class CaptionPattern(BaseModel):
    position_preference: Literal["top", "middle", "bottom", "mixed"]
    avg_area_ratio: float
    position_timeline: list[dict[str, Any]] = Field(
        description="List of {timestamp, position, area_ratio}"
    )


class TransitionEvent(BaseModel):
    timestamp: float
    type: Literal["hard_cut", "dissolve", "fade", "zoom_transition"]
    edge_diff: float
    color_diff: float


class TransitionTexture(BaseModel):
    events: list[TransitionEvent]
    dominant_type: Literal["hard_cut", "dissolve", "fade", "zoom_transition", "mixed"]
    type_counts: dict[str, int]


class TemporalAnalysis(BaseModel):
    energy_curve: EnergyCurve
    cut_rhythm: CutRhythm
    playback_speed: list[PlaybackSpeedSegment]
    text_dwell: TextDwellAnalysis
    visual_journey: VisualJourney
    exposure_curve: ExposureCurve
    color_change_curve: ColorChangeCurve
    broll_segments: list[BRollSegment]
    zoom_events: list[ZoomEvent]
    caption_pattern: CaptionPattern
    transition_texture: TransitionTexture


# ── Layer 3: Video Recipe (Phase 5: recipe_builder) — Production Guide ────


class SceneTimingGuide(BaseModel):
    scene_id: int
    role: str
    time_range: list[float]
    duration: float
    cut_rhythm: str = Field(description="e.g. '0.8s/cut, accelerating'")
    text_timing: str = Field(description="e.g. 'text appears at 0.5s, stays 1.2s'")
    energy_level: str = Field(description="e.g. 'high energy, peak at 1.2s'")
    camera_suggestion: str = Field(description="e.g. 'closeup→wide transition'")
    key_technique: str


class ProductionGuide(BaseModel):
    scene_guides: list[SceneTimingGuide]
    recommended_cut_rhythm: str
    text_overlay_strategy: str
    camera_movement_notes: str
    energy_curve_target: str


class TemporalProfile(BaseModel):
    total_duration: float
    energy_arc: str
    cut_rhythm_summary: str
    dominant_transition: str
    text_density: str
    product_human_balance: str


class VideoRecipe(BaseModel):
    meta: Meta
    structure: Structure
    visual_style: VisualStyle
    audio: Audio
    product_strategy: ProductStrategy
    effectiveness_assessment: EffectivenessAssessment
    scenes: list[Scene]
    temporal_profile: Optional[TemporalProfile] = None
    production_guide: Optional[ProductionGuide] = None
