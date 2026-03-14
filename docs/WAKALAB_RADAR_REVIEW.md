# WakaLab 레이더 기능 현황 정리

> 2026-03-14 — 외부 검토용
> WakaIn(WakaLab) 프로젝트의 레이더(Radar) 기능 구현 현황.

---

## 1. 개요

**목적:** 경쟁사/벤치마크 채널의 숏폼 영상을 자동 수집하고, 성과 지표(Spike/Engagement)로 필터링하여 분석 파이프라인에 연결.

**지원 플랫폼:** Instagram Reels / YouTube Shorts / TikTok

**현재 상태:** 백엔드 API + 프론트 UI 구현 완료. 크롤러는 비공식 API 기반.

---

## 2. 파일 구조

```
backend/
├── app/
│   ├── routes/radar.py        # 650줄 — 레이더 API 전체
│   ├── instagram.py           # 122줄 — 인스타 크롤러 (InstagramLooter)
│   ├── youtube.py             # 148줄 — 유튜브 크롤러 (YouTubeLooter)
│   └── tiktok.py              # 101줄 — 틱톡 크롤러 (TikTokLooter)
├── migrations/
│   ├── 003_radar_tables.sql   # radar_channels + radar_reels 테이블
│   └── 004_radar_youtube.sql  # 멀티플랫폼 확장 (platform 컬럼 등)

frontend/
├── src/
│   ├── pages/RadarPage.tsx    # 1,155줄 — 레이더 UI 전체
│   └── lib/api.ts             # ~70줄 — 레이더 API 클라이언트
```

**총 코드량:** 백엔드 ~1,021줄 + 프론트 ~1,225줄

---

## 3. DB 스키마

### radar_channels (모니터링 대상 채널)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK | 등록한 사용자 |
| ig_username | text | 채널명 (@제외) |
| ig_user_id | text | 플랫폼별 내부 ID (인스타 user_id / 유튜브 channel_id / 틱톡 secUid) |
| display_name | text | 표시 이름 |
| profile_pic_url | text | 프로필 이미지 |
| follower_count | int | 팔로워/구독자 수 |
| category | text | 카테고리 (beauty 등) |
| platform | text | 'instagram' / 'youtube' / 'tiktok' |
| avg_views_30d | float | 30일 평균 조회수 (Spike 계산 기준) |
| is_active | bool | soft delete용 |
| last_error | text | 마지막 수집 에러 메시지 |
| last_error_at | timestamp | 마지막 에러 시각 |
| created_at | timestamp | |

**유니크 제약:** (user_id, platform, ig_username)

### radar_reels (수집된 영상)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| channel_id | UUID FK → radar_channels | |
| ig_media_id | text UNIQUE | 플랫폼별 고유 ID (인스타: media_id, 유튜브: yt_{video_id}, 틱톡: tt_{video_id}) |
| shortcode | text | 인스타 shortcode / 유튜브 video_id / 틱톡 video_id |
| thumbnail_url | text | 썸네일 |
| video_url | text | 영상 URL |
| caption | text | 캡션/제목 |
| view_count | int | 조회수 |
| like_count | int | 좋아요 |
| comment_count | int | 댓글 |
| spike_multiplier | float | 조회수 / 채널 30일 평균 |
| engagement_rate | float | (좋아요+댓글) / 조회수 |
| comment_ratio | float | 댓글 / 좋아요 |
| platform | text | 'instagram' / 'youtube' / 'tiktok' |
| posted_at | timestamp | 게시 시각 |
| job_id | UUID FK → jobs | 분석 연결 시 생성 |
| is_analyzed | bool | 분석 완료 여부 |

**인덱스:** spike_multiplier DESC, posted_at DESC, engagement_rate DESC

### RLS 정책

- radar_channels: `user_id = auth.uid()` (본인만 CRUD)
- radar_reels: `channel_id IN (SELECT id FROM radar_channels WHERE user_id = auth.uid())` (본인 채널 릴만 조회)

---

## 4. API 엔드포인트

### 채널 관리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/radar/channels | 채널 등록 |
| GET | /api/radar/channels | 내 채널 목록 |
| DELETE | /api/radar/channels/:id | 채널 삭제 (soft delete) |

**채널 등록 플로우:**
```
POST { ig_username: "레뷰짱", category: "beauty", platform: "instagram" }
  ↓
플랫폼별 채널 정보 자동 조회 (프로필사진, 팔로워 등)
  ↓
radar_channels INSERT
  ↓
중복 시 → 비활성 채널 재활성화 (is_active = true)
```

### 피드 조회

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/radar/feed | 수집된 영상 피드 |

**쿼리 파라미터:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| channel_id | null | 특정 채널 필터 |
| platform | null | 플랫폼 필터 |
| period | "30d" | 기간 (24h/7d/30d/90d) |
| min_spike | 1.0 | 최소 Spike 배수 |
| min_views | 0 | 최소 조회수 |
| min_engagement | 0 | 최소 Engagement Rate |
| keyword | null | 캡션 검색 |
| sort | "spike" | 정렬 (spike/engagement/views/recent) |
| page | 1 | 페이지 |
| limit | 30 | 페이지당 개수 (최대 100) |

### 수집 트리거

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/radar/collect/:channel_id | 특정 채널 수집 |
| POST | /api/radar/collect-all | 전체 채널 수집 |

**플랫폼별 수집량:**

| 플랫폼 | 수집 개수 | 방식 |
|--------|----------|------|
| Instagram | 최근 12개 릴 | InstagramLooter.get_user_reels() |
| YouTube | 최근 30개 쇼츠 | YouTubeLooter.get_channel_shorts() + get_video_detail() |
| TikTok | 최근 20개 | TikTokLooter.get_user_posts() |

