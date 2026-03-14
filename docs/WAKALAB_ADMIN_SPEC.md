# WakaLab 어드민 대시보드 스펙

> 2026-03-14
> Claude Code 실행용. Supabase SQL → React 페이지.
> 화려할 필요 없음. 숫자가 정확하면 됨.

---

## 0. 기본 사항

**접근:** `/admin` 경로. 관리자 계정만 접근 가능 (Supabase Auth의 role 또는 특정 user_id 화이트리스트).
**스택:** React + Tailwind (기존 프론트와 동일). Supabase JS SDK로 쿼리.
**인증:** 로그인 후 관리자 여부 확인. 비관리자 접근 시 리다이렉트.
**레이아웃:** 좌측 사이드바 메뉴 + 우측 콘텐츠 영역. 심플하게.

---

## 1. 사이드바 메뉴 구조

```
📊 대시보드        (핵심 지표)
📈 기능 사용       (기능별/탭별 현황)
⚙️ 파이프라인      (P1~P13 모니터링)
👤 사용자          (목록 + 관리)
📁 콘텐츠          (분석 영상 현황)
🔄 퍼널            (전환율 추적)
```

---

## 2. 📊 대시보드 — 핵심 지표 (첫 화면)

### 상단: 기간 선택
- 토글: `오늘` | `7일` | `30일` | `전체`
- 기본값: 7일

### 지표 카드 (4개, 가로 1행)

| 카드 | 수치 | 비교 | 데이터 소스 |
|------|------|------|-----------|
| 신규 가입자 | 기간 내 수 + 누적 | 전 기간 대비 % | auth.users (created_at) |
| 분석 완료 | 기간 내 건수 + 누적 | 전 기간 대비 % | jobs (status = 'completed') |
| 활성 사용자 (DAU/WAU) | 기간 내 유니크 | 전 기간 대비 % | user_activity_logs (DISTINCT user_id) |
| 재방문율 | 7일 내 재방문 % | - | user_activity_logs (첫 방문 후 7일 내 재등장) |

### 차트 (카드 아래, 2개)

**차트 1: 일별 가입자 + 분석 건수 (이중 축 라인 차트)**
```sql
-- 일별 가입자
SELECT date_trunc('day', created_at) as day, COUNT(*)
FROM auth.users
WHERE created_at >= :start_date
GROUP BY day ORDER BY day;

-- 일별 분석 완료
SELECT date_trunc('day', completed_at) as day, COUNT(*)
FROM jobs
WHERE status = 'completed' AND completed_at >= :start_date
GROUP BY day ORDER BY day;
```

**차트 2: 일별 활성 사용자 (막대 차트)**
```sql
SELECT date_trunc('day', created_at) as day, 
       COUNT(DISTINCT user_id) as dau
FROM user_activity_logs
WHERE created_at >= :start_date
GROUP BY day ORDER BY day;
```

---

## 3. 📈 기능 사용 — 기능별/탭별 현황

### 상단: 기간 선택 (대시보드와 동일)

### 3-1. 기능별 사용 횟수 (막대 차트 + 테이블)

| 기능 | 사용 횟수 | 유니크 사용자 | 데이터 소스 |
|------|----------|------------|-----------|
| 분석 | N건 | N명 | user_activity_logs WHERE action = 'analyze_complete' |
| 비교 | N건 | N명 | user_activity_logs WHERE action = 'compare_start' |
| 레이더 채널 등록 | N건 | N명 | user_activity_logs WHERE action = 'radar_add_channel' |
| 제작가이드 | N건 | N명 | user_activity_logs WHERE action = 'guide_generate' |
| 대본 생성 | N건 | N명 | user_activity_logs WHERE action = 'script_generate' |

```sql
SELECT action, 
       COUNT(*) as total_count,
       COUNT(DISTINCT user_id) as unique_users
FROM user_activity_logs
WHERE action IN ('analyze_complete', 'compare_start', 'radar_add_channel', 'guide_generate', 'script_generate')
  AND created_at >= :start_date
GROUP BY action
ORDER BY total_count DESC;
```

### 3-2. 탭별 클릭 분포 (파이 차트 + 테이블)

```sql
SELECT metadata->>'tab_name' as tab, COUNT(*) as clicks
FROM user_activity_logs
WHERE action = 'tab_click' AND created_at >= :start_date
GROUP BY tab
ORDER BY clicks DESC;
```

