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


# ── Scene-level artwork (aggregated) ────────────────────────────────────────


class SceneArtwork(BaseModel):
    """Aggregated artwork analysis for a scene."""
    typography_style: Optional[str] = Field(default=None, description="Dominant font family")
    typography_weight: Optional[str] = Field(default=None)
    text_color_primary: Optional[str] = Field(default=None, description="Most common text color (hex)")
    text_color_highlight: Optional[str] = Field(default=None, description="Highlight color if used (hex)")
    has_text_background: bool = False
    text_bg_color: Optional[str] = Field(default=None)
    graphic_elements: list[str] = Field(default_factory=list, description="Unique graphic elements used")
    dominant_layout: str = Field(default="", description="e.g. 'text-top/person-middle/product-bottom'")
    text_product_overlap: bool = False
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    contrast_level: str = "medium"
    color_harmony: Optional[str] = None


# ── Original models continue ───────────────────────────────────────────────


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


class FrameTypography(BaseModel):
    """Typography details for text overlays in a frame."""
    font_family: Literal["gothic", "rounded", "serif", "handwritten", "display", "monospace"]
    font_weight: Literal["thin", "regular", "bold", "extra_bold"]
    font_color: str = Field(description="Primary text color (hex)")
    font_size_ratio: Literal["large", "medium", "small"]  # relative to frame
    has_outline: bool
    outline_color: Optional[str] = Field(default=None, description="Outline color (hex)")
    has_shadow: bool
    has_background: bool
    background_color: Optional[str] = Field(default=None, description="Background box color (hex)")
    text_alignment: Literal["left", "center", "right"]
    line_count: int = Field(description="Number of text lines visible")
    highlight_technique: Literal[
        "color_change", "size_increase", "underline", "box_highlight",
        "glow", "bold_keyword", "none"
    ] = Field(description="How key words are emphasized")
    highlight_color: Optional[str] = Field(default=None, description="Highlight color if used (hex)")


class LayoutZones(BaseModel):
    """What occupies each vertical third of the frame."""
    top: Literal["text", "product", "person", "graphic", "empty", "mixed"]
    middle: Literal["text", "product", "person", "graphic", "empty", "mixed"]
    bottom: Literal["text", "product", "person", "graphic", "empty", "mixed"]
    text_product_overlap: bool = Field(description="Whether text overlaps product area")


class ColorDesign(BaseModel):
    """Color usage strategy in the frame."""
    primary_color: str = Field(description="Dominant background/theme color (hex)")
    accent_color: Optional[str] = Field(default=None, description="Emphasis/highlight color (hex)")
    text_bg_contrast: Literal["high", "medium", "low"] = Field(description="Contrast between text and its background")
    color_harmony: Literal["monochrome", "complementary", "analogous", "triadic", "warm_cool_split"]


class FrameArtwork(BaseModel):
    """Per-frame artwork/design analysis."""
    # Typography
    typography: Optional[FrameTypography] = None  # null if no text

    # Graphic elements
    graphic_elements: list[Literal[
        "icon", "sticker", "emoji", "arrow", "circle_highlight",
        "underline", "box_border", "gradient_overlay", "pattern_bg",
        "logo", "badge", "watermark", "none",
    ]] = Field(default_factory=list)

    # Layout
    layout_zones: LayoutZones  # what occupies top/middle/bottom third

    # Color design
    color_design: ColorDesign


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
    artwork: Optional[FrameArtwork] = Field(default=None, description="Artwork/design analysis")


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


class SceneAttention(BaseModel):
    attention_score: int = Field(description="Average attention score 0-100")
    attention_peak: int = Field(description="Peak attention score 0-100")
    peak_timestamp: float
    attention_level: str = Field(description="low/medium/high/peak")
    is_climax: bool = Field(description="True if attention_peak >= 75")


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
    description: str = Field(default="", description="Brief description of what happens in this scene")
    attention: Optional[SceneAttention] = None
    transcript_segments: list[TranscriptSegment] = Field(default_factory=list)
    artwork: Optional[SceneArtwork] = Field(default=None, description="Aggregated artwork/design analysis")
    text_effects: list = Field(default_factory=list)
    appeal_points: list = Field(default_factory=list, description="Persuasion appeal points mapped to this scene by timestamp")


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


