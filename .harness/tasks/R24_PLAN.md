# R24 Plan — Free/Pro 회수 제한 + 결제 의향 테스트

> 2026-03-14
> 참조: docs/WAKALAB_BETA_STRATEGY.md (섹션 7)

---

## T1: user_quotas 테이블 + 마이그레이션

```sql
user_quotas:
  id uuid PK
  user_id uuid FK UNIQUE (auth.users)
  plan text DEFAULT 'free' (free/pro)
  quotas jsonb DEFAULT '{
    "analyze": {"limit": 5, "used": 0},
    "compare": {"limit": 2, "used": 0},
    "library": {"limit": 20, "used": 0},
    "radar": {"limit": 1, "used": 0},
    "guide": {"limit": 3, "used": 0},
    "script": {"limit": 1, "used": 0}
  }'
  reset_at timestamptz (다음 월초 리셋 시점)
  created_at timestamptz
  updated_at timestamptz
```

- RLS 적용 (본인만 조회, service_role 전체 접근)
- 첫 분석 시 자동 생성 (free plan)

### 완료 기준
- [x] 마이그레이션 SQL 작성 + supabase db push
- [x] RLS policy 포함

---

## T2: 백엔드 — quota 체크 미들웨어

### backend/app/services/quota.py
- `check_quota(user_id, feature) -> bool` — used < limit 검증
- `increment_quota(user_id, feature)` — used += 1
- `get_or_create_quota(user_id) -> dict` — 없으면 free 기본값으로 생성
- `reset_monthly_quotas()` — 월초 리셋 (크론 또는 체크 시 자동)

### 적용 대상
- POST /analyze, /analyze-url → "analyze"
- POST /guide → "guide"
- POST /guide/script → "script" (대본 생성)
- 비교 API (R25에서 추가) → "compare"
- 라이브러리 추가 → "library"
- 레이더 채널 등록 → "radar"

### 초과 시 응답
```json
{
  "error": "quota_exceeded",
  "feature": "analyze",
  "used": 5,
  "limit": 5,
  "plan": "free",
  "reset_at": "2026-04-01T00:00:00Z"
}
```

### 완료 기준
- [x] quota.py 서비스 모듈
- [x] analyze, guide 라우트에 체크 적용
- [x] 초과 시 403 + quota_exceeded 응답

---

## T3: 백엔드 — quota 조회 API

### GET /quota
- 인증 필요
- 현재 사용자의 quota 상태 반환

```json
{
  "plan": "free",
  "quotas": {
    "analyze": {"limit": 5, "used": 3},
    "compare": {"limit": 2, "used": 0},
    "library": {"limit": 20, "used": 5},
    "radar": {"limit": 1, "used": 1},
    "guide": {"limit": 3, "used": 1},
    "script": {"limit": 1, "used": 0}
  },
  "reset_at": "2026-04-01T00:00:00Z"
}
```

### 완료 기준
- [x] GET /quota 엔드포인트
- [x] 인증 + 본인 데이터만

---

## T4: 프론트 — 잔여 횟수 표시

- 분석 페이지 상단: "이번 달 3/5회 사용"
- 라이브러리: "20개 중 5개 저장"
- 각 기능 사용 시 잔여 횟수 업데이트

### 완료 기준
- [x] AnalyzePage에 quota 표시
- [x] API 연동 (GET /quota)

---

## T5: 프론트 — Pro 업그레이드 모달

### 초과 시 모달
```
📊 이번 달 무료 분석을 모두 사용했습니다

Pro 플랜
✅ 분석 월 50회
✅ 비교 분석 월 20회
✅ 라이브러리 200개
✅ 레이더 채널 5개
✅ 제작가이드 월 30회
✅ 리포트 내보내기 (워터마크 없음)

[관심 있어요]  [다음에]
```

### "관심 있어요" 클릭 시
- user_activity_logs에 { action: "pro_interest", metadata: { feature: "analyze", plan: "free" } } 기록
- 모달 변경: "감사합니다! 베타 기간 의견을 참고하고 있습니다 🙏"
- 사용자의 quota를 추가 증정하지 않음 (베타 전략상 이벤트 해제는 별도 판단)

### 완료 기준
- [x] ProUpgradeModal 컴포넌트
- [x] quota 초과 시 자동 표시
- [x] 클릭 로그 기록

---

## 실행 순서

| 순서 | 태스크 | 예상 소요 |
|------|--------|----------|
| 1 | T1: user_quotas 테이블 | 10분 |
| 2 | T2: quota 체크 서비스 | 20분 |
| 3 | T3: quota 조회 API | 10분 |
| 4 | T4: 잔여 횟수 표시 | 15분 |
| 5 | T5: Pro 모달 | 15분 |

**총 예상: 포지 기준 ~1시간**