어떤 탭이 가장 인기인지 → 다음 제품 방향 결정 근거.

### 3-3. Pro 관심 지표

| 지표 | 값 | 쿼리 |
|------|---|------|
| Pro 관심 클릭 수 | N | action = 'pro_interest_click' |
| Pro 관심 클릭률 | N% | pro_interest_click / 전체 활성 사용자 |
| Free 제한 도달 횟수 | N | action = 'free_limit_reached' |
| 제한 도달 기능별 분포 | | metadata->>'feature_name' |

```sql
-- Free 제한에 어떤 기능에서 가장 많이 걸리는지
SELECT metadata->>'feature_name' as feature, COUNT(*)
FROM user_activity_logs
WHERE action = 'free_limit_reached' AND created_at >= :start_date
GROUP BY feature
ORDER BY count DESC;
```

이 데이터가 과금 모델 검증의 핵심. "분석 5회 제한에 30명이 걸렸다" → Pro 전환 가능성 높음.

---

## 4. ⚙️ 파이프라인 — P1~P13 모니터링

### 상단: 기간 선택

### 4-1. Phase별 성공/실패율 (테이블 + 막대 차트)

```sql
SELECT phase_name,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'success') as success,
       COUNT(*) FILTER (WHERE status = 'fail') as fail,
       COUNT(*) FILTER (WHERE status = 'retry') as retry,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 1) as success_rate
FROM pipeline_logs
WHERE created_at >= :start_date
GROUP BY phase_name
ORDER BY phase_name;
```

**시각화:** 가로 막대 차트. 각 Phase별 성공(초록)/실패(빨강)/재시도(노랑) 비율.
실패율 10% 이상인 Phase는 빨간 배경으로 강조.

### 4-2. 평균 분석 시간 추이 (라인 차트)

```sql
-- 일별 평균 전체 분석 시간
SELECT date_trunc('day', j.completed_at) as day,
       AVG(EXTRACT(EPOCH FROM (j.completed_at - j.created_at))) as avg_seconds
FROM jobs j
WHERE j.status = 'completed' AND j.completed_at >= :start_date
GROUP BY day ORDER BY day;
```

**목표선:** 2분 18초 (현재 평균) 점선, 1분 30초 (목표) 점선 함께 표시.

### 4-3. 건당 비용 추이 (라인 차트)

```sql
SELECT date_trunc('day', created_at) as day,
       AVG(cost_usd) as avg_cost,
       SUM(cost_usd) as total_cost
FROM pipeline_logs
WHERE status = 'success' AND created_at >= :start_date
GROUP BY day ORDER BY day;
```

### 4-4. 최근 실패 로그 (테이블, 최신 20건)

| 컬럼 | 내용 |
|------|------|
| 시간 | started_at |
| Phase | phase_name |
| 상태 | status (fail/retry) |
| 에러 | error_message (truncated, 클릭 시 전체 표시) |
| 모델 | model_used |
| result_id | 링크 (클릭 시 해당 분석 결과로) |

```sql
SELECT started_at, phase_name, status, error_message, model_used, result_id
FROM pipeline_logs
WHERE status IN ('fail', 'retry')
ORDER BY started_at DESC
LIMIT 20;
```

### 4-5. API 비용 요약 (카드)

| 카드 | 쿼리 |
|------|------|
| 오늘 비용 | SUM(cost_usd) WHERE today |
| 이번 주 비용 | SUM(cost_usd) WHERE this week |
| 이번 달 비용 | SUM(cost_usd) WHERE this month |
| 건당 평균 비용 | AVG(cost_usd per result_id) |

---

## 5. 👤 사용자 — 목록 + 관리

### 5-1. 사용자 목록 (테이블, 페이지네이션)

| 컬럼 | 내용 | 정렬 |
|------|------|------|
| 이메일 | auth.users.email | |
| 가입일 | auth.users.created_at | ✓ |
| 마지막 접속 | user_activity_logs MAX(created_at) | ✓ |
| 분석 횟수 | action = 'analyze_complete' COUNT | ✓ |
| 비교 횟수 | action = 'compare_start' COUNT | |
| 플랜 | Free / Pro | |
| Pro 관심 | pro_interest_click 여부 | |