# ── Layer 3.5: Persuasion Analysis (소구 분석) ────────────────────────────


class VisualProof(BaseModel):
    """How an appeal point is visually demonstrated in the video."""
    technique: Literal[
        "closeup", "slow_motion", "split_screen", "before_after",
        "text_overlay", "reaction_shot", "process_shot", "package_shot",
        "ingredient_shot", "location_shot", "graph_number", "none",
    ] = Field(description="Primary visual technique used to prove this appeal")
    description: str = Field(description="Specific description of the visual proof (Korean)")
    timestamp: Optional[float] = Field(default=None, description="Approximate time in video")


class AppealPoint(BaseModel):
    """A single persuasion point — what claim + how it's proven visually."""
    type: Literal[
        # Rational appeals (이성 소구)
        "myth_bust",       # 편견 파괴 — "김이 다 거기서 거기?"
        "ingredient",      # 원재료/성분 — "국내산 원초"
        "process",         # 제조 공정 — "두 번 구워"
        "achievement",     # 실적/수치 — "150억 판매"
        "price",           # 가성비/가격 — "한 팩 990원"
        "comparison",      # 비교 우위 — "일반 김 vs 태풍김"
        "guarantee",       # 보증/리스크 제거 — "맛없으면 보장"
        "origin",          # 산지/원산지 — "통영 직송"
        "specification",   # 스펙/기능 — "18000RPM 흡입력"
        # Emotional appeals (감성 소구)
        "sensory",         # 감각 자극 — ASMR, 먹방, 바삭 소리
        "authenticity",    # 진정성/인간미 — "사장이 직접"
        "social_proof",    # 사회적 증거 — 리뷰, 판매량
        "urgency",         # 긴급/한정 — "오늘만 이 가격"
        "lifestyle",       # 라이프스타일 — "퇴근 후 혼술 안주"
        "nostalgia",       # 향수/추억 — "어릴 때 먹던 그 맛"
        "authority",       # 권위/전문가 — "미슐랭 셰프 추천"
        "emotional",       # 감정 호소 — 감동, 유머, 공감
    ]
    claim: str = Field(description="The specific claim or message (Korean)")
    visual_proof: VisualProof = Field(description="How this claim is visually demonstrated")
    audio_sync: Literal[
        "narration_sync", "text_only", "sfx_emphasis", "music_beat", "silent", "independent",
    ] = Field(description="How the appeal syncs with audio")
    strength: Literal["strong", "moderate", "weak"] = Field(
        description="How convincingly this appeal is delivered"
    )


class PresenterProfile(BaseModel):
    """Who presents/speaks in the video."""
    type: Literal[
        "founder",    # 대표/사장 직접 출연
        "reviewer",   # 체험자/인플루언서
        "narrator",   # 보이지 않는 내레이터
        "customer",   # 실제 고객 후기
        "expert",     # 전문가 (셰프, 의사 등)
        "character",  # 캐릭터/마스코트
        "none",       # 텍스트/비주얼만
    ]
    face_shown: bool = Field(description="Whether presenter's face appears on screen")
    credibility_factor: str = Field(description="What gives this presenter credibility (Korean)")


class ProductEmphasis(BaseModel):
    """How the product is visually emphasized in the video."""
    first_appear: float = Field(description="Seconds when product first appears")
    screen_time_ratio: float = Field(description="Ratio of frames showing product (0.0-1.0)")
    hero_shots: int = Field(description="Number of dedicated product close-up/hero shots")
    emphasis_techniques: list[Literal[
        "closeup", "slow_motion", "zoom_in", "spotlight",
        "rotation", "unboxing", "size_comparison",
        "texture_detail", "steam_sizzle", "pour_drip",
        "before_after", "multi_angle", "ingredient_breakdown",
        "in_use_demo", "package_focus",
    ]] = Field(description="Visual techniques used to emphasize the product")
    key_visual_moment: str = Field(description="The single most impactful product shot (Korean)")
    key_visual_timestamp: Optional[float] = Field(default=None)


