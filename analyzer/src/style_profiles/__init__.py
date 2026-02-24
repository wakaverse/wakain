"""Style profiles: Category-based analysis weights and hints."""

from __future__ import annotations

import json
from pathlib import Path

_PROFILES_DIR = Path(__file__).parent


def get_category_profile(category: str) -> dict:
    """Load category profile. Falls back to 'general' if not found."""
    cat_path = _PROFILES_DIR / "categories" / f"{category}.json"
    if not cat_path.exists():
        cat_path = _PROFILES_DIR / "categories" / "general.json"
    return json.loads(cat_path.read_text())