**검색:** 이메일로 검색
**필터:** 플랜별, 가입일 범위, Pro 관심 여부

```sql
SELECT u.email, u.created_at as signup_date,
       MAX(al.created_at) as last_active,
       COUNT(*) FILTER (WHERE al.action = 'analyze_complete') as analyze_count,
       COUNT(*) FILTER (WHERE al.action = 'compare_start') as compare_count,
       BOOL_OR(al.action = 'pro_interest_click') as pro_interest
FROM auth.users u
LEFT JOIN user_activity_logs al ON u.id = al.user_id
GROUP BY u.id, u.email, u.created_at
ORDER BY u.created_at DESC
LIMIT 50 OFFSET :offset;
```

### 5-2. 사용자 상세 (클릭 시)

- 기본 정보: 이메일, 가입일, 플랜
- 활동 요약: 분석 N건, 비교 N건, 제작가이드 N건
- **회수 제한 조정:** 기능별 남은 횟수 표시 + 수동 조정 입력
  - 예: 분석 잔여 2/5회 → 관리자가 10으로 변경 가능
  - JSONB 기반으로 유연하게 저장
- 최근 활동 로그: user_activity_logs에서 해당 user_id 최근 30건

### 5-3. 회수 제한 구조 (참고)

```json
// users 테이블 또는 별도 user_quotas 테이블
{
  "plan": "free",
  "quotas": {
    "analyze": { "limit": 5, "used": 3, "reset_at": "2026-04-01" },
    "compare": { "limit": 2, "used": 1, "reset_at": "2026-04-01" },
    "radar_channels": { "limit": 1, "used": 1 },
    "guide": { "limit": 3, "used": 0, "reset_at": "2026-04-01" },
    "script": { "limit": 1, "used": 0, "reset_at": "2026-04-01" },
    "library": { "limit": 20, "used": 8 }
  }
}
```

월 초(reset_at) 기준 자동 리셋. 관리자가 수동으로 limit/used 조정 가능.

---

## 6. 📁 콘텐츠 — 분석 영상 현황

### 6-1. 요약 카드 (4개)

| 카드 | 쿼리 |
|------|------|
| 총 분석 영상 | COUNT(*) FROM content_dna |
| 카테고리 수 | COUNT(DISTINCT category) |
| 브랜드 수 | COUNT(*) FROM brands |
| 레이더 채널 수 | COUNT(*) FROM channels WHERE is_tracked = true |

### 6-2. 카테고리별 분포 (파이 차트 + 테이블)

```sql
SELECT category, COUNT(*) as count,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM content_dna
GROUP BY category
ORDER BY count DESC;
```

### 6-3. 플랫폼별 분포 (파이 차트 + 테이블)

```sql
SELECT platform, COUNT(*) as count,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM content_dna
GROUP BY platform
ORDER BY count DESC;
```

### 6-4. 일별 분석 건수 추이 (라인 차트)

```sql
SELECT date_trunc('day', created_at) as day, COUNT(*)
FROM content_dna
WHERE created_at >= :start_date
GROUP BY day ORDER BY day;
```

### 6-5. 성과 데이터 입력 현황

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE performance_source != 'none' AND performance_source IS NOT NULL) as with_performance,
  ROUND(100.0 * COUNT(*) FILTER (WHERE performance_source != 'none' AND performance_source IS NOT NULL) / COUNT(*), 1) as pct
