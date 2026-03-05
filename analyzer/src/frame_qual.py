"""Phase 2: Gemini Flash Lite qualitative frame analysis (batched).

Sends frames in batches (4-5 per call) to reduce API call count.
Returns structured FrameQual JSON per frame.

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
BATCH_SIZE = 5          # frames per API call
MAX_CONCURRENCY = 2     # simultaneous batch calls
REQUEST_DELAY = 0.3     # seconds between batch requests

SYSTEM_INSTRUCTION = """\
You are a shortform marketing video analyst. You analyse individual frames
to extract structured visual metadata for building a video recipe.

You will receive MULTIPLE frames in a single request. Analyse EACH frame independently
and return a JSON array with one object per frame, in the SAME ORDER as the images.

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
"""


_DEFAULT_FRAME = {
    "timestamp": 0,
    "shot_type": "medium",
    "subject_type": "lifestyle_scene",
    "composition": {"layout": "center", "visual_weight": "center", "depth": "flat"},
    "text_overlay": None,
    "product_presentation": {"visibility": "hidden", "angle": "front", "context": "studio"},
    "human_element": {"role": "none", "emotion": "neutral", "eye_contact": False, "gesture": "none"},
    "color_mood": "bold_contrast",
    "attention_element": "main subject",
    "artwork": None,
}

_DEFAULT_ARTWORK = {
    "typography": None,
    "graphic_elements": ["none"],
    "layout_zones": {"top": "empty", "middle": "empty", "bottom": "empty", "text_product_overlap": False},
    "color_design": {"primary_color": "#000000", "text_bg_contrast": "medium", "color_harmony": "monochrome"},
}


def _deep_merge(defaults: dict, data: dict) -> dict:
    """Merge data onto defaults recursively. data values take priority."""
    result = dict(defaults)
    for k, v in data.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def _fill_defaults(item: dict) -> dict:
    """Ensure all required FrameQual fields exist with valid defaults."""
    merged = _deep_merge(_DEFAULT_FRAME, item)
    # Fix nested objects that Gemini might partially return
    for key, defaults in [
        ("composition", _DEFAULT_FRAME["composition"]),
        ("product_presentation", _DEFAULT_FRAME["product_presentation"]),
        ("human_element", _DEFAULT_FRAME["human_element"]),
    ]:
        if isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(defaults, merged[key])
        elif merged.get(key) is None:
            merged[key] = dict(defaults)
    # Artwork sub-fields
    if isinstance(merged.get("artwork"), dict):
        merged["artwork"] = _deep_merge(_DEFAULT_ARTWORK, merged["artwork"])
    return merged


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY_PRO", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY or GEMINI_API_KEY_PRO environment variable is not set. "
            "Copy .env.example to .env and fill in your key."
        )
    key_type = "PRO (Tier 3)" if os.environ.get("GEMINI_API_KEY_PRO") else "Free"
    print(f"  Using Gemini API key: {key_type}")
    return genai.Client(api_key=api_key)


async def _analyse_batch(
    client: genai.Client,
    semaphore: asyncio.Semaphore,
    batch: list[tuple[float, bytes]],
) -> list[tuple[float, dict]]:
    """Send a batch of frames to Gemini and return list of (timestamp, parsed_dict)."""

    # Build contents: image parts interleaved with frame labels
    parts = []
    timestamps = []
    for i, (ts, jpeg_bytes) in enumerate(batch):
        timestamps.append(ts)
        parts.append(types.Part.from_text(text=f"[Frame {i+1}: timestamp={ts:.2f}s]"))
        parts.append(types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"))

    parts.append(types.Part.from_text(
        text=f"Analyse all {len(batch)} frames above. "
             f"Return a JSON array of {len(batch)} FrameQual objects in the same order."
    ))

    max_retries = 5
    async with semaphore:
        await asyncio.sleep(REQUEST_DELAY)
        for attempt in range(max_retries):
            try:
                response = await client.aio.models.generate_content(
                    model=MODEL,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                text = response.text.strip()
                data = json.loads(text)

                # Handle both array and single object
                if isinstance(data, dict):
                    data = [data]

                results = []
                for j, ts in enumerate(timestamps):
                    if j < len(data):
                        item = data[j]
                        item["timestamp"] = ts
                        # Merge with complete defaults so Pydantic never fails
                        item = _fill_defaults(item)
                        results.append((ts, item))
                    else:
                        print(f"  ⚠ Batch missing frame {ts}s (got {len(data)}/{len(batch)})")

                return results

            except Exception as e:
                wait = 2 ** attempt * 5  # 5, 10, 20, 40, 80s
                err_name = type(e).__name__
                ts_range = f"{timestamps[0]:.1f}s-{timestamps[-1]:.1f}s"
                if attempt < max_retries - 1:
                    print(f"  ⚠ Batch [{ts_range}] retry {attempt+1}/{max_retries} ({err_name}), waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    print(f"  ⚠ Batch [{ts_range}] failed after {max_retries} retries, skipping: {e}")
                    return []  # skip this batch instead of crashing the pipeline

    return []  # unreachable but satisfies type checker


async def analyse_frames_qual(
    jpeg_frames: list[tuple[float, bytes]],
    quants: list[FrameQuant],
    concurrency: int = MAX_CONCURRENCY,
) -> list[FrameQual]:
    """Analyse all frames in batched parallel calls.

    Parameters
    ----------
    jpeg_frames : list of (timestamp, jpeg_bytes)
    quants : list of FrameQuant matching each frame (unused in lite mode, kept for API compat)
    concurrency : max simultaneous batch API calls
    """
    client = _make_client()
    semaphore = asyncio.Semaphore(concurrency)

    # Split frames into batches
    batches = []
    for i in range(0, len(jpeg_frames), BATCH_SIZE):
        batches.append(jpeg_frames[i:i + BATCH_SIZE])

    total_frames = len(jpeg_frames)
    total_batches = len(batches)
    print(f"  Phase 2: {total_frames} frames → {total_batches} batches (×{BATCH_SIZE})")

    tasks = [_analyse_batch(client, semaphore, batch) for batch in batches]
    results_raw = await asyncio.gather(*tasks, return_exceptions=True)

    # Collect and validate results
    all_results: list[FrameQual] = []
    failed_batches = 0
    for i, r in enumerate(results_raw):
        if isinstance(r, Exception):
            batch = batches[i]
            ts_range = f"{batch[0][0]:.1f}s-{batch[-1][0]:.1f}s"
            print(f"  ⚠ Batch [{ts_range}] failed, skipping {len(batch)} frames: {r}")
            failed_batches += 1
        else:
            for ts, item_dict in r:
                try:
                    fq = FrameQual.model_validate(item_dict)
                    all_results.append(fq)
                except Exception as e:
                    print(f"  ⚠ Frame {ts}s validation failed, skipping: {e}")

    failed_frames = sum(len(batches[i]) for i, r in enumerate(results_raw) if isinstance(r, Exception))
    if failed_frames:
        fail_ratio = failed_frames / total_frames if total_frames else 0
        print(f"  ⚠ {failed_frames}/{total_frames} frames failed ({fail_ratio:.0%})")
        if fail_ratio >= 0.5:
            raise RuntimeError(
                f"프레임 분석 {failed_frames}/{total_frames}개 실패 ({fail_ratio:.0%}). "
                f"AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요."
            )
        print(f"  → {len(all_results)}개 프레임으로 계속 진행합니다")

    # Sort by timestamp
    return sorted(all_results, key=lambda q: q.timestamp)