class VideoStyle(BaseModel):
    """Overall video presentation style."""
    type: Literal[
        "pitch",       # 직접 판매 (홈쇼핑식 설득)
        "demo",        # 제품 시연 중심
        "mukbang",     # 먹방/ASMR/감각 자극
        "comparison",  # 비교 (before/after, vs 경쟁)
        "vlog",        # 일상 속 자연스러운 노출
        "review",      # 솔직 후기/언박싱
        "info",        # 정보/교육형
        "story",       # 스토리텔링/감성
        "challenge",   # 챌린지/트렌드
    ]
    sub_style: str = Field(default="", description="More specific style note (Korean)")


class PersuasionAnalysis(BaseModel):
    """Complete persuasion/appeal analysis of a marketing video."""
    presenter: PresenterProfile
    video_style: VideoStyle
    appeal_points: list[AppealPoint] = Field(description="All persuasion points, ordered by appearance")
    product_emphasis: ProductEmphasis
    primary_appeal: str = Field(description="The single strongest appeal type code")
    appeal_layering: str = Field(description="How appeals build on each other (Korean)")
    persuasion_summary: str = Field(description="1-2 sentence summary of the persuasion strategy (Korean)")


class ArtDirection(BaseModel):
    """Overall art direction / visual identity of the video."""
    # Tone & Manner
    tone_and_manner: str = Field(description="Overall visual tone in Korean, e.g. '깔끔하고 신뢰감 있는 정보형'")

    # Typography system
    heading_font: str = Field(description="Primary heading font family")
    body_font: str = Field(description="Body/subtitle font family")
    font_color_system: list[str] = Field(description="Colors used for text (hex list)")
    highlight_method: str = Field(description="How keywords are emphasized")

    # Color system
    brand_colors: list[str] = Field(description="Brand/theme colors used (hex)")
    background_style: Literal[
        "solid_color", "gradient", "image_bg", "video_bg", "transparent", "mixed"
    ]
    color_temperature: Literal["warm", "neutral", "cool"]

    # Graphic identity
    graphic_style: Literal[
        "clean_minimal", "bold_graphic", "playful_sticker", "premium_elegant",
        "retro_vintage", "info_graphic", "hand_drawn", "photo_real",
    ]
    recurring_elements: list[str] = Field(description="Repeated visual elements (Korean)")

    # Layout system
    text_position_pattern: str = Field(description="Where text typically appears, e.g. 'top-center, bottom-left alternating'")
    frame_composition_rule: str = Field(description="Layout rule, e.g. '상단 텍스트 + 중앙 제품 + 하단 가격/CTA'")

    # Overall assessment
    visual_consistency: Literal["high", "medium", "low"]
    style_reference: str = Field(description="What this style resembles, e.g. '쿠팡 라이브 스타일', '인스타 감성'")


class EffectivenessAssessment(BaseModel):
    hook_rating: str
    flow_rating: str
    message_clarity: str
    cta_strength: str
    replay_factor: str
    standout_elements: list[str]
    weak_points: list[str]


# ── Layer 2.5: Temporal Analysis (Phase 2.5: temporal_analyzer) ──────────────


class AttentionPoint(BaseModel):
    timestamp: float
    score: int = Field(description="Attention score 0-100")
    section: Literal["강", "중", "정적", "클라이막스"]


class AttentionCurve(BaseModel):
    points: list[AttentionPoint]
    peak_timestamps: list[float] = Field(description="Timestamps of attention peaks")
    attention_avg: int
    attention_arc: str = Field(description="Overall attention arc description, e.g. 'building→peak→fade'")


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
    attention_curve: AttentionCurve
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
    attention_level: str = Field(default="", description="e.g. 'high attention, peak at 1.2s'")
    camera_suggestion: str = Field(description="e.g. 'closeup→wide transition'")
    key_technique: str


class ProductionGuide(BaseModel):
    scene_guides: list[SceneTimingGuide]
    recommended_cut_rhythm: str
    text_overlay_strategy: str
    camera_movement_notes: str
    attention_curve_target: str = ""


class TemporalProfile(BaseModel):
    total_duration: float
    attention_arc: str = ""
    cut_rhythm_summary: str
    dominant_transition: str
    text_density: str
    product_human_balance: str


