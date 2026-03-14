"""리포트 탭 렌더링 Playwright 테스트 (구조만 — R26에서 탭 구현 후 활성화)."""

import pytest

# Playwright 미설치 시 skip
pw = pytest.importorskip("playwright.sync_api")


@pytest.fixture(scope="session")
def browser():
    """Playwright browser fixture."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """New page per test."""
    page = browser.new_page()
    yield page
    page.close()


BASE_URL = "http://localhost:5173"  # Vite dev server


@pytest.mark.skip(reason="R26에서 탭 구현 후 활성화")
def test_report_page_loads(page):
    """리포트 페이지가 로드되는지 확인."""
    page.goto(f"{BASE_URL}/report/test-job-id")
    page.wait_for_selector("[data-testid='report-page']", timeout=10000)
    assert page.title() != ""


@pytest.mark.skip(reason="R26에서 탭 구현 후 활성화")
def test_tab_navigation(page):
    """탭 전환이 동작하는지 확인."""
    page.goto(f"{BASE_URL}/report/test-job-id")
    tabs = page.query_selector_all("[role='tab']")
    assert len(tabs) >= 4


@pytest.mark.skip(reason="R26에서 탭 구현 후 활성화")
def test_summary_tab_content(page):
    """요약 탭에 핵심 정보가 표시되는지 확인."""
    page.goto(f"{BASE_URL}/report/test-job-id")
    page.click("[data-testid='tab-summary']")
    assert page.query_selector("[data-testid='video-summary']") is not None
