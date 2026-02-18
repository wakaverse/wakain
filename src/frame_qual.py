"""Phase 2: Gemini 2.0 Flash qualitative frame analysis.

Sends each keyframe image to Gemini with:
  - frame_quant data as context
  - previous frame_qual result for continuity
Returns structured FrameQual JSON.
"""

from __future__ import annotations

import asyncio
import json
import os

from google import genai
from google.genai import types

from .schemas import FrameQual, FrameQuant

MODEL = "gemini-2.0-flash"

SYSTEM_INSTRUCTION = """\
You are a shortform marketing video analyst. You analyse individual frames
to extract structured visual metadata for building a video recipe.

Always respond with valid JSON matching the requested schema exactly.
Be precise with shot_type classification:
  - closeup: main subject occupies >60% of frame
  - medium: 30-60%
  - wide: <30%
  - overhead: camera looks down from above
  - pov: first-person perspective
  - split_screen: frame is visually divided into panels

For text_overlay: set to null if no text is visible in the frame.
For product_presentation: if no product is visible, use visibility="hidden".
For human_element: if no person is visible, use role="none".
"""


def _build_prompt(quant: FrameQuant, prev_qual: FrameQual | None) -> str:
    """Build the text prompt with quant context and previous analysis."""
    parts: list[str] = []

    parts.append("## Frame Quantitative Data (auto-measured)")
    parts.append("```json")
    parts.append(quant.model_dump_json(indent=2))
    parts.append("```")

    if prev_qual is not None:
        parts.append("\n## Previous Frame Analysis (for continuity)")
        parts.append("```json")
        parts.append(prev_qual.model_dump_json(indent=2))
        parts.append("```")
    else:
        parts.append("\nThis is the first frame of the video.")

    parts.append(
        "\nAnalyse the frame image above together with the quantitative data. "
        "Return a JSON object matching the FrameQual schema."
    )
    return "\n".join(parts)


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Copy .env.example to .env and fill in your key."
        )
    return genai.Client(api_key=api_key)


async def analyse_frame_qual(
    client: genai.Client,
    jpeg_bytes: bytes,
    timestamp: float,
    quant: FrameQuant,
    prev_qual: FrameQual | None = None,
) -> FrameQual:
    """Send a single frame to Gemini Flash and return FrameQual."""
    prompt = _build_prompt(quant, prev_qual)

    image_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
    text_part = types.Part.from_text(text=prompt)

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=[image_part, text_part],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=FrameQual,
            temperature=0.1,
        ),
    )

    data = json.loads(response.text)
    data["timestamp"] = timestamp
    return FrameQual.model_validate(data)


async def analyse_frames_qual(
    jpeg_frames: list[tuple[float, bytes]],
    quants: list[FrameQuant],
    concurrency: int = 1,
) -> list[FrameQual]:
    """Analyse all frames sequentially (each frame depends on previous result).

    Parameters
    ----------
    jpeg_frames : list of (timestamp, jpeg_bytes)
    quants : list of FrameQuant matching each frame
    concurrency : unused for now (sequential due to continuity requirement)
    """
    client = _make_client()

    results: list[FrameQual] = []
    prev_qual: FrameQual | None = None

    for (timestamp, jpeg_bytes), quant in zip(jpeg_frames, quants):
        qual = await analyse_frame_qual(
            client, jpeg_bytes, timestamp, quant, prev_qual
        )
        results.append(qual)
        prev_qual = qual

    return results
