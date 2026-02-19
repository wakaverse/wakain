"""Phase 4: Full video analysis via Gemini API.

Uploads the full video file to Gemini, analyses audio (music/voice/SFX),
audio_visual_sync, overall structure, product_strategy, and effectiveness.
Uses the File API for large uploads.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time as time_mod
from pathlib import Path

from google import genai
from google.genai import types

from .schemas import (
    Audio,
    EffectivenessAssessment,
    Meta,
    ProductStrategy,
    Structure,
)

MODEL = "gemini-2.5-flash"
MAX_UPLOAD_SIZE_MB = 20

SYSTEM_INSTRUCTION = """\
You are a shortform marketing video analyst specialising in Korean commerce ads.
Analyse the uploaded video holistically — audio, structure, product strategy, and
effectiveness. Respond with valid JSON matching the requested schema exactly.

For audio analysis:
- Listen carefully to music, voice, and sound effects
- Identify music genre, energy, BPM range, beat synchronisation with cuts
- **CRITICAL: Produce a full timestamped transcript of ALL spoken words.**
  Each segment should have start/end times (seconds) and the exact text spoken.
  Use the original language (Korean). Split at natural sentence/phrase boundaries.
  Example: {"start": 0.0, "end": 1.5, "text": "김이 다 거기서 거기라고요?"}
- Summarise the voice script in Korean
- Note any sound effects used

For structure:
- Identify the overall narrative structure type
- Note scene sequence with roles and durations
- Pinpoint hook timing, product first appearance, CTA start

For product_strategy:
- How/when is the product revealed
- What benefits are highlighted
- Pricing, offers, social proof elements

For effectiveness_assessment:
- Rate and explain hook, flow, message clarity, CTA, replay factor
- List standout elements and weak points

For text_effects:
- Identify ALL text overlays that appear on screen with their timing
- For each text: when it appears (time), the content, entrance animation, exit animation,
  any emphasis effect, and what it syncs with (voice, beat, cut, or independent)

For scene_roles:
- Identify each scene's narrative role with start/end times
- Roles: hook, problem, solution, demo, proof, brand_intro, transition, cta, recap
- Include a concise description (1-2 sentences, in Korean) of what happens visually and narratively in each scene

For art_direction (아트 디렉션 — visual identity):
- tone_and_manner: Overall visual tone in Korean (e.g. '깔끔하고 신뢰감 있는 정보형', '트렌디하고 젊은 감성')
- Typography system: heading font family, body font family, font colors (hex), how keywords are highlighted
- Color system: brand/theme colors (hex), background style (solid/gradient/image/video/transparent/mixed), color temperature (warm/neutral/cool)
- Graphic identity: overall graphic style (clean_minimal/bold_graphic/playful_sticker/premium_elegant/retro_vintage/info_graphic/hand_drawn/photo_real), recurring visual elements (Korean)
- Layout system: where text typically appears, frame composition rule (Korean)
- Visual consistency assessment (high/medium/low)
- Style reference: what this style resembles (Korean, e.g. '쿠팡 라이브 스타일', '인스타 감성')

For persuasion_analysis (소구 분석 — CRITICAL):
- **presenter**: Who presents the video? (founder/reviewer/narrator/customer/expert/character/none)
  - Is their face shown? What gives them credibility?
- **video_style**: Overall style (pitch/demo/mukbang/comparison/vlog/review/info/story/challenge)
- **appeal_points**: List EVERY persuasion/appeal point in order of appearance:
  - Types (rational): myth_bust, ingredient, process, achievement, price, comparison, guarantee, origin, specification
  - Types (emotional): sensory, authenticity, social_proof, urgency, lifestyle, nostalgia, authority, emotional
  - For each: what specific claim is made? How is it VISUALLY proven? (closeup/slow_motion/process_shot/graph_number/etc.)
  - Rate each appeal's strength (strong/moderate/weak) based on how convincingly it's delivered
