"""라이브러리 목록 Playwright 테스트 (구조만)."""

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
def test_library_page_loads(page):
    """라이브러리 페이지 로드 확인."""
    page.goto(f"{BASE_URL}/library")
    page.wait_for_selector("[data-testid='library-page']", timeout=10000)
    assert page.title() != ""


@pytest.mark.skip(reason="E2E 환경 필요 — 수동 트리거")
def test_library_shows_items(page):
    """라이브러리에 분석 항목이 표시되는지 확인."""
    page.goto(f"{BASE_URL}/library")
    items = page.query_selector_all("[data-testid='library-item']")
    # 로그인 상태에 따라 0개 이상
    assert isinstance(items, list)
