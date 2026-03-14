# R29 Plan — 레이더 3탭 확장

> 2026-03-14
> 참조: docs/WAKALAB_RADAR_SPEC.md

---

## T1: DB 마이그레이션 — radar_reels 확장
- source (text, default 'channel'), category, channel_name, channel_followers, search_query 컬럼 추가
- channel_id NOT NULL 해제
- 인덱스: source, category, search_query
- RLS 수정: trending/search는 전체 공개, channel은 본인만

## T2: 프론트 리팩토링 — 컴포넌트 분리
- RadarPage.tsx 1,155줄 → 탭 컨테이너로 경량화
- 분리: VideoCard.tsx, ChannelManager.tsx, FeedFilters.tsx, CompareBar.tsx
- WatchTab.tsx에 기존 감시 로직 이관

## T3: 3탭 구조 + WatchTab
- RadarTabs.tsx (감시/트렌드/검색)
- WatchTab: 기존 기능 + 🆕 뱃지 + 채널별 그룹뷰 토글 + 분석상태 강화

## T4: 크롤러 검색 메서드 추가
- instagram.py: search_reels(query, count)
- youtube.py: search_shorts(query, count, order)
- tiktok.py: search_videos(query, count)

## T5: 검색 탭 (SearchTab + API)
- GET /api/radar/search — 3플랫폼 검색 → radar_reels(source='search') 저장
- SearchTab.tsx: 검색바 + 필터 + 결과 + 최근 검색어
- 검색 캐싱: 24시간 이내 동일 쿼리는 DB에서

## T6: 트렌드 탭 (TrendTab + API)
- GET /api/radar/trending — 카테고리별 키워드 매핑 → 크롤러 검색
- POST /api/radar/trending/refresh — 수동 새로고침
- TrendTab.tsx: 카테고리 드롭다운 + 플랫폼 + 기간 + 인기 영상
- 카테고리 키워드 매핑 (식품/뷰티/테크/라이프스타일/교육)

## T7: CompareBar + 제작가이드 연결
- 하단 고정 비교 바 (3탭 공통)
- 체크박스 → 2~3개 선택 → [비교하기] → /app/compare?ids=...
- 분석 완료 카드에 [이 구조로 제작가이드] 버튼

## T8: Quota + 이벤트 로깅
- 검색: Free 월 10회, Pro 월 50회 (quota 서비스 연동)
- 이벤트 10종 로깅

---

## 실행 순서 (병렬 활용)

```
Phase 1: T1(DB) + T4(크롤러) — 동시
Phase 2: T2(컴포넌트 분리) + T3(3탭+WatchTab)
Phase 3: T5(검색) + T6(트렌드)
Phase 4: T7(CompareBar) + T8(Quota+이벤트)
```

## 예상 소요: 포지 기준 ~40분

## 완료 후
- git commit + 변경 파일 보고