- **product_emphasis**: How is the product visually highlighted?
  - When does it first appear? How much screen time? How many hero/close-up shots?
  - What visual techniques are used? (closeup/zoom_in/texture_detail/steam_sizzle/before_after/etc.)
  - What is the single most impactful product visual moment?
- **primary_appeal**: Which single appeal type is the strongest?
- **appeal_layering**: How do appeals build on each other? Describe the sequence in Korean.
- **persuasion_summary**: 1-2 sentence summary of the overall persuasion strategy in Korean.
"""


class _VideoAnalysisResponse(Audio):
    """Full response schema for video analysis."""
    pass


# We need a flat response schema for Gemini, so define it inline
_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "meta": {
            "type": "OBJECT",
            "properties": {
                "platform": {"type": "STRING", "enum": ["tiktok", "reels", "shorts", "ad"]},
                "duration": {"type": "NUMBER"},
                "aspect_ratio": {"type": "STRING", "enum": ["9:16", "1:1", "16:9"]},
                "category": {"type": "STRING", "enum": ["beauty", "food", "tech", "fashion", "health", "home", "finance", "education"]},
                "sub_category": {"type": "STRING"},
                "target_audience": {"type": "STRING"},
            },
            "required": ["platform", "duration", "aspect_ratio", "category", "sub_category", "target_audience"],
        },
        "structure": {
            "type": "OBJECT",
            "properties": {
                "type": {"type": "STRING", "enum": ["problem_solution", "before_after", "demo", "review", "listicle", "story", "trend_ride"]},
                "scene_sequence": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "role": {"type": "STRING"},
                            "duration": {"type": "NUMBER"},
                            "technique": {"type": "STRING"},
                        },
                        "required": ["role", "duration", "technique"],
                    },
                },
                "hook_time": {"type": "NUMBER"},
                "product_first_appear": {"type": "NUMBER"},
                "cta_start": {"type": "NUMBER"},
            },
            "required": ["type", "scene_sequence", "hook_time", "product_first_appear", "cta_start"],
        },
        "audio": {
            "type": "OBJECT",
            "properties": {
                "music": {
                    "type": "OBJECT",
                    "properties": {
                        "present": {"type": "BOOLEAN"},
                        "genre": {"type": "STRING", "enum": ["upbeat_pop", "lo_fi", "dramatic", "trending_sound", "acoustic", "edm", "none"]},
                        "energy_profile": {"type": "STRING", "enum": ["steady", "building", "drop", "calm_to_hype"]},
                        "bpm_range": {"type": "STRING"},
                        "mood_match": {"type": "STRING"},
                        "beat_sync": {"type": "STRING"},
                    },
                    "required": ["present", "genre", "energy_profile", "bpm_range", "mood_match", "beat_sync"],
                },
                "voice": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["narration", "dialogue", "voiceover", "tts", "none"]},
                        "tone": {"type": "STRING", "enum": ["conversational", "professional", "excited", "asmr", "storytelling"]},
                        "language": {"type": "STRING"},
                        "script_summary": {"type": "STRING"},
                        "hook_line": {"type": "STRING"},
                        "cta_line": {"type": "STRING"},
                        "transcript": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "start": {"type": "NUMBER"},
                                    "end": {"type": "NUMBER"},
                                    "text": {"type": "STRING"},
                                    "speaker": {"type": "STRING"},
                                },
                                "required": ["start", "end", "text"],
                            },
                        },
                    },
                    "required": ["type", "tone", "language", "script_summary", "hook_line", "cta_line", "transcript"],
                },
                "sfx": {
                    "type": "OBJECT",
                    "properties": {
                        "used": {"type": "BOOLEAN"},
                        "types": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "frequency": {"type": "STRING", "enum": ["heavy", "moderate", "minimal", "none"]},
                    },
                    "required": ["used", "types", "frequency"],
                },
                "audio_visual_sync": {"type": "STRING"},
            },
            "required": ["music", "voice", "sfx", "audio_visual_sync"],
        },
        "product_strategy": {
            "type": "OBJECT",
            "properties": {
                "reveal_timing": {"type": "STRING", "enum": ["immediate", "gradual", "delayed_reveal", "teaser"]},
                "demonstration_method": {"type": "STRING", "enum": ["in_use", "comparison", "transformation", "testimonial", "spec_highlight", "unboxing"]},
                "key_benefit_shown": {"type": "STRING"},
                "price_shown": {"type": "BOOLEAN"},
                "price_framing": {"type": "STRING", "enum": ["discount", "per_day", "vs_competitor", "bundle", "none"]},
                "offer_type": {"type": "STRING"},
                "social_proof": {"type": "STRING", "enum": ["reviews", "ugc", "numbers", "celebrity", "expert", "none"]},
                "urgency_trigger": {"type": "STRING", "enum": ["time_limit", "stock_limit", "trend", "none"]},
                "brand_visibility": {
                    "type": "OBJECT",
                    "properties": {
                        "logo_shown": {"type": "BOOLEAN"},
                        "brand_color_used": {"type": "BOOLEAN"},
                        "brand_mention_count": {"type": "INTEGER"},
                    },
                    "required": ["logo_shown", "brand_color_used", "brand_mention_count"],
                },
            },
            "required": [
                "reveal_timing", "demonstration_method", "key_benefit_shown",
                "price_shown", "price_framing", "offer_type", "social_proof",
                "urgency_trigger", "brand_visibility",
            ],
        },
        "effectiveness_assessment": {
            "type": "OBJECT",
            "properties": {
                "hook_rating": {"type": "STRING"},
                "flow_rating": {"type": "STRING"},
                "message_clarity": {"type": "STRING"},
                "cta_strength": {"type": "STRING"},
                "replay_factor": {"type": "STRING"},
                "standout_elements": {"type": "ARRAY", "items": {"type": "STRING"}},
                "weak_points": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
            "required": [
                "hook_rating", "flow_rating", "message_clarity",
                "cta_strength", "replay_factor", "standout_elements", "weak_points",
            ],
        },
        "text_effects": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "time": {"type": "NUMBER"},
                    "content": {"type": "STRING"},
                    "entrance": {"type": "STRING", "enum": ["fade_in", "slide_up", "slide_left", "pop", "typewriter", "cut", "none"]},
                    "exit": {"type": "STRING", "enum": ["fade_out", "slide_down", "cut", "none"]},
                    "emphasis": {"type": "STRING", "enum": ["color_highlight", "size_pulse", "shake", "glow", "underline", "none"]},
                    "sync_with": {"type": "STRING", "enum": ["voice", "beat", "cut", "independent"]},
                },
                "required": ["time", "content", "entrance", "exit", "sync_with"],
            },
        },
        "scene_roles": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "role": {"type": "STRING", "enum": ["hook", "problem", "solution", "demo", "proof", "brand_intro", "transition", "cta", "recap"]},
                    "description": {"type": "STRING"},
                },
                "required": ["start", "end", "role", "description"],
            },
        },
        "persuasion_analysis": {
            "type": "OBJECT",
            "properties": {
                "presenter": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["founder", "reviewer", "narrator", "customer", "expert", "character", "none"]},
                        "face_shown": {"type": "BOOLEAN"},
                        "credibility_factor": {"type": "STRING"},
                    },
                    "required": ["type", "face_shown", "credibility_factor"],
                },
                "video_style": {
                    "type": "OBJECT",
                    "properties": {
                        "type": {"type": "STRING", "enum": ["pitch", "demo", "mukbang", "comparison", "vlog", "review", "info", "story", "challenge"]},
                        "sub_style": {"type": "STRING"},
                    },
                    "required": ["type", "sub_style"],
                },
                "appeal_points": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "type": {"type": "STRING", "enum": [
                                "myth_bust", "ingredient", "process", "achievement", "price",
                                "comparison", "guarantee", "origin", "specification",
                                "sensory", "authenticity", "social_proof", "urgency",
                                "lifestyle", "nostalgia", "authority", "emotional",
                            ]},
                            "claim": {"type": "STRING"},
                            "visual_proof": {
                                "type": "OBJECT",
                                "properties": {
                                    "technique": {"type": "STRING", "enum": [
                                        "closeup", "slow_motion", "split_screen", "before_after",
                                        "text_overlay", "reaction_shot", "process_shot", "package_shot",
                                        "ingredient_shot", "location_shot", "graph_number", "none",
                                    ]},
                                    "description": {"type": "STRING"},
                                    "timestamp": {"type": "NUMBER"},
                                },
                                "required": ["technique", "description", "timestamp"],
                            },
                            "audio_sync": {"type": "STRING", "enum": [
                                "narration_sync", "text_only", "sfx_emphasis", "music_beat", "silent", "independent",
                            ]},
                            "strength": {"type": "STRING", "enum": ["strong", "moderate", "weak"]},
                        },
                        "required": ["type", "claim", "visual_proof", "audio_sync", "strength"],
                    },
                },
                "product_emphasis": {
                    "type": "OBJECT",
                    "properties": {
                        "first_appear": {"type": "NUMBER"},
                        "screen_time_ratio": {"type": "NUMBER"},
                        "hero_shots": {"type": "INTEGER"},
                        "emphasis_techniques": {
                            "type": "ARRAY",
                            "items": {"type": "STRING", "enum": [
                                "closeup", "slow_motion", "zoom_in", "spotlight",
                                "rotation", "unboxing", "size_comparison",
                                "texture_detail", "steam_sizzle", "pour_drip",
                                "before_after", "multi_angle", "ingredient_breakdown",
                                "in_use_demo", "package_focus",
                            ]},
                        },
                        "key_visual_moment": {"type": "STRING"},
                        "key_visual_timestamp": {"type": "NUMBER"},
                    },
                    "required": ["first_appear", "screen_time_ratio", "hero_shots", "emphasis_techniques", "key_visual_moment", "key_visual_timestamp"],
                },
                "primary_appeal": {"type": "STRING", "enum": [
                    "myth_bust", "ingredient", "process", "achievement", "price",
                    "comparison", "guarantee", "origin", "specification",
                    "sensory", "authenticity", "social_proof", "urgency",
                    "lifestyle", "nostalgia", "authority", "emotional",
                ]},
                "appeal_layering": {"type": "STRING"},
                "persuasion_summary": {"type": "STRING"},
            },
            "required": ["presenter", "video_style", "appeal_points", "product_emphasis", "primary_appeal", "appeal_layering", "persuasion_summary"],
        },
    },
    "required": ["meta", "structure", "audio", "product_strategy", "effectiveness_assessment", "text_effects", "scene_roles", "persuasion_analysis"],
}

# Separate schema for art_direction (to stay under Gemini schema complexity limit)
_ART_DIRECTION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "art_direction": {
            "type": "OBJECT",
            "properties": {
                "tone_and_manner": {"type": "STRING"},
                "heading_font": {"type": "STRING"},
                "body_font": {"type": "STRING"},
                "font_color_system": {"type": "ARRAY", "items": {"type": "STRING"}},
                "highlight_method": {"type": "STRING"},
                "brand_colors": {"type": "ARRAY", "items": {"type": "STRING"}},
                "background_style": {"type": "STRING", "enum": [
                    "solid_color", "gradient", "image_bg", "video_bg", "transparent", "mixed",
                ]},
                "color_temperature": {"type": "STRING", "enum": ["warm", "neutral", "cool"]},
                "graphic_style": {"type": "STRING", "enum": [
                    "clean_minimal", "bold_graphic", "playful_sticker", "premium_elegant",
                    "retro_vintage", "info_graphic", "hand_drawn", "photo_real",
                ]},
                "recurring_elements": {"type": "ARRAY", "items": {"type": "STRING"}},
                "text_position_pattern": {"type": "STRING"},
                "frame_composition_rule": {"type": "STRING"},
                "visual_consistency": {"type": "STRING", "enum": ["high", "medium", "low"]},
                "style_reference": {"type": "STRING"},
            },
            "required": [
                "tone_and_manner", "heading_font", "body_font", "font_color_system",
                "highlight_method", "brand_colors", "background_style", "color_temperature",
                "graphic_style", "recurring_elements", "text_position_pattern",
                "frame_composition_rule", "visual_consistency", "style_reference",
            ],
        },
    },
    "required": ["art_direction"],
}


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY_PRO") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    key_label = "PRO" if os.environ.get("GEMINI_API_KEY_PRO") else "FREE"
    print(f"  Using Gemini API key: {key_label}")
    return genai.Client(api_key=api_key)


def _resize_video(video_path: str | Path, max_mb: int = MAX_UPLOAD_SIZE_MB, resolution: int = 720) -> Path:
    """Re-encode video to fit under max_mb using ffmpeg if needed."""
    src = Path(video_path)
    size_mb = src.stat().st_size / (1024 * 1024)

    if size_mb <= max_mb:
        return src

    print(f"  Video is {size_mb:.1f}MB (>{max_mb}MB), re-encoding for upload...")

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found. Install ffmpeg to resize large videos.")

    tmp = Path(tempfile.mktemp(suffix=".mp4"))
    # Target bitrate to fit under max_mb
    # Get duration first
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(src)],
        capture_output=True, text=True,
    )
    duration = float(probe.stdout.strip())
    target_bitrate = int((max_mb * 8 * 1024) / duration * 0.9)  # 90% safety margin

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src),
         "-vf", f"scale=-2:{resolution}",
         "-b:v", f"{target_bitrate}k",
         "-c:v", "libx264", "-preset", "fast",
         "-c:a", "aac", "-b:a", "64k",
         "-movflags", "+faststart",
         str(tmp)],
        capture_output=True, check=True,
    )

    new_size = tmp.stat().st_size / (1024 * 1024)
    print(f"  Re-encoded: {new_size:.1f}MB")
    return tmp


def _upload_video(client: genai.Client, video_path: Path) -> types.File:
    """Upload video to Gemini File API with polling for processing."""
    print(f"  Uploading {video_path.name} to Gemini File API...")
    uploaded = client.files.upload(file=video_path)

    # Poll until file is processed
    while uploaded.state.name == "PROCESSING":
        print(f"  Processing... (state={uploaded.state.name})")
        time_mod.sleep(5)
        uploaded = client.files.get(name=uploaded.name)

    if uploaded.state.name == "FAILED":
        raise RuntimeError(f"File upload failed: {uploaded.state}")

    print(f"  Upload complete: {uploaded.name} (state={uploaded.state.name})")
    return uploaded


async def analyse_video(
    video_path: str | Path,
    resolution: int = 720,
) -> dict:
    """Upload video to Gemini and get full analysis (audio, structure, product, effectiveness)."""
    client = _make_client()
    video_path = Path(video_path)

    # Resize if too large
    max_mb = 20 if resolution >= 720 else 10
    upload_path = _resize_video(video_path, max_mb=max_mb, resolution=resolution)
    is_temp = upload_path != video_path

    try:
        # Upload via File API
        uploaded_file = _upload_video(client, upload_path)

        prompt = """Analyse this shortform marketing video completely.

