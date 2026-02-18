"""Pydantic models for the video analyzer pipeline schemas."""

from __future__ import annotations

from typing import Literal, Optional

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
