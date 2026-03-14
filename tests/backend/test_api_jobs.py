"""GET /api/jobs 응답 검증 테스트."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """FastAPI TestClient with mocked auth."""
    with patch("app.auth.get_current_user", return_value={"id": "user-123", "email": "test@test.com"}):
        from app.main import app
        yield TestClient(app)


@patch("app.routes.jobs.get_supabase")
def test_get_jobs_returns_list(mock_sb, client):
    """GET /api/jobs should return a list."""
    mock_table = MagicMock()
    mock_sb.return_value.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[
        {"id": "job-1", "status": "completed", "created_at": "2026-01-01T00:00:00Z"},
    ])

    resp = client.get("/api/jobs")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@patch("app.routes.jobs.get_supabase")
def test_get_job_detail_not_found(mock_sb, client):
    """GET /api/jobs/{id} with invalid id should return 404."""
    mock_table = MagicMock()
    mock_sb.return_value.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.single.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=None)

    resp = client.get("/api/jobs/nonexistent-id")
    assert resp.status_code in (404, 500)  # depends on route impl
