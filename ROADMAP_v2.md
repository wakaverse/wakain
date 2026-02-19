# Video Analyzer v2 — 도입 시나리오

## 목표
마케터가 영상을 넣으면 **"잘 된 거야? → 왜? → 어떻게 고쳐?"** 3가지를 한 번에 답하는 분석기.

현재 **"왜 잘 됐는가 + 어떻게 다시 만드는가"**에 강하지만,
**"잘 된 거야 못 된 거야 + 어디가 문제야"**가 약함 → 이걸 보강.

---

## Phase A: 퍼널 체크리스트 도입 (핵심, 우선 개발)

### A1. SWUBA 체크리스트 (Phase 4에 추가)

기존 Phase 4 Gemini 호출에 **3번째 API 콜** 추가:
```
Phase 4 현재:
  ① 메인 분석 (구조/오디오/STT/소구/전략)
  ② 아트 디렉션

Phase 4 추가:
  ③ 퍼널 체크리스트 (SWUBA)
```

**스키마:**
```python
class FunnelCondition(BaseModel):
    id: str           # "S1", "W3", "B2" 등
    condition: str    # 조건 설명
    is_met: bool      # 부합 여부
    evidence: str     # 영상 관측 근거 (1-2문장)

class FunnelChecklist(BaseModel):
    stop: List[FunnelCondition]        # 5개 (0-3초 스크롤 멈춤)
    watch: List[FunnelCondition]       # 5개 (시청 유지)
    understand: List[FunnelCondition]  # 5개 (제품 이해)
    believe: List[FunnelCondition]     # 5개 (신뢰 형성)
    act: List[FunnelCondition]         # 5개 (행동 유도)
    
    # 퍼널 요약
    first_failure_stage: str    # 첫 번째 실패 단계 (S/W/U/B/A)
    pass_rate: float            # 부합률 (0-100%)
```

**프롬프트 핵심 규칙:**
- 부합 판정은 엄격하게. 영상에서 관측 가능한 증거가 있을 때만 부합.
- 애매하면 무조건 비부합.
- 추정, 일반론 금지.

**구현:** `video_analyzer.py`에 `_FUNNEL_SCHEMA` + 3번째 API 콜 추가
**비용:** Gemini 2.5 Flash 1회 추가 (~$0.01/영상)
**예상 개발:** 2-3시간

### A2. 전환 예측 + 병목 진단

SWUBA 결과를 기반으로 **로컬 계산** (LLM 추가 호출 불필요):

```python
class ConversionPrediction(BaseModel):
    prediction: str          # "평균보다 높음" / "평균 수준" / "평균보다 낮음"
    score: int               # 0-100 (부합 조건 수 기반)
    bottleneck_id: str       # 가장 큰 병목 조건 ID ("B2")
    bottleneck_stage: str    # 병목 단계 ("Believe")
    bottleneck_reason: str   # 병목 이유
    
    success_factors: List[str]   # 강점 3개
    failure_risks: List[str]     # 약점 3개
```

**판정 로직 (로컬):**
```
pass_rate >= 80% → "평균보다 높음"
pass_rate 50-79% → "평균 수준"  
pass_rate < 50%  → "평균보다 낮음"

병목 = 퍼널 순서(S→W→U→B→A)에서 첫 번째 비부합 다수 단계
```

**구현:** `recipe_builder.py`에 추가
**비용:** 0 (로컬 계산)
**예상 개발:** 1시간

---

## Phase B: 액션 가이드 강화

### B1. 개선 제안 (Improvement Suggestions)

SWUBA 비부합 조건 → 구체적 개선 액션 매핑:

```python
class ImprovementAction(BaseModel):
    target_condition: str     # "B2"
    priority: str             # "critical" / "high" / "medium"
    current_state: str        # "성능 근거 없음"
    suggested_action: str     # "리뷰 3개 또는 판매량 텍스트 오버레이 추가"
    insert_at_scene: int      # 삽입 추천 씬 번호
    reference_technique: str  # 참고할 연출 기법
```

**구현:** Phase 4에 4번째 API 콜 또는 recipe_builder에서 룰 기반 생성
**예상 개발:** 3-4시간

### B2. 영상 비교 리포트 (A vs B)

2개 영상의 recipe를 비교하는 모듈:

```python
class ComparisonReport(BaseModel):
    video_a: str
    video_b: str
    
    # 정량 비교
    scene_count: Tuple[int, int]
    appeal_count: Tuple[int, int]
    funnel_pass_rate: Tuple[float, float]
    
    # 퍼널 비교 (어디서 차이나는가)
    divergence_point: str     # "Believe 단계에서 A는 4/5 부합, B는 1/5"
    
    # 핵심 차이 3가지
    key_differences: List[str]
    
    # 승자 판정
    winner: str               # "A" / "B" / "비등"
    reason: str
```

**구현:** 새 파일 `comparator.py`
**예상 개발:** 4-5시간

---

## Phase C: AI 아티팩트 감지 (크랩스 QC용)

### C1. 프레임 레벨 아티팩트 감지

Phase 2 (frame_qual)에 아티팩트 관련 필드 추가:

