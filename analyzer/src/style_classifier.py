"""DEPRECATED: Phase 0.1 Style Classifier — replaced by product_scanner.py.

This module is kept for backward compatibility with existing _style.json files.
New code should use product_scanner.scan_product() instead.

Original: Phase 0.1: Video style classification — Format × Intent 2-axis system.

Classifies video by:
  - Format (how it's made): talking_head, ugc_vlog, caption_text, product_demo,
    asmr_mood, comparison, story_problem, listicle, entertainment
  - Intent (what it achieves): commerce, branding, information, entertainment

Supports:
  - Auto mode: Gemini Flash Lite auto-classifies from video
  - Manual override: CLI --format / --intent
  - Composite: primary + secondary format

Usage:
    from src.style_classifier import classify_style, StyleClassification
    style = classify_style("video.mp4")  # Auto mode
    style = classify_style("video.mp4", format_hint="talking_head", intent_hint="commerce")
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ── Enums ────────────────────────────────────────────────────────────────────


class VideoFormat(str, Enum):
    TALKING_HEAD = "talking_head"       # 진행자형
    UGC_VLOG = "ugc_vlog"              # UGC/브이로그형
    CAPTION_TEXT = "caption_text"       # 캡션/텍스트형
    PRODUCT_DEMO = "product_demo"      # 데모/언박싱형
    ASMR_MOOD = "asmr_mood"            # ASMR/감성형
    COMPARISON = "comparison"          # 비교형
    STORY_PROBLEM = "story_problem"    # 스토리/문제해결형
    LISTICLE = "listicle"              # 나열형
    ENTERTAINMENT = "entertainment"    # 엔터테인먼트형


class VideoIntent(str, Enum):
    COMMERCE = "commerce"              # 커머스/세일즈
    BRANDING = "branding"              # 브랜딩/이미지
    INFORMATION = "information"        # 정보 전달
    ENTERTAINMENT = "entertainment"    # 엔터테인먼트/바이럴


FORMAT_LABELS_KO = {
    "talking_head": "진행자형",
    "ugc_vlog": "UGC/브이로그형",
    "caption_text": "캡션/텍스트형",
    "product_demo": "데모/언박싱형",
    "asmr_mood": "ASMR/감성형",
    "comparison": "비교형",
    "story_problem": "스토리/문제해결형",
    "listicle": "나열형",
    "entertainment": "엔터테인먼트형",
}

INTENT_LABELS_KO = {
    "commerce": "커머스/세일즈",
    "branding": "브랜딩/이미지",
    "information": "정보 전달",
    "entertainment": "엔터테인먼트",
}


# ── Classification result ────────────────────────────────────────────────────


@dataclass
class StyleClassification:
    """2-axis style classification result."""
    primary_format: str           # VideoFormat value
    primary_intent: str           # VideoIntent value
    secondary_format: str | None = None  # composite style
    format_confidence: float = 0.0
    intent_confidence: float = 0.0
    auto_classified: bool = True  # False if user-specified
    reasoning: str = ""           # Gemini's reasoning (Auto mode)

    def to_dict(self) -> dict:
        return {
            "primary_format": self.primary_format,
            "primary_format_ko": FORMAT_LABELS_KO.get(self.primary_format, self.primary_format),
            "secondary_format": self.secondary_format,
            "secondary_format_ko": FORMAT_LABELS_KO.get(self.secondary_format, "") if self.secondary_format else None,
            "primary_intent": self.primary_intent,
            "primary_intent_ko": INTENT_LABELS_KO.get(self.primary_intent, self.primary_intent),
            "format_confidence": round(self.format_confidence, 2),
            "intent_confidence": round(self.intent_confidence, 2),
            "auto_classified": self.auto_classified,
            "reasoning": self.reasoning,
        }

    @property
    def style_key(self) -> str:
        """Key for style profile lookup: format__intent."""
        return f"{self.primary_format}__{self.primary_intent}"


# ── Gemini Auto classification ───────────────────────────────────────────────

CLASSIFICATION_PROMPT = """\
You are a shortform marketing video classifier. Analyze this video and classify it on two axes.

## Axis 1: Format (영상 형식) — how the video is made
Choose ONE primary and optionally ONE secondary:
- talking_head: 진행자/발표자가 말하며 설명
- ugc_vlog: 실사용자 리얼 후기, 일상 느낌
- caption_text: 무음 또는 BGM만 + 텍스트 오버레이 중심
- product_demo: 제품 기능 시연, 언박싱
- asmr_mood: 시각+청각 감성 자극, 무드 중심
- comparison: A vs B 직접 비교
- story_problem: 문제→해결 서사 구조
- listicle: 여러 제품/항목 나열 소개
- entertainment: 반전/유머/밈 중심

## Axis 2: Intent (영상 의도) — what the video aims to achieve
Choose ONE:
- commerce: 즉각적인 구매/전환 유도 (가격, CTA, 할인 등)
- branding: 브랜드 인지도/이미지 구축
- information: 교육/설명/정보 전달
- entertainment: 바이럴/공유/즐거움

