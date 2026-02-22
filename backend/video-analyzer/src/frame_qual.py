"""Phase 2: Gemini 2.0 Flash qualitative frame analysis.

Sends each keyframe image to Gemini with:
  - frame_quant data as context
Returns structured FrameQual JSON.

Supports parallel processing with throttling (Semaphore + delay).
Uses GEMINI_API_KEY_PRO (Tier 3) if available, falls back to GEMINI_API_KEY.
"""

from __future__ import annotations

import asyncio
import json
import os

from google import genai
from google.genai import types

from .schemas import FrameQual, FrameQuant

MODEL = "gemini-2.5-flash"
MAX_CONCURRENCY = 20  # simultaneous API calls (Tier 3: 2000 RPM)
REQUEST_DELAY = 0.1   # seconds between requests

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
  For text_overlay fields also detect: font_color (hex or name like 'white'),
  outline (bool), shadow (bool), background_box (bool), font_size (large/medium/small).
For product_presentation: if no product is visible, use visibility="hidden".
For human_element: if no person is visible, use role="none".

For artwork analysis:
- typography: Identify font family (gothic=고딕/sans-serif, rounded=둥근체, serif=명조,
  handwritten=손글씨, display=장식체, monospace=고정폭). Note weight, color (hex),
  outline/shadow/background, alignment, line count. Detect highlight technique
  (color_change=특정 단어만 다른 색, size_increase, underline, box_highlight, glow, bold_keyword).
  Set typography to null if NO text is visible.
- graphic_elements: List all visual design elements (icon, sticker, emoji, arrow,
  circle_highlight, underline, box_border, gradient_overlay, pattern_bg, logo, badge, watermark).
  Use ["none"] if no graphic elements.
- layout_zones: What occupies each vertical third (top/middle/bottom) of the frame.
  Options: text, product, person, graphic, empty, mixed.
- color_design: Identify primary background color (hex), accent/highlight color (hex),
  text-background contrast level, and color harmony type.

For artwork analysis:
- Identify typography details: font family (gothic/rounded/serif/handwritten/display), weight, color, outline, shadow, background box
- Note highlight techniques: which words are emphasized and how (color change, size, underline, glow)
- Identify graphic elements: icons, stickers, arrows, badges, gradient overlays
- Describe layout zones: what occupies top/middle/bottom third of frame
- Assess color design: primary/accent colors, text-background contrast, color harmony
- If no text/graphics visible, set artwork to null
"""


def _build_prompt(quant: FrameQuant) -> str:
    """Build the text prompt with quant context."""
    parts: list[str] = []

    parts.append("## Frame Quantitative Data (auto-measured)")
    parts.append("```json")
    parts.append(quant.model_dump_json(indent=2))
    parts.append("```")

    parts.append(
        "\nAnalyse the frame image above together with the quantitative data. "
        "Return a JSON object matching the FrameQual schema."
    )
    return "\n".join(parts)


def _make_client() -> genai.Client:
    # Prefer Tier 3 key for higher rate limits
    api_key = os.environ.get("GEMINI_API_KEY_PRO", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY or GEMINI_API_KEY_PRO environment variable is not set. "
            "Copy .env.example to .env and fill in your key."
        )
    key_type = "PRO (Tier 3)" if os.environ.get("GEMINI_API_KEY_PRO") else "Free"
    print(f"  Using Gemini API key: {key_type}")
    return genai.Client(api_key=api_key)


async def analyse_frame_qual(
    client: genai.Client,
    semaphore: asyncio.Semaphore,
    jpeg_bytes: bytes,
    timestamp: float,
    quant: FrameQuant,
) -> FrameQual:
    """Send a single frame to Gemini Flash and return FrameQual."""
    prompt = _build_prompt(quant)

    image_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
    text_part = types.Part.from_text(text=prompt)

    max_retries = 5
    async with semaphore:
        await asyncio.sleep(REQUEST_DELAY)  # throttle
        for attempt in range(max_retries):
            try:
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
            except Exception as e:
                wait = 2 ** attempt * 5  # 5, 10, 20, 40, 80s
                err_name = type(e).__name__
                if attempt < max_retries - 1:
                    print(f"  ⚠ Frame {timestamp}s retry {attempt+1}/{max_retries} ({err_name}), waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    raise RuntimeError(f"Frame {timestamp}s failed after {max_retries} retries: {e}") from e


async def analyse_frames_qual(
    jpeg_frames: list[tuple[float, bytes]],
    quants: list[FrameQuant],
    concurrency: int = MAX_CONCURRENCY,
) -> list[FrameQual]:
    """Analyse all frames in parallel with throttling.

    Stagnant frames (low visual change) are skipped and inherit the previous
    frame's result with updated timestamp — saves ~5-15% of API calls.

    Parameters
    ----------
    jpeg_frames : list of (timestamp, jpeg_bytes)
    quants : list of FrameQuant matching each frame
    concurrency : max simultaneous API calls (default 20)
    """
    client = _make_client()
    semaphore = asyncio.Semaphore(concurrency)

    # Identify stagnant frames to skip (copy from previous)
    skip_indices: set[int] = set()
    for i, q in enumerate(quants):
        if i > 0 and q.is_stagnant and q.color_diff < 3.0 and q.edge_diff < 3.0:
            skip_indices.add(i)

    if skip_indices:
        print(f"  Skipping {len(skip_indices)} stagnant frames (will copy from previous)")

    # Create tasks only for non-skipped frames
    active_indices = [i for i in range(len(jpeg_frames)) if i not in skip_indices]
    tasks = [
        analyse_frame_qual(client, semaphore, jpeg_frames[i][1], jpeg_frames[i][0], quants[i])
        for i in active_indices
    ]

    active_results = await asyncio.gather(*tasks)

    # Build result map: index → FrameQual
    result_map: dict[int, FrameQual] = {}
    for idx, result in zip(active_indices, active_results):
        result_map[idx] = result

    # Fill in skipped frames by copying previous result with updated timestamp
    all_results: list[FrameQual] = []
    for i in range(len(jpeg_frames)):
        if i in result_map:
            all_results.append(result_map[i])
        elif all_results:
            # Copy previous result with new timestamp
            prev = all_results[-1]
            copied = prev.model_copy(update={"timestamp": jpeg_frames[i][0]})
            all_results.append(copied)
        else:
            # Edge case: first frame is stagnant (shouldn't happen)
            # Force analyse it
            result = await analyse_frame_qual(
                client, semaphore, jpeg_frames[i][1], jpeg_frames[i][0], quants[i]
            )
            all_results.append(result)

    return sorted(all_results, key=lambda q: q.timestamp)