```python
class FrameArtifact(BaseModel):
    ai_generated_likely: bool          # AI 생성 영상 의심 여부
    shimmering_detected: bool          # 울렁거림
    morphing_detected: bool            # 질감 변형
    physics_violation: Optional[str]   # 물리 법칙 위배 설명
    action_consequence_match: bool     # 행동-결과 일치
```

### C2. 비디오 레벨 아티팩트 종합

Phase 4에서 전체 영상 QC:

```python
class ArtifactAssessment(BaseModel):
    ai_generated_confidence: float     # 0-1
    artifact_scenes: List[int]         # 아티팩트 발견 씬
    severity: str                      # "none" / "minor" / "critical"
    details: List[str]                 # 구체적 결함 설명
    logic_errors: List[dict]           # 인과관계 불일치
```

**구현:** frame_qual.py + video_analyzer.py 수정
**예상 개발:** 4-5시간

---

## Phase D: 도메인 동적 체크리스트

### D1. 도메인 자동 감지 + 추가 조건 생성

Phase 4에서 도메인 감지 후, 해당 도메인 특화 조건 5개 자동 생성:

```
입력: "식품 > 건강음료 > NFC 착즙 주스"
출력:
  D1: HACCP 인증 노출 여부
  D2: 실제 섭취 반응의 자연스러움
  D3: 성분 함량 구체적 수치 표기
  D4: 유통기한/보관 안내
  D5: 1회 섭취량 대비 가격 명시
```

**구현:** 별도 API 콜 1회 (도메인 조건 생성 → 평가)
**예상 개발:** 3-4시간

---

## 우선순위 & 일정

| 순서 | Phase | 기능 | 비용 추가 | 개발 시간 | 마케터 가치 |
|------|-------|------|----------|----------|------------|
| 🥇 1 | A1 | SWUBA 체크리스트 | +$0.01/영상 | 2-3h | ⭐⭐⭐⭐⭐ |
| 🥇 1 | A2 | 전환 예측 + 병목 | $0 | 1h | ⭐⭐⭐⭐⭐ |
| 🥈 2 | B1 | 개선 제안 | +$0.01 or $0 | 3-4h | ⭐⭐⭐⭐ |
| 🥈 2 | B2 | 영상 비교 | $0 | 4-5h | ⭐⭐⭐⭐ |
| 🥉 3 | C1+C2 | AI 아티팩트 감지 | +$0.01 | 4-5h | ⭐⭐⭐ |
| 4 | D1 | 도메인 동적 체크 | +$0.01 | 3-4h | ⭐⭐⭐ |

**1차 목표 (Phase A): 3-4시간 → 퍼널 체크리스트 + 전환 예측 완성**
**2차 목표 (Phase B): +7-9시간 → 액션 가이드 + 비교 리포트**
**3차 목표 (Phase C+D): +7-9시간 → 아티팩트 감지 + 도메인 동적**

---

## 완성 후 video_recipe.json 구조

```json
{
  "video_recipe": {
    "meta": { ... },
    "structure": { ... },
    "visual_style": { ... },
    "audio": { ... },
    "product_strategy": { ... },
    "persuasion_analysis": { ... },      // ← 기존 (소구 분석)
    "art_direction": { ... },            // ← 기존 (아트워크)
    
    "funnel_checklist": {                // ← NEW: 퍼널 체크리스트
      "stop": [...],
      "watch": [...],
      "understand": [...],
      "believe": [...],
      "act": [...]
    },
    "conversion_prediction": {           // ← NEW: 전환 예측
      "prediction": "평균보다 낮음",
      "score": 52,
      "bottleneck_id": "B2",
      "bottleneck_stage": "Believe",
      "bottleneck_reason": "...",
      "success_factors": [...],
      "failure_risks": [...]
    },
    "improvement_actions": [...],        // ← NEW: 개선 액션
    "artifact_assessment": { ... },      // ← NEW: AI 아티팩트
    
    "effectiveness_assessment": { ... },
    "scenes": [...],
    "temporal_profile": { ... },
    "production_guide": { ... }
  }
}
```

---

## 마케터 관점 최종 출력 이미지

```
📊 영상 분석 리포트 — [제품명]

🚦 전환 예측: 평균보다 낮음 (52점/100)
🔴 병목: Believe 단계 — "성능 근거(리뷰/인증) 부재"

📋 퍼널 체크리스트
  Stop     ████░ 4/5 ✅
  Watch    █████ 5/5 ✅  
  Understand ███░░ 3/5 ⚠️
  Believe  █░░░░ 1/5 ❌ ← 여기서 이탈
  Act      ███░░ 3/5 ⚠️

🎯 소구 분석: 13개 포인트, 4단계 레이어링
🎬 씬 밀도: 0.7컷/초 (24씬/35초)
🎨 아트 디렉션: 따뜻한 톤, 손글씨+고딕 혼합

⚡ 개선 액션 TOP 3:
  1. [B2] Scene 8 뒤에 고객 리뷰 2-3초 삽입
  2. [U5] 경쟁 제품 대비 차별점 자막 추가
  3. [A3] CTA에 "이번 주만 할인" 긴급성 추가
```
