"""Phase 0: STT extraction via Soniox API + narration type detection.

Extracts audio from video → sends to Soniox STT → determines narration_type:
  - "voice"   : spoken narration detected (≥5s of speech)
  - "caption"  : no meaningful speech → relies on text overlays
  - "silent"   : no speech, no text overlays expected

Usage (standalone):
    python -m src.stt_extractor samples/sample5.mp4 --output output/sample5/

Pipeline integration:
    from src.stt_extractor import run_stt_extraction
    stt_result = run_stt_extraction("video.mp4")
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ── Soniox sentence boundary detection (from ATOMOS) ────────────────────────

ABBREVIATIONS = {
    "mr.", "mrs.", "ms.", "dr.", "jr.", "sr.", "st.", "prof.",
    "gov.", "hon.", "u.s.", "u.k.", "a.m.", "p.m.",
}

_decimal_re = re.compile(r"^\d+\.\d+$")
_acronym_re = re.compile(r"^(?:[A-Za-z]\.){2,}$")
_url_re = re.compile(r"^[\w\.-]+\.[A-Za-z]{2,}$")
_ellipsis_re = re.compile(r"\.\.\.$")
_email_re = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


def _is_sentence_boundary(token: str) -> bool:
    t = token.lower()
    if t.endswith(("。", "?", "!", "？", "！")):
        return True
    if t.endswith("."):
        if t in ABBREVIATIONS:
            return False
        if _decimal_re.match(t) or _acronym_re.match(token):
            return False
        if _url_re.match(token) or _email_re.match(token):
            return False
        if _ellipsis_re.search(token):
            return False
        return True
    return False


def _group_tokens_into_sentences(data: dict) -> list[dict]:
    """Convert Soniox raw token list into sentence-level segments."""
    tokens = data.get("tokens", [])
    words: list[dict] = []
    current = None
    for t in tokens:
        txt = t["text"]
        if txt.startswith(" ") or current is None:
            if current is not None:
                words.append(current)
            current = {
                "word": txt.lstrip(),
                "start": int(t["start_ms"]),
                "end": int(t["end_ms"]),
            }
        else:
            current["word"] += txt
            current["end"] = int(t["end_ms"])
    if current:
        words.append(current)

    sentences: list[dict] = []
    current_sentence: list[dict] = []
    special_re = re.compile(r"^[\-–—\.\,\!\?\:\;\'\"\(\)\[\]\{\}\|\/\\]+$")

    for w in words:
        if special_re.match(w["word"]):
            continue
        current_sentence.append(w)
        if _is_sentence_boundary(w["word"]):
            sent = " ".join(x["word"] for x in current_sentence)
            if not sent.strip():
                continue
            sentences.append({
                "text": sent,
                "start": current_sentence[0]["start"],
                "end": current_sentence[-1]["end"],
                "words": list(current_sentence),
            })
            current_sentence.clear()

    if current_sentence:
        sent = " ".join(x["word"] for x in current_sentence)
        if sent.strip():
            sentences.append({
                "text": sent,
                "start": current_sentence[0]["start"],
                "end": current_sentence[-1]["end"],
                "words": list(current_sentence),
            })
    return sentences


# ── Soniox API client ───────────────────────────────────────────────────────


class SonioxClient:
    """Soniox async STT client using requests."""

    API_BASE = "https://api.soniox.com"

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "stt-async-preview",
    ):
        self.api_key = api_key or os.environ.get("SONIOX_API_KEY", "")
        if not self.api_key:
            raise ValueError("SONIOX_API_KEY not set")
        self.model = model
        self.headers = {"Authorization": f"Bearer {self.api_key}"}
        self.input_tokens = 0
        self.output_tokens = 0

    def transcribe(self, audio_path: str) -> dict:
        """Upload audio, poll until done, return raw Soniox response."""
        # Upload file
        with open(audio_path, "rb") as f:
            resp = requests.post(
                f"{self.API_BASE}/v1/files",
                headers=self.headers,
                files={"file": f},
            )
        resp.raise_for_status()
        file_id = resp.json()["id"]
        logger.info(f"[Soniox] File uploaded: {file_id}")

        transcription_id = None
        try:
            # Create transcription
            payload = {
                "file_id": file_id,
                "model": self.model,
                "language_hints": ["ko", "en"],
                "include_word_timings": True,
            }
            resp = requests.post(
                f"{self.API_BASE}/v1/transcriptions",
                headers={**self.headers, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            transcription_id = resp.json()["id"]
            logger.info(f"[Soniox] Transcription created: {transcription_id}")

            # Poll until complete
            while True:
                resp = requests.get(
                    f"{self.API_BASE}/v1/transcriptions/{transcription_id}",
                    headers=self.headers,
                )
                resp.raise_for_status()
                status_data = resp.json()
                if status_data["status"] == "completed":
                    break
                if status_data["status"] == "error":
                    raise RuntimeError(
                        f"Soniox transcription failed: "
                        f"{status_data.get('error_message', 'unknown')}"
                    )
                time.sleep(2)

            # Fetch transcript
            resp = requests.get(
                f"{self.API_BASE}/v1/transcriptions/{transcription_id}/transcript",
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Count tokens
            tokens = data.get("tokens", [])
            self.output_tokens = len(tokens)
            if tokens:
                audio_ms = tokens[-1].get("end_ms", 0)
                self.input_tokens = math.ceil(audio_ms / 1000.0 * 8.333)

            return data

        finally:
            # Cleanup resources
            self._cleanup(transcription_id, file_id)

    def _cleanup(self, transcription_id: str | None, file_id: str) -> None:
        for resource, rid in [("transcriptions", transcription_id), ("files", file_id)]:
            if rid:
                try:
                    requests.delete(
                        f"{self.API_BASE}/v1/{resource}/{rid}",
                        headers=self.headers,
                    )
                except Exception as e:
                    logger.warning(f"[Soniox] Failed to delete {resource}/{rid}: {e}")


# ── Audio extraction ─────────────────────────────────────────────────────────


def extract_audio(video_path: str, output_path: str | None = None) -> str:
    """Extract audio from video as WAV using ffmpeg.

    Returns path to the extracted audio file.
    """
    if output_path is None:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        output_path = tmp.name
        tmp.close()

    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn",                    # no video
        "-acodec", "pcm_s16le",   # 16-bit PCM
        "-ar", "16000",           # 16kHz (Soniox optimal)
        "-ac", "1",               # mono
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")

    return output_path


# ── Narration type detection ─────────────────────────────────────────────────

VOICE_THRESHOLD_SEC = 5.0  # ≥5s of speech → voice type


def detect_narration_type(segments: list[dict]) -> str:
    """Determine narration_type from STT segments.

    Returns:
        "voice"   — meaningful speech detected (≥5s total)
        "caption" — little/no speech, relies on text overlays
        "silent"  — no speech at all
    """
    if not segments:
        return "silent"

    total_speech_sec = sum(s["end"] - s["start"] for s in segments)

    if total_speech_sec >= VOICE_THRESHOLD_SEC:
        return "voice"
    elif total_speech_sec > 0:
        return "caption"
    else:
        return "silent"


# ── Main entry point ─────────────────────────────────────────────────────────


@dataclass
class STTResult:
    """Phase 0 output: STT segments + narration type."""
    narration_type: str  # "voice" | "caption" | "silent"
    segments: list[dict] = field(default_factory=list)
    total_speech_sec: float = 0.0
    full_transcript: str = ""
    input_tokens: int = 0
    output_tokens: int = 0

    def to_dict(self) -> dict:
        return {
            "narration_type": self.narration_type,
            "total_speech_sec": round(self.total_speech_sec, 2),
            "full_transcript": self.full_transcript,
            "segment_count": len(self.segments),
            "segments": self.segments,
            "tokens": {
                "input": self.input_tokens,
                "output": self.output_tokens,
            },
        }


def run_stt_extraction(video_path: str) -> STTResult:
    """Run Phase 0: extract audio → Soniox STT → narration type.

    Returns STTResult with segments and narration_type.
    On failure, returns a "silent" result with error info instead of crashing.
    """
    audio_path = None
    try:
        # Step 1: Extract audio
        audio_path = extract_audio(video_path)
        logger.info(f"[Phase 0] Audio extracted: {audio_path}")

        # Step 2: Run Soniox STT
        client = SonioxClient()
        raw_data = client.transcribe(audio_path)

        # Step 3: Parse into sentences/segments
        sentences = _group_tokens_into_sentences(raw_data)
        segments = []
        for sent in sentences:
            words = [
                {
                    "word": w["word"],
                    "start": round(w["start"] / 1000.0, 3),
                    "end": round(w["end"] / 1000.0, 3),
                }
                for w in sent.get("words", [])
            ]
            segments.append({
                "text": sent["text"],
                "start": round(sent["start"] / 1000.0, 3),
                "end": round(sent["end"] / 1000.0, 3),
                "words": words,
            })

        # Step 4: Detect narration type
        narration_type = detect_narration_type(segments)
        total_speech = sum(s["end"] - s["start"] for s in segments)
        full_transcript = " ".join(s["text"] for s in segments)

        return STTResult(
            narration_type=narration_type,
            segments=segments,
            total_speech_sec=total_speech,
            full_transcript=full_transcript,
            input_tokens=client.input_tokens,
            output_tokens=client.output_tokens,
        )

    except Exception as e:
        logger.error(f"[Phase 0] STT extraction failed: {e}")
        print(f"  ⚠️  STT 실패: {e}. silent로 대체합니다.")
        return STTResult(
            narration_type="silent",
            segments=[],
            total_speech_sec=0.0,
            full_transcript="",
        )

    finally:
        # Cleanup temp audio
        if audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except OSError:
                pass


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Phase 0: STT extraction")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--output", "-o", help="Output directory")
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    result = run_stt_extraction(args.video)

    print(f"\n[Phase 0] STT Result:")
    print(f"  narration_type: {result.narration_type}")
    print(f"  total_speech:   {result.total_speech_sec:.1f}s")
    print(f"  segments:       {len(result.segments)}")
    print(f"  tokens:         in={result.input_tokens}, out={result.output_tokens}")

    if args.output:
        out = Path(args.output)
        out.mkdir(parents=True, exist_ok=True)
        video_name = Path(args.video).stem
        stt_path = out / f"{video_name}_stt.json"
        stt_path.write_text(
            json.dumps(result.to_dict(), indent=2, ensure_ascii=False)
        )
        print(f"  → saved to {stt_path}")
    else:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
