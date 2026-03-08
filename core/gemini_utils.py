"""Gemini API 유틸리티 — 파일 업로드 및 클라이언트 생성.

여러 Phase에서 동일 영상을 재사용할 수 있도록 업로드 캐싱을 제공한다.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# 업로드된 파일 캐시: {절대경로: types.File}
_upload_cache: dict[str, types.File] = {}


def make_client(api_key: str | None = None) -> genai.Client:
    """Gemini Client 생성.

    api_key가 None이면 환경변수에서 로드 (GEMINI_API_KEY_PRO 우선).
    """
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY_PRO") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    return genai.Client(api_key=api_key)


def upload_video(
    video_path: str | Path,
    client: genai.Client | None = None,
    api_key: str | None = None,
    poll_interval: float = 5.0,
) -> types.File:
    """영상을 Gemini File API에 업로드하고 처리 완료까지 대기.

    이미 업로드된 파일은 캐시에서 반환한다.

    Args:
        video_path: 영상 파일 경로
        client: Gemini 클라이언트 (None이면 생성)
        api_key: API 키 (client가 None일 때 사용)
        poll_interval: 처리 상태 폴링 간격 (초)

    Returns:
        업로드된 File 객체 (uri, mime_type 포함)
    """
    abs_path = str(Path(video_path).resolve())

    # 캐시 확인
    if abs_path in _upload_cache:
        cached = _upload_cache[abs_path]
        logger.info("캐시된 파일 사용: %s → %s", Path(abs_path).name, cached.name)
        return cached

    if client is None:
        client = make_client(api_key)

    logger.info("영상 업로드 중: %s", Path(abs_path).name)
    uploaded = client.files.upload(file=abs_path)

    # 처리 완료 대기
    while uploaded.state.name == "PROCESSING":
        logger.info("  처리 중... (state=%s)", uploaded.state.name)
        time.sleep(poll_interval)
        uploaded = client.files.get(name=uploaded.name)

    if uploaded.state.name == "FAILED":
        raise RuntimeError(f"파일 업로드 실패: {uploaded.state}")

    logger.info("업로드 완료: %s (state=%s)", uploaded.name, uploaded.state.name)
    _upload_cache[abs_path] = uploaded
    return uploaded


def clear_cache() -> None:
    """업로드 캐시 초기화."""
    _upload_cache.clear()
