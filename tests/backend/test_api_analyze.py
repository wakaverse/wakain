"""POST /api/analyze 응답 검증 테스트."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """FastAPI TestClient with mocked auth."""
    with patch("app.auth.get_current_user", return_value={"id": "user-123", "email": "test@test.com"}):
        from app.main import app
        yield TestClient(app)


def test_health_check(client):
    """GET /api/health should return 200."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@patch("app.routes.analyze.get_supabase")
@patch("app.routes.analyze.run_analysis")
def test_analyze_url_missing_url(mock_run, mock_sb, client):
    """POST /api/analyze-url without url should return 422."""
    resp = client.post("/api/analyze-url", json={})
    assert resp.status_code == 422


@patch("app.routes.analyze.get_supabase")
def test_analyze_upload_no_file(mock_sb, client):
    """POST /api/analyze without file should return 422."""
    resp = client.post("/api/analyze")
    assert resp.status_code == 422
