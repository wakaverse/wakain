"""Style profiles: Format × Intent based analysis weights and prescriptions."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

PROFILES_DIR = Path(__file__).parent

# ── Format dimension weights ────────────────────────────────────────────────

_format_cache: dict[str, dict] = {}
_intent_cache: dict[str, dict] = {}


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def get_format_profile(format_key: str) -> dict | None:
    """Load format profile JSON. Returns None if not found."""
    if format_key not in _format_cache:
        p = PROFILES_DIR / "formats" / f"{format_key}.json"
        if p.exists():
            _format_cache[format_key] = _load_json(p)
        else:
            return None
    return _format_cache[format_key]


def get_intent_profile(intent_key: str) -> dict | None:
    """Load intent profile JSON. Returns None if not found."""
    if intent_key not in _intent_cache:
        p = PROFILES_DIR / "intents" / f"{intent_key}.json"
        if p.exists():
            _intent_cache[intent_key] = _load_json(p)
        else:
            return None
    return _intent_cache[intent_key]


def get_merged_profile(format_key: str, intent_key: str) -> dict:
    """Merge format + intent profiles into a single analysis profile.

    Format profile provides: dimension weights, structure, prescriptions
    Intent profile provides: effective appeals, KPIs, intent-specific overrides
    """
    fmt = get_format_profile(format_key) or {}
    intent = get_intent_profile(intent_key) or {}

    # Start with format as base
    merged = {
        "format": format_key,
        "intent": intent_key,
        "dimension_weights": fmt.get("dimension_weights", {}),
        "key_metrics": fmt.get("key_metrics", []),
        "less_important_metrics": fmt.get("less_important_metrics", []),
        "recommended_structure": fmt.get("recommended_structure", []),
        "effective_appeals": intent.get("effective_appeals", fmt.get("effective_appeals", [])),
        "weak_appeals": intent.get("weak_appeals", fmt.get("weak_appeals", [])),
        "prescriptions": fmt.get("prescriptions", {}),
        "thresholds": fmt.get("thresholds", {}),
    }

    # Intent overrides
    if "key_metrics_override" in intent:
        merged["key_metrics"] = intent["key_metrics_override"]
    if "dimension_weight_overrides" in intent:
        for k, v in intent["dimension_weight_overrides"].items():
            merged["dimension_weights"][k] = v
    if "prescription_overrides" in intent:
        for k, v in intent["prescription_overrides"].items():
            merged["prescriptions"][k] = v
    if "threshold_overrides" in intent:
        for k, v in intent["threshold_overrides"].items():
            merged["thresholds"][k] = v

    return merged


def list_formats() -> list[str]:
    """List available format profile keys."""
    d = PROFILES_DIR / "formats"
    if not d.exists():
        return []
    return sorted(p.stem for p in d.glob("*.json"))


def list_intents() -> list[str]:
    """List available intent profile keys."""
    d = PROFILES_DIR / "intents"
    if not d.exists():
        return []
    return sorted(p.stem for p in d.glob("*.json"))
