"""P1: STT — Soniox 음성인식.

영상에서 오디오 추출 → Soniox API로 STT → STTOutput 반환.
V1 stt_extractor.py 로직을 async 인터페이스로 래핑.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

import requests

from core.schemas.enums import NarrationType
from core.schemas.pipeline import STTOutput, STTSegment

logger = logging.getLogger(__name__)

# ── 문장 경계 판정 (V1 그대로) ──────────────────────────────────────────────

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
    """Soniox 토큰 → 문장 단위 세그먼트."""
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
                "start_ms": current_sentence[0]["start"],
                "end_ms": current_sentence[-1]["end"],
            })
            current_sentence.clear()

    if current_sentence:
        sent = " ".join(x["word"] for x in current_sentence)
        if sent.strip():
            sentences.append({
                "text": sent,
                "start_ms": current_sentence[0]["start"],
                "end_ms": current_sentence[-1]["end"],
            })
    return sentences


# ── Soniox API 클라이언트 (V1 그대로) ───────────────────────────────────────


class SonioxClient:
    """Soniox async STT 클라이언트."""

    API_BASE = "https://api.soniox.com"

    def __init__(self, api_key: str | None = None, model: str = "stt-async-preview"):
        self.api_key = api_key or os.environ.get("SONIOX_API_KEY", "")
        if not self.api_key:
            raise ValueError("SONIOX_API_KEY not set")
        self.model = model
        self.headers = {"Authorization": f"Bearer {self.api_key}"}
        self.input_tokens = 0
        self.output_tokens = 0

    def transcribe(self, audio_path: str) -> dict:
        """업로드 → 폴링 → 트랜스크립트 반환 (동기)."""
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

            resp = requests.get(
                f"{self.API_BASE}/v1/transcriptions/{transcription_id}/transcript",
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()

            tokens = data.get("tokens", [])
            self.output_tokens = len(tokens)
            if tokens:
                audio_ms = tokens[-1].get("end_ms", 0)
                self.input_tokens = math.ceil(audio_ms / 1000.0 * 8.333)

            return data

        finally:
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


# ── 오디오 추출 ─────────────────────────────────────────────────────────────


def _extract_audio(video_path: str) -> str:
    """ffmpeg로 영상에서 WAV 오디오 추출 (16kHz mono)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    output_path = tmp.name
    tmp.close()

    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        os.unlink(output_path)
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")

    return output_path


# ── Narration type 판정 ─────────────────────────────────────────────────────

VOICE_THRESHOLD_SEC = 5.0


def _detect_narration_type(total_speech_sec: float) -> NarrationType:
    """V1 voice→VOICE, caption/silent→NONE."""
    if total_speech_sec >= VOICE_THRESHOLD_SEC:
        return NarrationType.VOICE
    return NarrationType.NONE


# ── run 인터페이스 ──────────────────────────────────────────────────────────


def _run_sync(video_path: str, output_dir: str, api_key: str | None = None) -> STTOutput:
    """동기 실행 본체."""
    audio_path = None
    try:
        audio_path = _extract_audio(video_path)
        logger.info(f"[P1] Audio extracted: {audio_path}")

        client = SonioxClient(api_key=api_key)
        raw_data = client.transcribe(audio_path)

        sentences = _group_tokens_into_sentences(raw_data)

        segments = []
        for sent in sentences:
            segments.append(STTSegment(
                start=round(sent["start_ms"] / 1000.0, 3),
                end=round(sent["end_ms"] / 1000.0, 3),
                text=sent["text"],
            ))

        total_speech_sec = sum(s.end - s.start for s in segments)
        full_text = " ".join(s.text for s in segments)
        narration_type = _detect_narration_type(total_speech_sec)

        result = STTOutput(
            narration_type=narration_type,
            segments=segments,
            full_text=full_text,
            total_speech_sec=round(total_speech_sec, 2),
        )

        # 중간 산출물 저장
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "p01_stt.json"
        out_path.write_text(
            json.dumps(result.model_dump(mode="json"), indent=2, ensure_ascii=False)
        )
        logger.info(f"[P1] Saved: {out_path}")

        return result

    except Exception as e:
        logger.error(f"[P1] STT failed: {e}")
        print(f"  ⚠️  STT 실패: {e}. none으로 대체합니다.")
        return STTOutput(
            narration_type=NarrationType.NONE,
            segments=[],
            full_text="",
            total_speech_sec=0.0,
        )

    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except OSError:
                pass


async def run(
    video_path: str,
    output_dir: str,
    api_key: str | None = None,
) -> STTOutput:
    """P1 STT 비동기 진입점.

    Soniox API가 동기이므로 asyncio.to_thread로 래핑.
    """
    return await asyncio.to_thread(_run_sync, video_path, output_dir, api_key)