FROM content_dna;
```

성과 데이터가 몇 %나 채워져 있는지 → 벤치마크 신뢰도 판단.

---

## 7. 🔄 퍼널 — 전환율 추적

### 퍼널 시각화 (가로 막대, 단계별 감소)

```
랜딩 방문 → 가입 → 첫 분석 → 비교 사용 → 제작가이드 → Pro 관심
```

| 단계 | 수치 | 전환율 | 데이터 소스 |
|------|------|--------|-----------|
| 랜딩 방문 | N | - | 랜딩 페이지 analytics (또는 landing_url_input 이벤트) |
| 가입 | N | N% | auth.users |
| 첫 분석 완료 | N | N% | 가입 후 첫 analyze_complete |
| 비교 사용 | N | N% | compare_start |
| 제작가이드 | N | N% | guide_generate |
| Pro 관심 | N | N% | pro_interest_click |

```sql
-- 퍼널 계산 (기간 내)
WITH funnel AS (
  SELECT 
    COUNT(DISTINCT u.id) as signups,
    COUNT(DISTINCT al_analyze.user_id) as analyzed,
    COUNT(DISTINCT al_compare.user_id) as compared,
    COUNT(DISTINCT al_guide.user_id) as guided,
    COUNT(DISTINCT al_pro.user_id) as pro_interest
  FROM auth.users u
  LEFT JOIN user_activity_logs al_analyze 
    ON u.id = al_analyze.user_id AND al_analyze.action = 'analyze_complete'
  LEFT JOIN user_activity_logs al_compare 
    ON u.id = al_compare.user_id AND al_compare.action = 'compare_start'
  LEFT JOIN user_activity_logs al_guide 
    ON u.id = al_guide.user_id AND al_guide.action = 'guide_generate'
  LEFT JOIN user_activity_logs al_pro 
    ON u.id = al_pro.user_id AND al_pro.action = 'pro_interest_click'
  WHERE u.created_at >= :start_date
)
SELECT * FROM funnel;
```

### 단계별 이탈 포인트 강조
- 전환율이 20% 미만인 단계는 빨간 표시
- 예: "가입 → 첫 분석 전환율 35%" = 정상 / "첫 분석 → 비교 전환율 8%" = 문제 → 비교 기능 발견 개선 필요

---

## 8. 구현 우선순위

### 베타 전 필수 (MVP)

| 순서 | 페이지 | 이유 |
|------|--------|------|
| 1 | 대시보드 (핵심 지표 4개 + 차트 2개) | 없으면 베타 성과 판단 불가 |
| 2 | 파이프라인 (성공/실패율 + 실패 로그) | 없으면 장애 대응 불가 |
| 3 | 사용자 (목록 + 회수 제한 조정) | 없으면 VIP/테스터 관리 불가 |

### 베타 1주차 추가

| 순서 | 페이지 | 이유 |
|------|--------|------|
| 4 | 기능 사용 (기능별 + 탭별 + Pro 관심) | 과금 모델 검증 |
| 5 | 콘텐츠 (카테고리/플랫폼 분포) | 데이터 해자 모니터링 |

### 베타 2주차 추가

| 순서 | 페이지 | 이유 |
|------|--------|------|
| 6 | 퍼널 (전환율 추적) | 데이터 쌓여야 의미 |

---

## 9. 기술 참고

### 차트 라이브러리
- Recharts (React 호환, 이미 프로젝트에 있을 수 있음) 또는 Chart.js
- 복잡한 차트 불필요. 라인, 막대, 파이 3종이면 충분.

### Supabase 쿼리
- Supabase JS SDK의 `.rpc()` 또는 `.from().select()` 사용
- 복잡한 집계는 Supabase에 SQL 함수(stored function) 생성 후 `.rpc()` 호출
- 실시간 업데이트 불필요 — 페이지 로드 시 쿼리, 수동 새로고침 버튼

### 관리자 인증
```javascript
// 방법 1: 특정 user_id 화이트리스트
const ADMIN_IDS = ['태영님_user_id', ...];

// 방법 2: Supabase user_metadata에 role 필드
const { data: { user } } = await supabase.auth.getUser();
if (user.user_metadata.role !== 'admin') redirect('/');

