# WakaLab 레이더 확장 스펙

> 2026-03-14
> 기존 레이더 구현(WAKALAB_RADAR_REVIEW.md)을 기반으로 3탭 구조 확장.
> 기존 코드 최대한 재활용. 새로 만드는 것보다 확장하는 것.

---

## 1. 변경 개요

### 현재
- 단일 피드 뷰: 등록한 채널의 영상만 표시
- 수동 수집 버튼
- 감시 기능만 존재

### 변경
- 3탭 구조: 감시 / 트렌드 / 검색
- 감시: 기존 코드 기반 개선
- 트렌드: 카테고리별 인기 영상 신규
- 검색: 키워드 영상 검색 신규

---

## 2. 탭 구조

```
레이더
┌──────────┬──────────┬──────────┐
│  감시     │  트렌드   │  검색    │
└──────────┴──────────┴──────────┘
```

---

## 3. 탭 1: 감시 — 기존 확장

### 현재 있는 것 (유지)
- 채널 등록/삭제 (3 플랫폼)
- 영상 수집 (수동 트리거)
- 피드 필터 (기간, Spike, 조회수, Engagement, 키워드)
- 정렬 (Spike/Engagement/조회수/최신)
- 영상 카드 (썸네일, 지표, 채널 정보)
- 분석하기 버튼 → 파이프라인 연결
- 페이지네이션

### 추가/개선 사항

**3-1. 새 영상 표시**

마지막 방문 이후 새로 수집된 영상에 🆕 뱃지.

```
구현:
- user별 last_radar_visit 타임스탬프 저장 (user_profiles 또는 별도)
- radar_reels.posted_at > last_radar_visit → 🆕 뱃지 표시
- 감시 탭 진입 시 last_radar_visit 업데이트
```

**3-2. 채널별 그룹 뷰 옵션**

현재: 모든 채널의 영상이 섞여서 표시.
추가: 채널별로 그룹핑해서 보는 뷰 토글.

```
[전체 피드] / [채널별 보기]

채널별 보기:
┌─────────────────────────────────┐
│ 채널 A (@barofarms) — 인스타     │
│ ┌────┐ ┌────┐ ┌────┐           │
│ │🆕  │ │    │ │    │           │
│ │영상1│ │영상2│ │영상3│           │
│ └────┘ └────┘ └────┘           │
├─────────────────────────────────┤
│ 채널 B (@competitor) — 틱톡     │
│ ┌────┐ ┌────┐                  │
│ │🆕  │ │    │                  │
│ │영상1│ │영상2│                  │
│ └────┘ └────┘                  │
└─────────────────────────────────┘
```

**3-3. 분석 상태 표시 강화**

현재: is_analyzed 여부만.
변경: 카드에 분석 상태 명확히 표시.

```
미분석:    썸네일 + 지표(Spike/조회수) + [분석하기] 버튼
분석중:    썸네일 + 지표 + 🔄 분석 중...
분석완료:  썸네일 + 지표 + 분석 요약 (훅 강도, 변화량) + [리포트 보기]
```

분석 완료된 영상은 훅 강도 + 시각 변화량 뱃지가 카드에 바로 보이게.
→ "이 영상 구조가 어떤지" 분석 안 열어도 감 잡히게.

**3-4. 비교로 바로 연결**

영상 카드에 체크박스 추가. 2~3개 체크 후 [비교하기] 버튼.
→ 비교 화면으로 이동, 선택된 영상이 이미 추가된 상태.

```
[✓] 영상 A (분석 완료)
[✓] 영상 B (분석 완료)
[ ] 영상 C (미분석)

[선택한 2개 비교하기 →]   ← 분석 완료된 것만 비교 가능
```

**3-5. 제작가이드 연결**

분석 완료된 영상 카드에 [이 구조로 제작가이드 →] 버튼 추가.
→ 제작가이드 페이지로 이동, 해당 영상이 레퍼런스로 자동 전달.

---

## 4. 탭 2: 트렌드 — 신규

### 목적
"내 카테고리에서 최근 뭐가 터지고 있는지" 자동 추천.
사용자가 채널을 등록하지 않아도 영상이 보임.

### 화면

```
트렌드

카테고리: [식품 ▼]  플랫폼: [전체 ▼]  기간: [7일 ▼]

인기 영상 (조회수 기준)
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │ │    │ │    │
│ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │
│    │ │    │ │    │ │    │ │    │
│520K│ │480K│ │350K│ │290K│ │250K│
│📱IG│ │🎵TT│ │📱IG│ │▶YT │ │🎵TT│
└────┘ └────┘ └────┘ └────┘ └────┘

[분석하기]  [분석하기]  [분석하기]  ...
```