**수집 시 자동 계산:**
- avg_views_30d가 0이면 수집된 영상들의 평균으로 자동 갱신
- spike_multiplier = view_count / avg_views_30d
- engagement_rate = (like_count + comment_count) / view_count
- comment_ratio = comment_count / like_count
- Upsert (ig_media_id 기준) — 중복 영상은 업데이트

**에러 처리:**
- 성공 시: last_error = null
- 실패 시: last_error에 메시지 저장, 기존 데이터 유지 (Graceful)
- 개별 채널 실패해도 collect-all은 계속 진행

### 분석 연결

| 메서드 | 경로 | 설명 |
|--------|------|------|
| PUT | /api/radar/reels/:reel_id/analyze | 릴 → 분석 파이프라인 |

**플로우:**
```
릴 선택 → 영상 다운로드 (httpx)
  ↓
R2 업로드 (boto3, uploads/{uuid}/{filename})
  ↓
jobs 테이블 INSERT (pending)
  ↓
run_analysis() 백그라운드 실행
  ↓
분석 완료 → radar_reels에 job_id + is_analyzed 업데이트
```

---

## 5. 크롤러 클래스

### InstagramLooter (122줄)

| 메서드 | 설명 |
|--------|------|
| get_user_info(username) | 프로필 정보 (이름, 사진, 팔로워) |
| get_user_id(username) | ig_user_id 조회 |
| get_user_reels(ig_user_id, count=12) | 최근 릴 목록 |
| calc_spike(views, avg) | Spike 배수 계산 |
| calc_engagement(likes, comments, views) | Engagement Rate 계산 |
| calc_comment_ratio(comments, likes) | Comment Ratio 계산 |

### YouTubeLooter (148줄)

| 메서드 | 설명 |
|--------|------|
| search_channel(query) | 채널 검색 |
| get_channel_info(channel_id) | 채널 정보 (이름, 구독자) |
| get_channel_shorts(channel_id, count=30) | 최근 쇼츠 목록 |
| get_video_detail(video_id) | 영상 상세 (조회수, 좋아요, 댓글) |
| calc_spike/engagement | 지표 계산 |

### TikTokLooter (101줄)

| 메서드 | 설명 |
|--------|------|
| get_user_info(username) | 프로필 정보 (secUid 포함) |
| get_user_posts(sec_uid, count=20) | 최근 영상 목록 |
| calc_spike/engagement | 지표 계산 |

---

## 6. 프론트엔드 (RadarPage.tsx — 1,155줄)

단일 페이지에 전체 UI 구현:
- 채널 등록/삭제 UI
- 플랫폼 선택 (인스타/유튜브/틱톡)
- 피드 필터 (기간, Spike, 조회수, Engagement, 키워드)
- 정렬 (Spike/Engagement/조회수/최신)
- 영상 카드 (썸네일, 지표, 채널 정보)
- "분석하기" 버튼 → 분석 파이프라인 연결
- "전체 수집" / 개별 수집 버튼
- 페이지네이션

### API 클라이언트 (api.ts)

```typescript
getRadarChannels(): Promise<RadarChannel[]>
addRadarChannel(username, category, platform): Promise<RadarChannel>
deleteRadarChannel(id): Promise<void>
getRadarFeed(filters): Promise<{ reels: RadarReel[]; total: number }>
analyzeRadarReel(reelId): Promise<{ job_id: string; reel_id: string }>
collectRadarChannel(channelId): Promise<...>
```

---

## 7. Quota 연동

| 플랜 | 채널 등록 수 |
|------|-------------|
| Free | 1개 |
| Pro | 5개 |

---

## 8. 알려진 이슈 / 한계

| 항목 | 상태 | 설명 |
|------|------|------|
| 비공식 API | ⚠️ 위험 | 크롤러가 공식 API가 아닌 스크래핑 기반 — 차단/변경 위험 |
| 자동 수집 없음 | ⚠️ 미구현 | 수동 "수집" 버튼만 — 주기적 자동 수집(cron) 미구현 |
| Rate Limiting | ⚠️ 미구현 | 크롤러에 요청 속도 제한 없음 |
| ig_username 컬럼명 | ⚠️ 레거시 | 모든 플랫폼에서 ig_username/ig_user_id/ig_media_id 사용 — 인스타 전용 네이밍 |
| 프론트 단일 파일 | ⚠️ | RadarPage.tsx 1,155줄 — 컴포넌트 분리 필요 |
| 영상 다운로드 | ⚠️ | analyze_reel에서 httpx로 직접 다운 — 플랫폼별 차단 가능 |

---

## 9. 개선 가능 방향

1. **공식 API 전환**: Instagram Graph API, YouTube Data API v3, TikTok Research API
2. **자동 수집 스케줄링**: Cloud Scheduler → Cloud Run 트리거
3. **컬럼명 정규화**: ig_* → channel_*, media_*, content_* 등
4. **프론트 리팩터링**: RadarPage를 서브 컴포넌트로 분리
5. **Spike 알림**: 특정 Spike 배수 초과 시 알림 (이메일/슬랙)
6. **트렌드 대시보드**: 수집 데이터 기반 카테고리별 트렌드 분석

---

*관련 문서:*
- *WAKALAB_COMPARE_SPEC.md — 비교 분석 (레이더 영상도 비교 가능)*
- *WAKALAB_BETA_STRATEGY.md — 베타 전략*
- *WAKALAB_DATA_ARCHITECTURE_v2.md — 데이터 구조*