class SceneCard(BaseModel):
    """씬별 통합 제작 지시서 / Integrated Scene Production Brief"""
    scene_id: int
    time_range: list[float]
    duration: float

    # Role & Narrative
    role: str
    description: str

    # Appeal (소구)
    appeal_points: list[dict]

    # Visual Direction (촬영 지시)
    shot_type: str
    camera_motion: str
    composition: str
    subject: str
    product_visibility: str

    # Attention & Rhythm (집중도 & 리듬)
    attention_score: int
    attention_peak: int
    attention_level: str
    cut_count: int
    cut_rhythm: str
    transition_in: str
    transition_out: str

    # Text & Art (텍스트 & 아트)
    text_overlays: list[dict]
    color_palette: list[str]
    graphic_style: str
    font_style: Optional[str] = None

    # Audio (오디오)
    narration: Optional[str] = None
    sound_direction: str


class DropOffZone(BaseModel):
    """이탈 위험 구간 / Drop-off Risk Zone"""
    time_range: tuple[float, float]
    risk_score: int
    risk_level: str
    risk_factors: list[str]
    suggestion: str


class DropOffAnalysis(BaseModel):
    """이탈 예측 분석 / Drop-off Prediction Analysis"""
    risk_zones: list[DropOffZone]
    safe_zones: list[tuple[float, float]]
    overall_retention_score: int
    worst_zone: Optional[DropOffZone] = None
    improvement_priority: list[str]


class PerformanceMetrics(BaseModel):
    """퍼포먼스 지표 / Performance Metrics"""
    brand_exposure_sec: float
    product_focus_ratio: float
    text_readability_score: int
    time_to_first_appeal: float
    time_to_cta: Optional[float] = None
    info_density: float
    appeal_count: int
    appeal_diversity: int
    cut_density: float
    attention_avg: int
    attention_valley_count: int


class VideoRecipe(BaseModel):
    meta: Meta
    structure: Structure
    visual_style: VisualStyle
    audio: Audio
    product_strategy: ProductStrategy
    persuasion_analysis: Optional[PersuasionAnalysis] = None
    art_direction: Optional[ArtDirection] = None
    effectiveness_assessment: EffectivenessAssessment
    scenes: list[Scene]
    temporal_profile: Optional[TemporalProfile] = None
    production_guide: Optional[ProductionGuide] = None
    scene_cards: list[SceneCard] = Field(default_factory=list)
    dropoff_analysis: Optional[DropOffAnalysis] = None
    performance_metrics: Optional[PerformanceMetrics] = None


# ── Comparator schemas ──────────────────────────────────────────────────────


class VideoSummary(BaseModel):
    """비디오 비교용 단일 영상 요약 / Single video summary for comparison"""
    video_name: str
    label: Optional[str] = None  # "success" / "failure" / None
    duration: float
    scene_count: int
    cut_density: float  # 초당 컷 수 / cuts per second
    appeal_count: int
    appeal_types: list[str]  # 고유 소구 유형 목록 / unique appeal types used
    attention_avg: int
    attention_min: int
    attention_max: int
    first_appeal_time: float
    time_to_cta: Optional[float] = None
    product_focus_ratio: float
    text_readability: int
    info_density: float
    retention_score: int  # dropoff_analysis.overall_retention_score
    dominant_appeal_sequence: list[str]  # 순서대로 정렬된 소구 유형 / ordered appeal types
    art_style: str  # art_direction.tone_and_manner


class ComparisonInsight(BaseModel):
    """비교 인사이트 / Comparison insight"""
    category: str  # "attention", "appeal", "structure", "artwork"
    finding: str
    evidence: str
    recommendation: str


class VideoComparison(BaseModel):
    """복수 영상 비교 결과 / Multi-video comparison result"""
    videos: list[VideoSummary]
    metrics_table: dict[str, list]  # metric_name → [val1, val2, ...]
    success_patterns: list[str]  # 성공 영상 공통 패턴 / common among success-labeled
    failure_patterns: list[str]  # 실패 영상 공통 패턴 / common among failure-labeled
    key_differentiators: list[str]  # 성공/실패 차이점 / success vs failure differences
    appeal_frequency: dict[str, int]  # appeal_type → 전체 합계
    winning_combinations: list[str]  # 성공 영상의 소구 시퀀스 / frequent appeal sequences in success videos
    insights: list[ComparisonInsight]