// 방법 3: admin_users 테이블
const { data } = await supabase.from('admin_users').select().eq('user_id', user.id);
if (!data.length) redirect('/');
```

추천: 베타에서는 방법 1(하드코딩)로 빠르게. 나중에 방법 3으로 전환.

### 필요 테이블 확인
이 어드민이 동작하려면 아래 테이블이 존재해야 함:
- `user_activity_logs` — 사용자 행동 로그 (없으면 생성)
- `pipeline_logs` — 파이프라인 모니터링 (없으면 생성)
- `content_dna` — 콘텐츠 집계 (없으면 분석 건수는 jobs/results에서 대체)
- `channels` — 레이더 채널 (없으면 해당 지표 스킵)
- `brands` — 브랜드 (없으면 해당 지표 스킵)

테이블이 아직 없는 경우: 해당 카드/차트에 "데이터 없음" 표시하고 스킵. 테이블 생성 후 자동으로 데이터 표시.

---

## 10. 페이지별 와이어프레임

### 대시보드 (첫 화면)
```
┌─────────────────────────────────────────────────────┐
│  [오늘] [7일] [30일] [전체]                          │
├────────────┬────────────┬────────────┬──────────────┤
│ 신규 가입   │ 분석 완료   │ 활성 사용자 │ 재방문율      │
│ 47명 (+12%) │ 89건 (+8%) │ 32명       │ 25%          │
│ 누적 523명  │ 누적 312건  │            │              │
├────────────┴────────────┴────────────┴──────────────┤
│                                                      │
│  [차트: 일별 가입자 + 분석 건수]                       │
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [차트: 일별 활성 사용자]                              │
│  ▓▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 파이프라인
```
┌──────────────────────────────────────────────────────┐
│  [오늘] [7일] [30일]                                  │
├──────────┬────────┬────────┬────────┬────────────────┤
│ 오늘 비용 │ 주간   │ 월간   │ 건당   │                │
│ $4.20    │ $28.50 │ $89.00 │ $0.048 │                │
├──────────┴────────┴────────┴────────┴────────────────┤
│                                                       │
│  Phase별 성공률                                        │
│  P1_STT      ████████████████████░ 95%                │
│  P2_SCAN     ████████████████████░ 98%                │
│  P3_EXTRACT  █████████████████████ 100%               │
│  P4_CLASSIFY ████████████████░░░░░ 82%  ⚠️            │
│  ...                                                  │
│                                                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│  최근 실패 로그                                        │
│  ┌──────────┬──────────┬────────┬─────────────────┐  │
│  │ 시간      │ Phase    │ 상태   │ 에러            │  │
│  │ 10:23    │ P4       │ fail   │ TypeError: ...  │  │
│  │ 09:45    │ P9       │ retry  │ Timeout: ...    │  │
│  └──────────┴──────────┴────────┴─────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 사용자 관리
```
┌───────────────────────────────────────────────────────┐
│  검색: [이메일 입력______] 필터: [플랜▼] [Pro관심▼]    │
├───────────────────────────────────────────────────────┤
│  ┌────────────────┬────────┬────────┬─────┬────────┐ │
│  │ 이메일          │ 가입일  │ 분석수 │플랜 │Pro관심  │ │
│  │ kim@agency.com │ 3/15   │ 12     │Free │ ✓      │ │
│  │ lee@brand.co   │ 3/14   │ 3      │Free │        │ │
│  └────────────────┴────────┴────────┴─────┴────────┘ │
│                                                       │
│  [사용자 클릭 시 → 상세 슬라이드 패널]                  │
│  ┌─────────────────────────────────────────┐         │
│  │ kim@agency.com                          │         │
│  │ 가입: 2026-03-15 / 마지막: 2026-03-14   │         │
│  │                                         │         │
│  │ 회수 제한 조정:                          │         │
│  │ 분석: [3] / 5  [수정]                    │         │
│  │ 비교: [1] / 2  [수정]                    │         │
│  │ 레이더: [1] / 1                          │         │
│  │                                         │         │
│  │ 최근 활동:                               │         │
│  │ 3/14 10:23 analyze_complete              │         │
│  │ 3/14 10:25 tab_click (coaching)          │         │
│  │ 3/14 10:28 guide_generate                │         │
│  └─────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────┘
```

### 퍼널
```
┌───────────────────────────────────────────────────────┐
│  기간: [7일] [30일] [전체]                             │
├───────────────────────────────────────────────────────┤
│                                                       │
│  랜딩 방문    ████████████████████████████ 1,200      │
│                          ↓ 42%                        │
│  가입         ██████████████████         500          │
│                          ↓ 60%                        │
│  첫 분석      ██████████████             300          │
│                          ↓ 17%  ⚠️                    │
│  비교 사용    ███                        50           │
│                          ↓ 60%                        │
│  제작가이드   ██                         30           │
│                          ↓ 50%                        │
│  Pro 관심     █                          15           │
│                                                       │
│  ⚠️ 첫 분석 → 비교: 17% (목표 30% 미달)               │
│  → 비교 기능 발견 개선 필요                             │
└───────────────────────────────────────────────────────┘
```

---

*이 스펙 기반으로 /admin 경로에 어드민 페이지 구현.*
*차트: Recharts 또는 Chart.js.*
*데이터: Supabase JS SDK.*
*MVP(대시보드 + 파이프라인 + 사용자)부터 구현 후 점진 확장.*
