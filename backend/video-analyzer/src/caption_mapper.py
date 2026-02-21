"""Phase C-8: Caption timeline story mapping.

Transforms frame-level OCR text overlays into a deduplicated, time-ordered
caption story map — the primary analysis input for caption-track videos.

Each caption "event" represents a distinct text message with:
  - start/end time
  - text content
  - detected purpose (hook/problem/solution/proof/cta/brand/benefit/etc.)
  - persuasion role in the narrative flow

Usage:
    from src.caption_mapper import build_caption_map
    caption_map = build_caption_map(frame_quals)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional

logger = logging.getLogger(__name__)

# ── Similarity threshold for dedup ──────────────────────────────────────────

SIMILARITY_THRESHOLD = 0.7  # texts with >70% similarity are considered same caption


def _text_similarity(a: str, b: str) -> float:
    """Quick similarity ratio between two strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _normalize_text(text: str) -> str:
    """Normalize OCR text for comparison: strip, collapse whitespace, lowercase."""
    if not text:
        return ""
    # Remove common OCR noise
    text = re.sub(r"[│|┃]", "", text)
    # Collapse newlines into spaces for comparison
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_primary_text(content: str) -> str:
    """Extract the primary (most important) text line from multi-line OCR content."""
    if not content:
        return ""
    lines = [l.strip() for l in content.split("\n") if l.strip()]
    if not lines:
        return ""
    # Filter out very short fragments (likely noise)
    meaningful = [l for l in lines if len(l) > 2]
    return meaningful[0] if meaningful else lines[0]


# ── Caption event ────────────────────────────────────────────────────────────


@dataclass
class CaptionEvent:
    """A distinct caption appearance in the video timeline."""
    start: float        # seconds
    end: float          # seconds
    text: str           # primary text content
    full_text: str      # full OCR content (may include multiple lines)
    purpose: str        # from frame_qual: brand, benefit, cta, info, etc.
    font_style: str     # from frame_qual
    narrative_role: str = ""  # hook, problem, solution, proof, cta, transition, etc.

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        return {
            "start": round(self.start, 2),
            "end": round(self.end, 2),
            "duration": round(self.duration, 2),
            "text": self.text,
            "full_text": self.full_text,
            "purpose": self.purpose,
            "font_style": self.font_style,
            "narrative_role": self.narrative_role,
        }


# ── Narrative role detection ─────────────────────────────────────────────────

_ROLE_PATTERNS = {
    "hook": re.compile(
        r"(하시죠|하시나요|아시나요|고민|문제|모르|알고|비밀|충격|놀라|궁금|혹시|이거|진짜|대박)",
        re.IGNORECASE,
    ),
    "problem": re.compile(
        r"(문제|고민|힘들|피곤|아프|안 좋|걱정|스트레스|지쳤|독소|염증|노화|탈모|여드름)",
        re.IGNORECASE,
    ),
    "solution": re.compile(
        r"(해결|방법|비결|성분|효과|도움|개선|달라|바꿔|이것만|이거면|덕분)",
        re.IGNORECASE,
    ),
    "proof": re.compile(
        r"(임상|결과|연구|인증|특허|수상|판매량|\d+%|\d+만|검증|실험|데이터|효과)",
        re.IGNORECASE,
    ),
    "cta": re.compile(
        r"(지금|클릭|구매|주문|할인|무료|이벤트|링크|쿠폰|한정|오늘만|서두르|마감|혜택)",
        re.IGNORECASE,
    ),
    "brand": re.compile(
        r"(브랜드|로고|공식|official|\.com|\.kr|@)",
        re.IGNORECASE,
    ),
}


def _detect_narrative_role(text: str, purpose: str, position_ratio: float) -> str:
    """Detect narrative role from text content, purpose, and position in video.

    Args:
        text: caption text
        purpose: frame_qual purpose tag
        position_ratio: 0.0 (start) to 1.0 (end)
    """
    # Purpose-based shortcuts
    if purpose == "cta":
        return "cta"
    if purpose == "brand" and position_ratio > 0.8:
        return "brand_close"
    if purpose == "brand" and position_ratio < 0.2:
        return "brand_intro"

    # Pattern matching
    scores = {}
    for role, pattern in _ROLE_PATTERNS.items():
        matches = pattern.findall(text)
        scores[role] = len(matches)

    # Position bias
    if position_ratio < 0.15:
        scores["hook"] = scores.get("hook", 0) + 2
    elif position_ratio > 0.85:
        scores["cta"] = scores.get("cta", 0) + 2

    best_role = max(scores, key=scores.get) if scores else "info"
    if scores.get(best_role, 0) == 0:
        # No pattern matched — infer from position
        if position_ratio < 0.2:
            return "hook"
        elif position_ratio > 0.8:
            return "cta"
        else:
            return "info"

    return best_role