## Response format (JSON only, no markdown):
{
  "primary_format": "...",
  "secondary_format": null or "...",
  "primary_intent": "...",
  "format_confidence": 0.0-1.0,
  "intent_confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation in Korean"
}
"""

# Use Gemini Flash Lite for cost efficiency
AUTO_MODEL = "gemini-2.5-flash-lite"


def _prepare_video_for_upload(video_path: str, max_size_mb: int = 20) -> str:
    """Downscale video if too large for Gemini upload."""
    file_size = os.path.getsize(video_path) / (1024 * 1024)
    if file_size <= max_size_mb:
        return video_path

    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.close()
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", "scale=-2:480",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "aac", "-b:a", "64k",
        tmp.name,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return tmp.name


def classify_style_auto(video_path: str) -> StyleClassification:
    """Auto-classify video style using Gemini Flash Lite."""
    client = genai.Client()

    # Upload video
    upload_path = _prepare_video_for_upload(video_path)
    try:
        uploaded = client.files.upload(file=upload_path)

        # Wait for processing
        while uploaded.state.name == "PROCESSING":
            time.sleep(1)
            uploaded = client.files.get(name=uploaded.name)

        if uploaded.state.name != "ACTIVE":
            raise RuntimeError(f"File upload failed: {uploaded.state.name}")

        # Classify
        response = client.models.generate_content(
            model=AUTO_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(
                            file_uri=uploaded.uri,
                            mime_type=uploaded.mime_type,
                        ),
                        types.Part.from_text(text=CLASSIFICATION_PROMPT),
                    ],
                ),
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=500,
            ),
        )

        # Parse response
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)

        return StyleClassification(
            primary_format=data["primary_format"],
            primary_intent=data["primary_intent"],
            secondary_format=data.get("secondary_format"),
            format_confidence=data.get("format_confidence", 0.0),
            intent_confidence=data.get("intent_confidence", 0.0),
            auto_classified=True,
            reasoning=data.get("reasoning", ""),
        )

    finally:
        # Cleanup uploaded file
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass
        # Cleanup temp file
        if upload_path != video_path and os.path.exists(upload_path):
            os.unlink(upload_path)


# ── Main entry point ─────────────────────────────────────────────────────────


def classify_style(
    video_path: str,
    format_hint: str | None = None,
    intent_hint: str | None = None,
) -> StyleClassification:
    """Classify video style. Uses manual hints if provided, otherwise Auto mode.

    Args:
        video_path: Path to video file
        format_hint: Manual format override (skips auto for format)
        intent_hint: Manual intent override (skips auto for intent)

    Returns:
        StyleClassification with format × intent
    """
    # Both specified manually → no API call needed
    if format_hint and intent_hint:
        return StyleClassification(
            primary_format=format_hint,
            primary_intent=intent_hint,
            auto_classified=False,
            format_confidence=1.0,
            intent_confidence=1.0,
            reasoning="사용자 지정",
        )

    # Auto classify
    try:
        result = classify_style_auto(video_path)
    except Exception as e:
        logger.error(f"[Phase 0.1] Auto classification failed: {e}")
        print(f"  ⚠️  자동 분류 실패: {e}. 기본값(caption_text × commerce)으로 대체합니다.")
        result = StyleClassification(
            primary_format="caption_text",
            primary_intent="commerce",
            auto_classified=True,
            format_confidence=0.0,
            intent_confidence=0.0,
            reasoning=f"자동 분류 실패 — 기본값 사용 ({type(e).__name__})",
        )

    # Override with manual hints
    if format_hint:
        result.primary_format = format_hint
        result.format_confidence = 1.0
        result.auto_classified = False
    if intent_hint:
        result.primary_intent = intent_hint
        result.intent_confidence = 1.0
        result.auto_classified = False

    return result


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Phase 0.1: Style classification")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--format", dest="fmt", help="Manual format hint")
    parser.add_argument("--intent", help="Manual intent hint")
    parser.add_argument("--output", "-o", help="Output directory")
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    result = classify_style(args.video, format_hint=args.fmt, intent_hint=args.intent)

    print(f"\n[Phase 0.1] Style Classification:")
    print(f"  format:  {result.primary_format} ({FORMAT_LABELS_KO.get(result.primary_format, '')})"
          f" [{result.format_confidence:.0%}]")
    if result.secondary_format:
        print(f"  format2: {result.secondary_format} ({FORMAT_LABELS_KO.get(result.secondary_format, '')})")
    print(f"  intent:  {result.primary_intent} ({INTENT_LABELS_KO.get(result.primary_intent, '')})"
          f" [{result.intent_confidence:.0%}]")
    print(f"  auto:    {result.auto_classified}")
    print(f"  reason:  {result.reasoning}")

    if args.output:
        out = Path(args.output)
        out.mkdir(parents=True, exist_ok=True)
        video_name = Path(args.video).stem
        path = out / f"{video_name}_style.json"
        path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
        print(f"  → saved to {path}")
