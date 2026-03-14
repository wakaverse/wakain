"""brand/channel 매칭 로직 검증 테스트."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.brand_channel import (
    _match_or_create_brand,
    _extract_channel_from_url,
    _upsert_channel,
)
from app.services.category import _resolve_category_id


# ── _extract_channel_from_url ──


def test_extract_instagram_reel():
    """Instagram reel URL에서 username 추출."""
    plat, url, name = _extract_channel_from_url("https://www.instagram.com/testuser/reel/ABC123/")
    assert plat == "instagram"
    assert url == "instagram.com/testuser"
    assert name == "testuser"


def test_extract_instagram_no_username():
    """Instagram /reel/xxx (username 없음) → platform만."""
    plat, url, name = _extract_channel_from_url("https://www.instagram.com/reel/ABC123/")
    assert plat == "instagram"
    assert url is None


def test_extract_tiktok():
    """TikTok URL에서 username 추출."""
    plat, url, name = _extract_channel_from_url("https://www.tiktok.com/@creator/video/12345")
    assert plat == "tiktok"
    assert url == "tiktok.com/@creator"
    assert name == "@creator"


def test_extract_youtube():
    """YouTube URL → platform만 (channel 추출 불가)."""
    plat, url, name = _extract_channel_from_url("https://www.youtube.com/watch?v=abc123")
    assert plat == "youtube"
    assert url is None


def test_extract_unknown_url():
    """알 수 없는 URL → 모두 None."""
    plat, url, name = _extract_channel_from_url("https://example.com/video")
    assert plat is None
    assert url is None


def test_extract_none():
    """None 입력 → 모두 None."""
    plat, url, name = _extract_channel_from_url(None)
    assert plat is None


# ── _resolve_category_id ──


def test_resolve_category_exact():
    """정확 매칭: 뷰티 → beauty."""
    result = _resolve_category_id({"identity": {"category_ko": "뷰티"}})
    assert result == "beauty"


def test_resolve_category_partial():
    """부분 매칭: 건강/의료 → health."""
    result = _resolve_category_id({"identity": {"category_ko": "건강/의료"}})
    assert result == "health"


def test_resolve_category_unknown():
    """미매칭 → other."""
    result = _resolve_category_id({"identity": {"category_ko": "알수없음"}})
    assert result == "other"


def test_resolve_category_empty():
    """빈 값 → None."""
    result = _resolve_category_id({"identity": {}})
    assert result is None


# ── _match_or_create_brand (mocked) ──


@patch("app.services.brand_channel._supabase")
def test_match_brand_existing(mock_supabase):
    """기존 brand 매칭."""
    mock_client = MagicMock()
    mock_supabase.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.ilike.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": "brand-existing"}])

    result = _match_or_create_brand("TestBrand", "beauty")
    assert result == "brand-existing"


@patch("app.services.brand_channel._supabase")
def test_match_brand_empty_name(mock_supabase):
    """빈 brand name → None."""
    result = _match_or_create_brand("", None)
    assert result is None


# ── _upsert_channel (mocked) ──


@patch("app.services.brand_channel._supabase")
def test_upsert_channel_new(mock_supabase):
    """새 channel INSERT."""
    mock_client = MagicMock()
    mock_supabase.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    # 기존 없음
    mock_table.execute.return_value = MagicMock(data=[])
    # insert 체인
    mock_insert = MagicMock()
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = MagicMock(data=[{"id": "ch-new"}])

    result = _upsert_channel("instagram", "instagram.com/test", "test", "brand-1")
    assert result == "ch-new"


def test_upsert_channel_no_url():
    """channel_url 없으면 None."""
    result = _upsert_channel("instagram", None, None)
    assert result is None
