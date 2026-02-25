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

MODEL = "gemini-2.5-flash-lite"
MAX_CONCURRENCY = 3   # simultaneous API calls (reduced to avoid 503)
REQUEST_DELAY = 0.5   # seconds between requests

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
    """Build the text prompt (quant context removed for lite model)."""
    return "Analyse the frame image above. Return a JSON object matching the FrameQual schema."


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

    Parameters
    ----------
    jpeg_frames : list of (timestamp, jpeg_bytes)
    quants : list of FrameQuant matching each frame
    concurrency : max simultaneous API calls (default 10)
    """
    client = _make_client()
    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        analyse_frame_qual(client, semaphore, jpeg_bytes, timestamp, quant)
        for (timestamp, jpeg_bytes), quant in zip(jpeg_frames, quants)
    ]

    results_raw = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out failed frames (skip them instead of crashing pipeline)
    results = []
    failed = 0
    for i, r in enumerate(results_raw):
        if isinstance(r, Exception):
            ts = jpeg_frames[i][0] if i < len(jpeg_frames) else 0
            print(f"  ⚠ Frame {ts}s failed, skipping: {r}")
            failed += 1
        else:
            results.append(r)
    if failed:
        fail_ratio = failed / len(results_raw) if results_raw else 0
        print(f"  ⚠ {failed}/{len(results_raw)} frames failed ({fail_ratio:.0%})")
        if fail_ratio >= 0.3:
            raise RuntimeError(
                f"프레임 분석 {failed}/{len(results_raw)}개 실패 ({fail_ratio:.0%}). "
                f"AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요."
            )
        print(f"  → {len(results)}개 프레임으로 계속 진행합니다")
    # Sort by timestamp to maintain order
    return sorted(results, key=lambda q: q.timestamp)