Return a JSON object with these sections:
1. meta: platform, duration, aspect_ratio, category, sub_category, target_audience
2. structure: type, scene_sequence (role + duration + technique for each), hook_time, product_first_appear, cta_start
3. audio: music (genre, energy, BPM, beat_sync), voice (type, tone, script_summary, hook_line, cta_line, **transcript with timestamps**), sfx, audio_visual_sync
4. product_strategy: reveal_timing, demonstration_method, key_benefit, pricing, social_proof, urgency, brand_visibility
5. effectiveness_assessment: ratings for hook, flow, clarity, CTA, replay + standout elements + weak points
6. text_effects: list every on-screen text animation (time, content, entrance, exit, emphasis, sync_with)
7. scene_roles: list each scene's start/end time and narrative role
8. persuasion_analysis: CRITICAL — analyse the video's persuasion strategy:
   - presenter: who speaks/presents (founder/reviewer/narrator/etc.), face shown?, credibility factor
   - video_style: overall style (pitch/demo/mukbang/comparison/review/etc.)
   - appeal_points: list EVERY persuasion point with: type, specific claim, visual_proof (technique + description + timestamp), audio_sync, strength
   - product_emphasis: first_appear time, screen_time_ratio, hero_shots count, emphasis_techniques, key_visual_moment + timestamp
   - primary_appeal: the single strongest appeal type
   - appeal_layering: how appeals build on each other (in Korean)
   - persuasion_summary: 1-2 sentence summary of persuasion strategy (in Korean)

