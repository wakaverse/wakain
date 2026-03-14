"""content_dna 생성 로직 검증 테스트."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.content_dna import (
    _calc_first_3s_dynamics,
    _calc_dynamics_stats,
    _calc_appeal_distribution,
    _has_text_overlay,
    _build_content_dna,
)


def test_calc_first_3s_dynamics(sample_recipe_json):
    """첫 3초 dynamics 평균 계산."""
    result = _calc_first_3s_dynamics(sample_recipe_json)
    assert result is not None
    assert isinstance(result, float)
    assert 0 <= result <= 10


def test_calc_first_3s_dynamics_empty():
    """빈 recipe에서는 None 반환."""
    result = _calc_first_3s_dynamics({})
    assert result is None


def test_calc_dynamics_stats(sample_recipe_json):
    """dynamics avg/std 계산."""
    avg, std = _calc_dynamics_stats(sample_recipe_json)
    assert avg is not None
    assert std is not None
    assert isinstance(avg, float)
    assert isinstance(std, float)


def test_calc_appeal_distribution(sample_recipe_json):
    """claim type별 비율 계산."""
    result = _calc_appeal_distribution(sample_recipe_json)
    assert result is not None
    assert isinstance(result, dict)
    total = sum(result.values())
    assert abs(total - 1.0) < 0.01  # 합이 1.0


def test_calc_appeal_distribution_no_claims():
    """claims 없을 때 None."""
    result = _calc_appeal_distribution({"product": {"claims": []}})
    assert result is None


def test_has_text_overlay(sample_recipe_json):
    """텍스트 오버레이 감지."""
    result = _has_text_overlay(sample_recipe_json)
    assert isinstance(result, bool)


@patch("app.services.content_dna._supabase")
def test_build_content_dna(mock_supabase, sample_recipe_json):
    """content_dna 생성 시 Supabase insert 호출."""
    mock_client = MagicMock()
    mock_supabase.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"user_id": "u1", "organization_id": "o1"}])

    _build_content_dna("result-1", "job-1", sample_recipe_json, "brand-1", "ch-1", None)

    mock_client.table.assert_any_call("content_dna")
