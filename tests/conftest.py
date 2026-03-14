"""공통 pytest fixtures — mock Supabase, API client, 샘플 데이터."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SAMPLES_DIR = Path(__file__).parent / "samples"


@pytest.fixture
def sample_recipe_json() -> dict:
    """테스트용 recipe_json 샘플 로드."""
    sample_path = SAMPLES_DIR / "sample_recipe.json"
    if sample_path.exists():
        return json.loads(sample_path.read_text(encoding="utf-8"))
    # 인라인 최소 샘플
    return {
        "identity": {"category": "beauty", "category_ko": "뷰티", "platform": "instagram"},
        "product": {
            "name": "테스트 세럼",
            "brand": "테스트브랜드",
            "category": "beauty",
            "claims": [
                {"claim": "수분 충전", "type": "benefit", "layer": "emotional", "verifiable": False, "source": "verbal"},
            ],
        },
        "script": {
            "blocks": [
                {"block": "hook", "text": "이거 진짜 대박", "alpha": {"emotion": "excitement", "structure": "question", "connection": "direct"}, "time_range": [0, 3]},
                {"block": "benefit", "text": "수분 충전", "alpha": {}, "product_claim_ref": "수분 충전", "time_range": [3, 8]},
            ],
            "flow_order": ["hook", "benefit"],
        },
        "visual": {
            "scenes": [
                {"scene_id": 1, "time_range": [0, 5], "style": "talking_head", "role": "hook", "visual_forms": ["person"], "block_refs": [0], "description": "인물 등장"},
            ],
            "rhythm": {"total_cuts": 3, "avg_cut_duration": 2.5, "cut_rhythm": "moderate", "attention_curve": {"points": [{"t": 1.0, "score": 8.0}, {"t": 2.0, "score": 7.5}, {"t": 3.0, "score": 6.0}]}},
            "style_distribution": {"talking_head": 0.6, "product_shot": 0.4},
        },
        "style": {"primary": "talking_head", "secondary": "product_shot"},
        "engagement": {
            "retention_analysis": {"hook_strength": "strong", "hook_reason": "질문형 오프닝", "hook_scan": {"hook_type": "question"}},
            "dropoff_analysis": {"risk_zones": []},
        },
        "summary": {"strategy": "benefit-led"},
        "meta": {"duration": 15.0, "platform": "instagram", "human_presence": {"type": "presenter", "face_exposure": "full"}, "audio": {"voice": {"type": "narration"}, "music": {"genre": "pop"}}},
    }


@pytest.fixture
def mock_supabase():
    """Supabase 클라이언트 mock."""
    mock_client = MagicMock()
    # 기본 체이닝 응답 설정
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.ilike.return_value = mock_table
    mock_table.filter.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": "test-uuid-123"}])
    return mock_client


@pytest.fixture
def mock_supabase_patched(mock_supabase):
    """storage._supabase를 패치한 fixture."""
    with patch("app.services.storage._supabase", return_value=mock_supabase):
        yield mock_supabase
