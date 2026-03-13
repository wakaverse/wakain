# R21 Plan — 온톨로지 브릿지

> 작성: 2026-03-13 23:36 KST

---

## T9. 시간축 겹침 기반 엔티티 관계 쿼리

### 배경
RecipeJSON에 이미 시간축을 공유하는 6종 엔티티가 존재:

| 엔티티 | 데이터 소스 | 시간 정보 |
|--------|------------|----------|
| **Utterance** (발화) | `script.utterances[]` | `start`, `end` |
| **Scene** (씬) | `scenes[]` | `time_range [start, end]` |
| **Block** (블록) | `script.blocks[]` | `time_range [start, end]` |
| **Appeal** (소구) | `product.claims[]` | `source` (텍스트에 시간 참조) |
| **DynamicsPoint** (시각변화) | `visual.rhythm.dynamics_curve.points[]` | `t` (초) |
| **RiskZone** (이탈위험) | `engagement.dropoff.risk_zones[]` | `time_range [start, end]` |

### 구현 방향

**Phase 1: SQL 함수 (별도 엔진 불필요)**

```sql
-- 시간 겹침 함수
CREATE OR REPLACE FUNCTION find_overlapping_entities(
  p_result_id UUID,
  p_start DOUBLE PRECISION,
  p_end DOUBLE PRECISION
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  recipe JSONB;
BEGIN
  SELECT recipe_json INTO recipe FROM results WHERE id = p_result_id;
  
  -- scenes
  SELECT jsonb_agg(s) INTO result
  FROM jsonb_array_elements(recipe->'scenes') s
  WHERE (s->'time_range'->>0)::float <= p_end
    AND (s->'time_range'->>1)::float >= p_start;
  
  -- blocks, risk_zones, utterances도 동일 패턴
  -- ...
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

**Phase 2: 백엔드 API**
```
GET /api/entities/overlap?result_id=XXX&start=3.0&end=8.0
```
응답:
```json
{
  "scenes": [{"scene_order": 2, "style": "review", ...}],
  "blocks": [{"block_type": "benefit", "text": "...", ...}],
  "utterances": [{"text": "이 망고가...", ...}],
  "risk_zones": [],
  "dynamics_avg": 62.5
}
```

**Phase 3: 프론트 연결 (T4 통합 타임라인과 시너지)**
- 통합 타임라인에서 구간 클릭 → overlap API 호출 → 상세 패널에 관련 엔티티 모두 표시
- "이 시점에 무슨 일이 일어나고 있나" 한 화면에

### 변경 파일
| 파일 | 변경 |
|------|------|
| Supabase SQL | overlap 함수 생성 |
| `backend/app/routes/entities.py` | 신규 라우트 |
| `backend/app/main.py` | 라우터 등록 |
| (Phase 3) 프론트 | T4 통합 타임라인 상세 패널 연결 |

### 의존성
- T4 (통합 타임라인) 완료 후 Phase 3 진행 가능
- Phase 1~2는 독립 실행 가능

### 완료 기준
- [ ] SQL 함수 동작: 시간 구간 입력 → 겹치는 엔티티 반환
- [ ] API 엔드포인트 동작
- [ ] 기존 분석 결과로 테스트 (3~8초 구간 쿼리)
- [ ] (Phase 3) 타임라인 클릭 → 관련 엔티티 표시

### 향후 확장
- 정규화 테이블(analysis_claims, analysis_blocks, analysis_scenes) 기반 JOIN 쿼리
- 카테고리별 집계: "식품 카테고리에서 hook 블록의 평균 시각 변화량"
- 비교 분석: 두 영상의 같은 시간 구간에서 엔티티 diff

**예상: 2~3일 (Phase 1~2), Phase 3은 T4 이후**

---

## 실행 순서

| 단계 | 내용 | 의존성 |
|------|------|--------|
| Phase 1 | SQL overlap 함수 | 없음 |
| Phase 2 | API 엔드포인트 | Phase 1 |
| Phase 3 | 프론트 통합 | T4 + Phase 2 |

**총 예상: 2~3일**