### 카테고리
온보딩 설문에서 선택한 카테고리가 기본값.
드롭다운으로 변경 가능: 식품 / 뷰티 / 테크 / 라이프스타일 / 교육 / 전체

### 데이터 수집 방식

**백엔드 신규 엔드포인트:**

```
GET /api/radar/trending?category=food&platform=all&period=7d&page=1&limit=20
```

**수집 로직:**
```
카테고리별 키워드 매핑:
- 식품: ["먹방", "레시피", "맛집", "쿠킹", "food", "recipe", "mukbang"]
- 뷰티: ["뷰티", "메이크업", "스킨케어", "beauty", "makeup"]
- 테크: ["테크", "리뷰", "언박싱", "tech", "review", "unboxing"]
- 라이프스타일: ["일상", "브이로그", "vlog", "daily", "routine"]
- 교육: ["공부", "강의", "팁", "study", "tips", "howto"]

각 플랫폼 크롤러에 검색/인기 API 추가:
- Instagram: 해시태그 인기 게시물 (비공식 API)
- YouTube: YouTube Data API v3 search (videoCategoryId + order=viewCount)
- TikTok: 해시태그 인기 영상 (비공식 API)

→ 카테고리별로 최근 N일간 인기 영상 수집
→ radar_trending 테이블 또는 캐시에 저장
→ 주기적 갱신 (하루 1회 또는 수동)
```

### radar_trending 테이블 (신규, 또는 radar_reels 확장)

**방식 A — 별도 테이블:**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| platform | text | instagram / youtube / tiktok |
| category | text | food / beauty / tech / lifestyle / education |
| media_id | text UNIQUE | 플랫폼별 고유 ID |
| shortcode | text | |
| thumbnail_url | text | |
| video_url | text | |
| caption | text | |
| channel_name | text | 채널명 |
| channel_followers | int | |
| view_count | int | |
| like_count | int | |
| comment_count | int | |
| engagement_rate | float | |
| posted_at | timestamp | |
| collected_at | timestamp | 수집 시각 |
| job_id | UUID FK | 분석 연결 시 |
| is_analyzed | bool | |

**방식 B — radar_reels 확장:**
- radar_reels에 source 컬럼 추가: 'channel' (감시) / 'trending' (트렌드) / 'search' (검색)
- channel_id를 nullable로 변경 (트렌드/검색은 채널 등록 없이)

**추천: 방식 B.** 코드 재활용 극대화. 기존 피드 필터/정렬/분석 연결 로직 그대로 사용 가능. 영상 카드 컴포넌트도 공유.

### radar_reels 확장 (방식 B)

```sql
ALTER TABLE radar_reels ADD COLUMN source text DEFAULT 'channel';
-- 'channel': 감시에서 수집
-- 'trending': 트렌드에서 수집
-- 'search': 검색에서 수집

ALTER TABLE radar_reels ALTER COLUMN channel_id DROP NOT NULL;
-- 트렌드/검색은 channel_id 없이 저장

ALTER TABLE radar_reels ADD COLUMN category text;
-- 트렌드 카테고리 태깅

ALTER TABLE radar_reels ADD COLUMN channel_name text;
-- 채널 미등록 영상의 채널명

ALTER TABLE radar_reels ADD COLUMN channel_followers int;
-- 채널 미등록 영상의 팔로워 수

ALTER TABLE radar_reels ADD COLUMN search_query text;
-- 검색 탭에서 어떤 쿼리로 찾았는지
```

### 트렌드 캐싱

카테고리별 인기 영상을 매번 크롤링하면 느림 + API 비용.

```
수집 주기: 하루 1회 (새벽 자동) 또는 수동 새로고침
캐시: radar_reels에 저장 (source='trending')
유효기간: collected_at 기준 24시간
사용자 접근 시: 캐시 있으면 DB에서 조회, 없으면 실시간 수집
```

MVP에서는 **수동 새로고침 + DB 캐시**로 충분.
자동 스케줄링은 후순위.

---

## 5. 탭 3: 검색 — 신규

### 목적
"디저트 레시피 숏폼", "언박싱 리뷰" 같은 키워드로 소재 탐색.
레퍼런스를 능동적으로 찾는 기능.

### 화면

