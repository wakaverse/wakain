"""Shared Gemini client factory.

Supports two modes:
  - Vertex AI (default on Cloud Run): uses ADC, no API key needed
  - AI Studio (fallback): uses GEMINI_API_KEY / GEMINI_API_KEY_PRO

Set USE_VERTEX_AI=true (or run on Cloud Run) to use Vertex AI.
Set USE_VERTEX_AI=false to force AI Studio mode.
"""

from __future__ import annotations

import os
from google import genai


def _is_vertex_ai() -> bool:
    """Determine whether to use Vertex AI or AI Studio."""
    env = os.environ.get("USE_VERTEX_AI", "").lower()
    if env in ("true", "1", "yes"):
        return True
    if env in ("false", "0", "no"):
        return False
    # Auto-detect: Cloud Run sets K_SERVICE
    if os.environ.get("K_SERVICE"):
        return True
    return False


def make_gemini_client() -> genai.Client:
    """Create a Gemini client (Vertex AI or AI Studio)."""
    if _is_vertex_ai():
        project = os.environ.get("GCP_PROJECT", "bridge-487513")
        location = os.environ.get("GCP_LOCATION", "asia-northeast3")
        return genai.Client(
            vertexai=True,
            project=project,
            location=location,
        )
    else:
        # AI Studio fallback (local development)
        api_key = (
            os.environ.get("GEMINI_API_KEY_PRO", "")
            or os.environ.get("GEMINI_API_KEY", "")
        )
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY or GEMINI_API_KEY_PRO not set. "
                "Set USE_VERTEX_AI=true for Vertex AI mode."
            )
        return genai.Client(api_key=api_key)
