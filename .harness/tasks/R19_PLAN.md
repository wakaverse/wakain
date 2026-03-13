# R19 Plan — 파이프라인 안정성 + 성능 + 인프라

> 작성: 2026-03-13 23:36 KST

---

## T11. P4 CLASSIFY 안정화 ⚡ (긴급)

### 현재 문제
- MAX_RETRIES=2 (다른 Phase는 3)
- TypeError 시 배치 전체 재시도 → 8장 중 1장 문제여도 전부 재전송
- 3회 실패 시 Phase 전체 실패 → P6(SCENE) 데이터 없음

### 변경 내용
| 파일 | 변경 |
|------|------|
| `p04_classify.py` | MAX_RETRIES 2→3, 개별 프레임 폴백 로직 추가 |

- 배치 응답 파싱: try-catch per frame (필드별 기본값 폴백)
- 배치 전체 실패 시 → 프레임 1장씩 개별 재시도
- 최종 실패 프레임: `{shot_type: "unknown", has_text: false, has_product: false, has_person: false, color_tone: "neutral", text_usage: "none"}` 기본값
- 실패 로그 기록 (T14와 연계)

### 완료 기준
- [ ] 기존 TypeError 재현 불가 (방어 로직)
- [ ] 개별 프레임 폴백 동작 확인
- [ ] 전체 파이프라인이 P4 실패에도 중단되지 않음
- [ ] Python import 테스트 통과

---

## T13. Cloud Run 스펙 조정 ⚡

### 변경 (gcloud CLI 1회 실행)
```
gcloud run services update wakain-api \
  --region asia-northeast3 \
  --memory 2Gi \
  --max-instances 10 \
  --concurrency 1
```

### 현재 → 변경
| 항목 | 현재 | 변경 |
|------|------|------|
| RAM | 1GB | **2GB** |
| maxScale | 3 | **10** |
| concurrency | 160(기본) | **1** |

### 완료 기준
- [ ] `gcloud run services describe` 확인
- [ ] 분석 1건 정상 동작 확인

---

## T14. 파이프라인 모니터링 테이블

### Supabase 테이블 생성
```sql
CREATE TABLE pipeline_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  result_id UUID REFERENCES results(id),
  phase_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',  -- running/success/fail/retry
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  model_used TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd DOUBLE PRECISION DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pipeline_logs_job ON pipeline_logs(job_id);
CREATE INDEX idx_pipeline_logs_phase ON pipeline_logs(phase_name, status);
```

### 백엔드 변경
| 파일 | 변경 |
|------|------|
| `orchestrator.py` | `_run_phase` 내에서 pipeline_logs INSERT (시작/완료/실패) |
| `worker.py` | job_id 전달 |

### 완료 기준
- [ ] 분석 1건 실행 후 pipeline_logs에 Phase별 행 생성 확인
- [ ] 실패 Phase의 error_message 기록 확인
- [ ] `SELECT phase_name, avg(duration_ms) FROM pipeline_logs GROUP BY phase_name` 쿼리 동작

---

## T15. Gemini API 장애 대응

### 현재 상태
| Phase | MAX_RETRIES | backoff |
|-------|-------------|---------|
| P2 | 3 | 2^n × 5초 |
| P4 | 2 → 3 (T11) | 2^n × 3초 |
| P7 | 3 | 2^n × 5초 |
| P8 | 3 | 2^n × 5초 |
| P9 | 3 | 2^n × 5초 |
| P10 | 3 | 2^n × 5초 |
| **P13** | **없음** ❌ | - |

### 변경 내용
| 파일 | 변경 |
|------|------|
| `p13_evaluate.py` | MAX_RETRIES=3 + exponential backoff 추가 |
| `worker.py` | 최종 실패 시 jobs.status='failed' + error_message 기록 |

### 완료 기준
- [ ] P13에 재시도 로직 추가
- [ ] 전체 실패 시 사용자에게 에러 메시지 표시
- [ ] jobs 테이블에 실패 상태 기록

---

## T5. P9 ENGAGE Phase 분리 검토

### 검토 방법
1. 최근 5건 분석의 P9 출력 품질 비교
2. hook_scan + triggers가 동시에 빈값인 경우 확인
3. 불안정하면 P9a(hook_scan) / P9b(triggers+risk) 분리

### 변경 (분리 시)
| 파일 | 변경 |
|------|------|
| `p09a_hook_scan.py` | 신규 — hook_strength, hook_scan만 추출 |
| `p09b_engage.py` | 기존 P9에서 hook 부분 제거 |
| `orchestrator.py` | 병렬② 구간에 P9a, P9b 동시 실행 |
| `p12_build.py` | P9a + P9b 결과 병합 |

### 완료 기준
- [ ] 품질 검토 리포트 작성
- [ ] (분리 시) 분리 후 동일 영상 비교 테스트

---

## T6. scenes 테이블 정규화

### Supabase 테이블 생성
```sql
CREATE TABLE analysis_scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id UUID REFERENCES results(id),
  scene_order INTEGER NOT NULL,
  time_start DOUBLE PRECISION,
  time_end DOUBLE PRECISION,
  style TEXT,
  style_sub TEXT,
  role TEXT,
  visual_forms JSONB DEFAULT '[]',
  block_refs JSONB DEFAULT '[]',
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_analysis_scenes_result ON analysis_scenes(result_id);
CREATE INDEX idx_analysis_scenes_style ON analysis_scenes(style, category_id);
```

### 백엔드 변경
| 파일 | 변경 |
|------|------|
| `worker.py` | `_save_normalized_data`에 scenes INSERT 추가 |

### 완료 기준
- [ ] 분석 1건 후 analysis_scenes에 씬 행 생성 확인
- [ ] `SELECT style, COUNT(*) FROM analysis_scenes GROUP BY style` 동작

---

## T16. RapidAPI 대안 확보 (조사)

### 조사 범위
- Instagram Graph API (공식) — 비즈니스 계정만
- TikTok Research API — 학술/비즈니스 접근
- Apify, Bright Data 등 대안 스크래핑
- 각 서비스 비용/제한/안정성 비교

### 변경 없음 (조사만)
- 조사 결과 문서: `docs/SOCIAL_API_ALTERNATIVES.md`

### 완료 기준
- [ ] 대안 3개 이상 비교 문서 작성
- [ ] 추천 1순위 선정

---

## T12. P13 EVALUATE 스트리밍 (후순위)

### 변경 내용
| 파일 | 변경 |
|------|------|
| `p13_evaluate.py` | Gemini streaming response 활용 |
| `worker.py` | SSE/WebSocket으로 프론트에 점진적 전달 |
| 프론트 | 코칭 카드 streaming 렌더링 |

### 완료 기준
- [ ] P13 결과가 생성되는 대로 프론트에 점진적 표시
- [ ] 전체 소요시간 동일하지만 체감 대기 감소

---

## 실행 순서 & 예상

| 순서 | 태스크 | 예상 | 비고 |
|------|--------|------|------|
| 1 | T11 P4 안정화 | 반나절 | 긴급 |
| 2 | T15 P13 재시도 | 반나절 | T11과 병렬 |
| 3 | T13 Cloud Run 스펙 | 10분 | CLI 1회 |
| 4 | T14 모니터링 테이블 | 1일 | |
| 5 | T5 P9 분리 검토 | 반나절 | 조사만 |
| 6 | T6 scenes 정규화 | 반나절 | |
| 7 | T16 RapidAPI 대안 | 1일 | 조사만 |
| 8 | T12 P13 스트리밍 | 2일 | 후순위 |

**총 예상: 5~6일**