```
검색

[키워드를 입력하세요 ________________] [검색]
플랫폼: [전체 ▼]  정렬: [조회수 ▼]  기간: [30일 ▼]

검색 결과: "딸기 디저트" — 48건
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │ │    │ │    │
│    │ │    │ │    │ │    │ │    │
│    │ │    │ │    │ │    │ │    │
│320K│ │280K│ │150K│ │120K│ │95K │
│📱IG│ │🎵TT│ │▶YT │ │📱IG│ │🎵TT│
└────┘ └────┘ └────┘ └────┘ └────┘

[분석하기]  [분석하기]  ...
```

### 백엔드

**신규 엔드포인트:**

```
GET /api/radar/search?query=딸기+디저트&platform=all&sort=views&period=30d&page=1&limit=20
```

**검색 로직:**

```
플랫폼별 검색 API:
- Instagram: 해시태그 검색 + 인기 게시물 (비공식 API)
- YouTube: YouTube Data API v3 search (q=query, type=video, videoDuration=short)
- TikTok: 키워드 검색 (비공식 API)

→ 3개 플랫폼 결과 합산
→ 정렬/필터 적용
→ radar_reels에 저장 (source='search', search_query=query)
```

### 크롤러 확장

각 플랫폼 Looter 클래스에 검색 메서드 추가:

```python
# instagram.py
class InstagramLooter:
    # 기존 메서드 유지
    def search_reels(self, query: str, count: int = 20) -> list:  # 신규
        """해시태그/키워드 기반 릴 검색"""

# youtube.py
class YouTubeLooter:
    # 기존 메서드 유지
    def search_shorts(self, query: str, count: int = 20, order: str = "viewCount") -> list:  # 신규
        """키워드 기반 쇼츠 검색"""
    # 참고: 기존에 search_channel()은 있음

# tiktok.py
class TikTokLooter:
    # 기존 메서드 유지
    def search_videos(self, query: str, count: int = 20) -> list:  # 신규
        """키워드 기반 영상 검색"""
```

### 검색 결과 캐싱

동일 키워드 반복 검색 방지:

```
검색 시:
1. radar_reels에서 source='search', search_query=query, collected_at > 24시간 전 조회
2. 캐시 있으면 → DB에서 반환
3. 캐시 없으면 → 크롤러 실행 → radar_reels에 저장 → 반환
```

### 최근 검색어

사용자별 최근 검색어 표시 (검색창 포커스 시):

```
최근 검색: 딸기 디저트 | 언박싱 리뷰 | 고구마 레시피
```

저장: user_activity_logs에 action='radar_search', metadata={query} 기록.
최근 5~10개 표시.

---

## 6. 공통 — 영상 카드 컴포넌트

3개 탭 모두 동일한 영상 카드 사용. 기존 RadarPage의 카드를 공통 컴포넌트로 분리.

### 카드 레이아웃

```
┌──────────────────────────┐
│  [썸네일]          📱 IG  │
│                    🆕     │  ← 감시 탭에서만 (신규 영상)
│                          │
├──────────────────────────┤
│  캡션 텍스트 (1줄 truncate) │
│  @채널명 · 3일 전          │
│                          │
│  📈 95.6x  👁 4.2M  💬 7% │  ← Spike / 조회수 / Engagement
│                          │
│  ── 분석 완료 시 추가 ──   │
│  훅: 강력  변화량: 72      │  ← 분석 요약 뱃지
│                          │
│  [분석하기] 또는 [리포트]  │
│  ☐ 비교 선택              │  ← 체크박스
└──────────────────────────┘
```

### 카드 상태별 표시

| 상태 | 하단 버튼 | 분석 뱃지 |
|------|---------|----------|
| 미분석 | [분석하기] | 없음 |
| 분석 중 | 🔄 분석 중... (비활성) | 없음 |
| 분석 완료 | [리포트 보기] | 훅 강도 + 변화량 |
| 분석 실패 | [재시도] | 없음 |

### 카드 액션

| 액션 | 동작 |
|------|------|
| 썸네일 클릭 | 영상 재생 (모달 또는 외부 링크) |
| [분석하기] | 분석 파이프라인 실행 (기존 analyze_reel 로직) |
| [리포트 보기] | 분석 리포트 페이지로 이동 |
| [이 구조로 제작가이드] | 제작가이드로 이동 (레퍼런스 전달) |
| 체크박스 선택 (2~3개) | [비교하기] 버튼 활성화 → 비교 화면으로 |

---