# ── Main builder ─────────────────────────────────────────────────────────────


def build_caption_map(frame_quals: list[dict]) -> list[CaptionEvent]:
    """Build deduplicated caption timeline from frame_qual OCR data.

    Args:
        frame_quals: list of frame_qual dicts with timestamp, text_overlay/text_overlays

    Returns:
        List of CaptionEvent sorted by start time, deduplicated.
    """
    if not frame_quals:
        return []

    # Step 1: Extract all text frames
    raw_frames: list[dict] = []
    for fq in frame_quals:
        ts = fq.get("timestamp", 0.0)
        overlay = fq.get("text_overlay") or fq.get("text_overlays")
        if not overlay:
            continue

        # Handle both string and dict formats
        if isinstance(overlay, str):
            raw_frames.append({
                "timestamp": ts,
                "content": overlay,
                "purpose": "info",
                "font_style": "unknown",
            })
        elif isinstance(overlay, dict):
            raw_frames.append({
                "timestamp": ts,
                "content": overlay.get("content", ""),
                "purpose": overlay.get("purpose", "info"),
                "font_style": overlay.get("font_style", "unknown"),
            })
        elif isinstance(overlay, list):
            for item in overlay:
                if isinstance(item, str):
                    raw_frames.append({"timestamp": ts, "content": item, "purpose": "info", "font_style": "unknown"})
                elif isinstance(item, dict):
                    raw_frames.append({
                        "timestamp": ts,
                        "content": item.get("content", ""),
                        "purpose": item.get("purpose", "info"),
                        "font_style": item.get("font_style", "unknown"),
                    })

    if not raw_frames:
        return []

    # Sort by timestamp
    raw_frames.sort(key=lambda f: f["timestamp"])

    # Step 2: Deduplicate — merge consecutive similar texts into events
    events: list[CaptionEvent] = []
    current_text = ""
    current_start = 0.0
    current_end = 0.0
    current_full = ""
    current_purpose = "info"
    current_font = "unknown"

    for frame in raw_frames:
        content = frame["content"]
        normalized = _normalize_text(content)
        primary = _extract_primary_text(content)

        if not normalized:
            continue

        if current_text and _text_similarity(_normalize_text(current_full), normalized) >= SIMILARITY_THRESHOLD:
            # Same caption continues — extend end time
            current_end = frame["timestamp"]
        else:
            # New caption — save previous if exists
            if current_text:
                events.append(CaptionEvent(
                    start=current_start,
                    end=current_end + 0.5,  # extend by half-frame interval
                    text=current_text,
                    full_text=current_full,
                    purpose=current_purpose,
                    font_style=current_font,
                ))
            current_text = primary
            current_full = content
            current_start = frame["timestamp"]
            current_end = frame["timestamp"]
            current_purpose = frame["purpose"]
            current_font = frame["font_style"]

    # Save last event
    if current_text:
        events.append(CaptionEvent(
            start=current_start,
            end=current_end + 0.5,
            text=current_text,
            full_text=current_full,
            purpose=current_purpose,
            font_style=current_font,
        ))

    # Step 3: Detect narrative roles
    if events:
        total_duration = events[-1].end
        for evt in events:
            position_ratio = evt.start / total_duration if total_duration > 0 else 0.0
            evt.narrative_role = _detect_narrative_role(evt.text, evt.purpose, position_ratio)

    logger.info(f"[Caption Map] {len(raw_frames)} frames → {len(events)} caption events")
    return events


def caption_map_to_dict(events: list[CaptionEvent]) -> dict:
    """Serialize caption map to JSON-friendly dict."""
    return {
        "caption_count": len(events),
        "total_caption_time": round(sum(e.duration for e in events), 2),
        "narrative_flow": [e.narrative_role for e in events],
        "events": [e.to_dict() for e in events],
    }