Be specific and detailed. Use Korean for script_summary, hook_line, cta_line, persuasion_summary, appeal claims, and descriptions."""

        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = await client.aio.models.generate_content(
                    model=MODEL,
                    contents=[
                        types.Part.from_uri(
                            file_uri=uploaded_file.uri,
                            mime_type=uploaded_file.mime_type,
                        ),
                        types.Part.from_text(text=prompt),
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=_RESPONSE_SCHEMA,
                        temperature=0.1,
                    ),
                )
                result = json.loads(response.text)
                break
            except Exception as e:
                wait = 2 ** attempt * 5
                if attempt < max_retries - 1:
                    print(f"  ⚠ Video analysis retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    raise RuntimeError(f"Video analysis failed after {max_retries} retries: {e}") from e

        # Phase 4b: Art direction (separate call, same uploaded file)
        print("  Analysing art direction...")
        art_prompt = """Analyse this shortform marketing video's visual identity and art direction.

Return a JSON object with art_direction containing:
- tone_and_manner: overall visual tone in Korean (e.g. '깔끔하고 신뢰감 있는 정보형')
- heading_font: primary heading font family (gothic/rounded/serif/handwritten/display)
- body_font: body/subtitle font family
- font_color_system: list of text colors used (hex)
- highlight_method: how key words are emphasized (Korean)
- brand_colors: brand/theme colors (hex list)
- background_style: solid_color/gradient/image_bg/video_bg/transparent/mixed
- color_temperature: warm/neutral/cool
- graphic_style: clean_minimal/bold_graphic/playful_sticker/premium_elegant/retro_vintage/info_graphic/hand_drawn/photo_real
- recurring_elements: repeated visual elements (Korean list)
- text_position_pattern: where text typically appears
- frame_composition_rule: layout rule in Korean
- visual_consistency: high/medium/low
- style_reference: what this style resembles in Korean"""

        for attempt in range(max_retries):
            try:
                art_response = await client.aio.models.generate_content(
                    model=MODEL,
                    contents=[
                        types.Part.from_uri(
                            file_uri=uploaded_file.uri,
                            mime_type=uploaded_file.mime_type,
                        ),
                        types.Part.from_text(text=art_prompt),
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=_ART_DIRECTION_SCHEMA,
                        temperature=0.1,
                    ),
                )
                art_data = json.loads(art_response.text)
                result["art_direction"] = art_data.get("art_direction", art_data)
                print("  ✓ Art direction complete")
                break
            except Exception as e:
                wait = 2 ** attempt * 5
                if attempt < max_retries - 1:
                    print(f"  ⚠ Art direction retry {attempt+1}/{max_retries} ({type(e).__name__}), waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    print(f"  ⚠ Art direction failed after {max_retries} retries, skipping: {e}")

        return result
    finally:
        # Clean up temp file
        if is_temp and upload_path.exists():
            upload_path.unlink()


def run_video_analysis(video_path: str | Path, resolution: int = 720) -> dict:
    """Sync wrapper for analyse_video."""
    return asyncio.run(analyse_video(video_path, resolution=resolution))