## 7. 프론트 리팩토링

### 현재 문제
RadarPage.tsx 1,155줄 단일 파일.

### 변경

```
frontend/src/
├── pages/
│   └── RadarPage.tsx          # 탭 컨테이너만 (가벼움)
├── components/radar/
│   ├── RadarTabs.tsx          # 탭 네비게이션
│   ├── WatchTab.tsx           # 감시 탭 (기존 RadarPage 로직 대부분)
│   ├── TrendTab.tsx           # 트렌드 탭 (신규)
│   ├── SearchTab.tsx          # 검색 탭 (신규)
│   ├── VideoCard.tsx          # 공통 영상 카드
│   ├── ChannelManager.tsx     # 채널 등록/삭제 (감시 탭 내)
│   ├── FeedFilters.tsx        # 필터 바 (감시/트렌드 공유)
│   └── CompareBar.tsx         # 하단 비교 선택 바
```

### CompareBar (하단 고정)

영상 카드에서 체크박스 선택하면 하단에 고정 바 표시:

```
┌─────────────────────────────────────────────────────────┐
│  선택됨: 영상 A, 영상 B              [비교하기 →] [취소]  │
└─────────────────────────────────────────────────────────┘
```

3개 탭 어디서든 선택 가능. 감시에서 1개, 검색에서 1개 골라서 비교도 가능.

---

## 8. 백엔드 API 추가

### 기존 유지
- POST/GET/DELETE /api/radar/channels
- GET /api/radar/feed
- POST /api/radar/collect/:channel_id
- POST /api/radar/collect-all
- PUT /api/radar/reels/:reel_id/analyze

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/radar/trending | 카테고리별 인기 영상 |
| POST | /api/radar/trending/refresh | 트렌드 수동 새로고침 |
| GET | /api/radar/search | 키워드 영상 검색 |

**GET /api/radar/trending 파라미터:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| category | user 설정 | food / beauty / tech / lifestyle / education / all |
| platform | all | instagram / youtube / tiktok / all |
| period | 7d | 7d / 14d / 30d |
| sort | views | views / engagement / recent |
| page | 1 | |
| limit | 20 | 최대 50 |

**GET /api/radar/search 파라미터:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| query | (필수) | 검색 키워드 |
| platform | all | |
| period | 30d | 7d / 30d / 90d |
| sort | views | views / engagement / recent |
| page | 1 | |
| limit | 20 | 최대 50 |

### 응답 포맷

트렌드/검색 모두 기존 피드와 동일한 포맷:
```json
{
  "reels": [
    {
      "id": "uuid",
      "platform": "instagram",
      "thumbnail_url": "...",
      "caption": "...",
      "channel_name": "...",
      "view_count": 520000,
      "like_count": 32000,
      "comment_count": 1200,
      "spike_multiplier": null,
      "engagement_rate": 0.064,
      "posted_at": "2026-03-10T...",
      "is_analyzed": false,
      "source": "trending",
      "category": "food"
    }
  ],
  "total": 48
}
```

감시 영상과 트렌드/검색 영상의 차이: spike_multiplier는 감시에서만 (채널 평균 대비). 트렌드/검색은 null.

---

## 9. DB 변경 요약

### radar_reels 확장

```sql
-- 신규 컬럼
ALTER TABLE radar_reels ADD COLUMN source text DEFAULT 'channel';
ALTER TABLE radar_reels ALTER COLUMN channel_id DROP NOT NULL;
ALTER TABLE radar_reels ADD COLUMN category text;
ALTER TABLE radar_reels ADD COLUMN channel_name text;
ALTER TABLE radar_reels ADD COLUMN channel_followers int;
ALTER TABLE radar_reels ADD COLUMN search_query text;

-- source별 인덱스
CREATE INDEX idx_radar_reels_source ON radar_reels(source);
CREATE INDEX idx_radar_reels_category ON radar_reels(category);
CREATE INDEX idx_radar_reels_search_query ON radar_reels(search_query);

-- RLS 확장: 트렌드/검색 데이터는 전체 공유 (user_id로 필터링 불필요)
-- 감시 데이터만 기존 RLS 유지
```

### RLS 정책 수정

```sql
-- 감시: 본인 채널 영상만
-- 트렌드/검색: 모든 사용자 접근 가능
CREATE POLICY radar_reels_select ON radar_reels FOR SELECT
USING (
  source IN ('trending', 'search')
  OR channel_id IN (SELECT id FROM radar_channels WHERE user_id = auth.uid())
);
```

