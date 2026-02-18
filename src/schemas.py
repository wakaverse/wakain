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


class VisualSummary(BaseModel):
    dominant_shot: Literal[
        "closeup", "medium", "wide", "overhead", "pov", "split_screen"
    ]
    cut_count: int
    avg_cut_interval: float
    motion_level: Literal["static", "slow", "moderate", "fast", "jump_cut"]
    color_consistency: float = Field(description="0.0-1.0")
    color_mood: Literal[
        "warm_cozy", "cool_professional", "vibrant_energetic",
        "muted_luxury", "natural_organic", "bold_contrast",
    ]


class ContentSummary(BaseModel):
    subject_type: Literal[
        "product_only", "person_with_product", "person_only",
        "text_graphic", "lifestyle_scene", "before_after",
    ]
    product_visibility: Literal["hidden", "glimpse", "partial", "full", "in_use"]
    text_overlays: list[str]
    key_action: str


class EffectivenessSignals(BaseModel):
    hook_strength: str
    information_density: Literal["high", "medium", "low"]
    emotional_trigger: Literal[
        "curiosity", "fomo", "trust", "desire", "humor", "none"
    ]


class Scene(BaseModel):
    scene_id: int
    role: Literal[
        "hook", "problem", "solution", "demo", "proof",
        "cta", "transition", "brand_intro",
    ]
    time_range: list[float] = Field(description="[start, end]")
    duration: float
    visual_summary: VisualSummary
    content_summary: ContentSummary
    effectiveness_signals: EffectivenessSignals


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


class VideoRecipe(BaseModel):
    meta: Meta
    structure: Structure
    visual_style: VisualStyle
    audio: Audio
    product_strategy: ProductStrategy
    effectiveness_assessment: EffectivenessAssessment
    scenes: list[Scene]
