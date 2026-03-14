"""업로드 → 분석 시작 Playwright 테스트 (구조만)."""

import pytest

pw = pytest.importorskip("playwright.sync_api")


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    page = browser.new_page()
    yield page
    page.close()


BASE_URL = "http://localhost:5173"


@pytest.mark.skip(reason="E2E 환경 필요 — 수동 트리거")
def test_upload_page_loads(page):
    """업로드 페이지가 로드되는지 확인."""
    page.goto(BASE_URL)
    assert page.query_selector("[data-testid='upload-area']") is not None


@pytest.mark.skip(reason="E2E 환경 필요 — 수동 트리거")
def test_url_analyze_input(page):
    """URL 입력 후 분석 시작 버튼이 활성화되는지 확인."""
    page.goto(BASE_URL)
    url_input = page.query_selector("[data-testid='url-input']")
    if url_input:
        url_input.fill("https://www.instagram.com/reel/test123/")
        submit = page.query_selector("[data-testid='analyze-button']")
        assert submit is not None