---

## 10. 과금 연동

| 기능 | Free | Pro |
|------|------|-----|
| 감시 — 채널 등록 | 1개 | 5개 |
| 감시 — 수집 | 무제한 (메타데이터) | 무제한 |
| 트렌드 — 조회 | 무제한 | 무제한 |
| 검색 — 검색 | 월 10회 | 월 50회 |
| 분석하기 (어디서든) | 분석 회수 차감 | 분석 회수 차감 |

**원칙:**
- 발견/감시는 무료 (데이터 축적을 위해)
- 분석은 유료 (비용 발생)
- 검색은 회수 제한 (크롤러 비용)

---

## 11. 이벤트 추적

| 이벤트 | metadata |
|--------|----------|
| `radar_tab_switch` | {tab: "watch" / "trending" / "search"} |
| `radar_channel_add` | {platform, channel_name} |
| `radar_collect` | {channel_id} |
| `radar_trending_view` | {category, platform} |
| `radar_trending_refresh` | {category} |
| `radar_search` | {query, platform, result_count} |
| `radar_analyze_click` | {reel_id, source, platform} |
| `radar_compare_select` | {reel_id, source} |
| `radar_to_guide` | {reel_id} |

**핵심 분석:**
```sql
-- 어떤 탭을 가장 많이 쓰는지
SELECT metadata->>'tab' as tab, COUNT(*)
FROM user_activity_logs
WHERE action = 'radar_tab_switch'
GROUP BY tab;

-- 감시 vs 트렌드 vs 검색에서 분석 클릭 비율
SELECT metadata->>'source' as source, COUNT(*)
FROM user_activity_logs
WHERE action = 'radar_analyze_click'
GROUP BY source;

-- 가장 많이 검색하는 키워드
SELECT metadata->>'query' as query, COUNT(*)
FROM user_activity_logs
WHERE action = 'radar_search'
GROUP BY query ORDER BY count DESC LIMIT 20;
```

검색 키워드 데이터 → 트렌드 카테고리 자동 확장에 활용 가능.

---

## 12. 데이터 플라이휠

```
레이더 3탭에서 영상 발견 (무료)
  → "이거 뭐야?" 분석 클릭 (분석 회수 차감)
  → content_dna 1행 축적
  → 라이브러리에 저장
  → 비교/제작가이드에 활용
  → 카테고리 벤치마크 정확도↑
  → 트렌드 추천 정확도↑
  → 더 많은 발견 → 더 많은 분석 → ...
```

감시만 있을 때: 사용자 100명 × 채널 3개 × 주 2개 = 주 600건 노출, 분석 ~120건
트렌드+검색 추가: 사용자 100명 × 일 5~10건 추가 발견 = 주 3,500~7,000건 노출, 분석 ~700건

**데이터 축적 속도 약 5배 향상.**

---

## 13. 구현 순서

| 순서 | 태스크 | 난이도 | 의존성 |
|------|--------|--------|--------|
| 1 | radar_reels 테이블 확장 (source, category 등) | 낮음 | 없음 |
| 2 | VideoCard 공통 컴포넌트 분리 | 중간 | 없음 |
| 3 | RadarPage 3탭 구조 + WatchTab (기존 이관) | 중간 | 2 |
| 4 | 감시 개선 (🆕 뱃지, 채널별 뷰, 분석 상태) | 낮음 | 3 |
| 5 | 크롤러 검색 메서드 추가 (3개 플랫폼) | 중간 | 없음 |
| 6 | 검색 탭 (SearchTab + API) | 중간 | 2, 5 |
| 7 | 트렌드 탭 (TrendTab + API + 카테고리 매핑) | 중간 | 2, 5 |
| 8 | CompareBar (비교 선택 → 비교 화면 연결) | 낮음 | 2 |
| 9 | 제작가이드 연결 버튼 | 낮음 | 2 |
| 10 | 이벤트 추적 | 낮음 | 3, 6, 7 |

**병렬 가능:** 1+5 동시 → 2+3 동시 → 나머지 순차

---

*관련 문서:*
- *WAKALAB_RADAR_REVIEW.md — 기존 레이더 구현 현황*
- *WAKALAB_COMPARE_SPEC.md — 비교 분석 (레이더에서 비교로 연결)*
- *WAKALAB_BETA_STRATEGY.md — 베타 전략*
- *WAKALAB_DATA_ARCHITECTURE_v2.md — 데이터 구조*
