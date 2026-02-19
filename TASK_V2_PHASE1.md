# Task: Video Analyzer v2 — Phase 1-3 개발

## 개요
마케팅 숏폼 영상 분석기의 핵심 파이프라인 고도화.
글로벌 서비스 전제, 코드 변수명은 영어, UI/출력은 한영 병기 가능.

## 작업 1: 용어 변경 — "energy" → "attention"

### 변경 범위
- `schemas.py`: energy 관련 필드명 → attention_score, attention_peak 등
- `temporal_analyzer.py`: energy 계산 로직의 변수명/출력키 변경
- `scene_aggregator.py`: 씬별 energy 집계 → attention 집계
- `scene_merger.py`: energy 필드 참조 변경
- `recipe_builder.py`: energy 관련 출력 변경
- `video_analyzer.py`: energy 참조가 있다면 변경

### 용어 매핑
```
energy_score → attention_score (0-100 스케일로 변경, 기존 0-1)
energy_arc → attention_arc
peak_score → attention_peak
energy_level → attention_level
  - 정적 → low
  - 중 → medium  
  - 강 → high
  - 클라이막스 → peak
```

### 주의사항
- 기존 output JSON과의 호환성은 신경 쓰지 않아도 됨 (새 버전)
- 0-1 스케일 → 0-100 정수로 변환 (마케터가 직관적으로 읽게)
- 영어 변수명 + 한국어 description 유지

---

## 작업 2: 씬 통합 카드 (Scene Card)

### 목표
현재 scene 데이터의 모든 정보 + production_guide를 **하나의 통합 씬 카드**로 합친다.
제작팀에 바로 넘길 수 있는 스펙 문서 역할.

### 새 스키마 (schemas.py에 추가)
```python
class SceneCard(BaseModel):
    """씬별 통합 제작 지시서 / Integrated Scene Production Brief"""
    scene_id: int
    time_range: Tuple[float, float]
    duration: float
    
    # Role & Narrative
    role: str                          # hook/demo/proof/cta/recap/transition
    description: str                   # 한국어 씬 설명
    
    # Appeal (소구)
    appeal_points: List[dict]          # 이 씬에 매핑된 소구 포인트들
    
    # Visual Direction (촬영 지시)
    shot_type: str                     # closeup/medium/wide
    camera_motion: str                 # static/slow/fast/zoom
    composition: str                   # center/rule_of_thirds/...
    subject: str                       # product/person/text/product_with_person
    product_visibility: str            # full/partial/none
    
    # Attention & Rhythm (집중도 & 리듬)
    attention_score: int               # 0-100
    attention_peak: int                # 0-100 (이 씬 내 최고)
    attention_level: str               # low/medium/high/peak
    cut_count: int
    cut_rhythm: str                    # "2 cuts, 0.8s/cut"
    transition_in: str                 # hard_cut/dissolve/fade
    transition_out: str
    
    # Text & Art (텍스트 & 아트)
    text_overlays: List[dict]          # [{text, style, position}]
    color_palette: List[str]           # 씬 컬러
    graphic_style: str                 # photo_real/info_graphic/bold_graphic
    font_style: Optional[str]         # "고딕 Bold #FFD700"
    
    # Audio (오디오)
    narration: Optional[str]           # 이 구간 나레이션 텍스트
    sound_direction: str               # "BGM 유지 + 흡입 효과음"
```

### 구현
- `recipe_builder.py`에서 기존 `scenes[]` + `production_guide.scene_guides[]`를 합쳐서 `scene_cards[]` 생성
- 기존 scene 데이터: visual_summary, content_summary, energy, transcript, artwork, text_effects, appeal_points
- production_guide: role, cut_rhythm, text_timing, energy_level, camera_suggestion
- 이 두 소스를 scene_id 기준으로 merge

### 출력
video_recipe.json에 `scene_cards` 필드 추가 (기존 scenes, production_guide도 유지)

---

## 작업 3: 이탈 예측 엔진 (Drop-off Predictor)

### 목표
집중도(attention) × 소구 간격 × 텍스트 공백 → 구간별 이탈 위험도 계산.
LLM 호출 없이 로컬 계산 (비용 0).

### 새 파일: `src/dropoff_predictor.py`

### 로직
```
1초 단위로 윈도우를 밀면서 다음 팩터를 체크:

Factor 1: 집중도 저하
  - attention_score < 20이 3초 이상 지속 → risk +40

Factor 2: 소구 공백
  - 마지막 소구 포인트 이후 5초 이상 새 소구 없음 → risk +30

Factor 3: 텍스트/나레이션 공백  
  - 텍스트 오버레이 없음 + 나레이션 없음이 4초 이상 → risk +20

Factor 4: 씬 전환 없음
  - 같은 씬이 4초 이상 → risk +10

Risk Score = sum of factors (cap at 100)
```

### 출력 스키마
```python
class DropOffZone(BaseModel):
    """이탈 위험 구간 / Drop-off Risk Zone"""
    time_range: Tuple[float, float]
    risk_score: int                    # 0-100
    risk_level: str                    # low/medium/high/critical
    risk_factors: List[str]            # ["집중도 급락 (15%)", "소구 공백 6초"]
    suggestion: str                    # "social_proof 또는 sensory 소구 삽입 권장"

class DropOffAnalysis(BaseModel):
    """이탈 예측 분석 / Drop-off Prediction Analysis"""
    risk_zones: List[DropOffZone]      # 위험 구간 리스트
    safe_zones: List[Tuple[float, float]]  # 안전 구간
    overall_retention_score: int       # 0-100 (높을수록 좋음)
    worst_zone: Optional[DropOffZone]  # 가장 위험한 구간
    improvement_priority: List[str]    # 개선 우선순위
```

### 개선 제안 자동 생성 규칙
```
집중도 급락 → "시각적 전환(컷/모션) 추가"
소구 공백 → "이 구간에 {다음으로 적절한 소구 유형} 삽입 권장"
텍스트 공백 → "핵심 메시지 텍스트 오버레이 추가"
씬 정체 → "컷 분할 또는 앵글 전환"
```

### 통합
- `recipe_builder.py`에서 호출하여 `video_recipe.json`에 `dropoff_analysis` 필드 추가
- 입력: scenes (attention + appeal_points + text_effects + transcript)

---

## 퍼포먼스 지표 추가 (작업 2,3과 함께)

recipe_builder.py에서 계산하는 신규 지표:

```python
class PerformanceMetrics(BaseModel):
    """퍼포먼스 지표 / Performance Metrics"""
    brand_exposure_sec: float          # 제품/로고가 보이는 총 시간
    product_focus_ratio: float         # 제품 중심 씬 비율 (0-100%)
    text_readability_score: int        # 텍스트 가독성 (0-100)
    time_to_first_appeal: float        # 첫 소구까지 시간 (초)
    time_to_cta: Optional[float]       # CTA까지 시간 (초)
    info_density: float                # 초당 정보량 (소구+텍스트+나레이션)
    appeal_count: int                  # 총 소구 수
    appeal_diversity: int              # 소구 유형 다양성 (종류 수)
    cut_density: float                 # 씬밀도 (cuts/sec)
    attention_avg: int                 # 평균 집중도 (0-100)
    attention_valley_count: int        # 골짜기 수
```

### 데이터 소스
- brand_exposure: content_summary.product_visibility가 full/partial인 씬의 duration 합
- product_focus_ratio: 위 씬 수 / 전체 씬 수
- text_readability: text_effects 수 × 평균 체류 시간 (씬 duration)
- time_to_first_appeal: 첫 appeal_point의 timestamp
- time_to_cta: role="cta"인 첫 씬의 start time
- info_density: (소구 수 + 텍스트 수 + 나레이션 세그먼트 수) / total_duration
- 나머지: 기존 데이터에서 직접 계산

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `schemas.py` | energy→attention 필드명, SceneCard, DropOffZone/Analysis, PerformanceMetrics 추가 |
| `temporal_analyzer.py` | energy→attention 변수/출력 변경, 0-100 스케일 |
| `scene_aggregator.py` | energy→attention |
| `scene_merger.py` | energy→attention |
| `recipe_builder.py` | scene_cards 생성, dropoff 호출, PerformanceMetrics 계산 |
| `video_analyzer.py` | energy 참조 변경 (있다면) |
| `main.py` | 변경 없음 (또는 미미한 참조 변경) |
| **NEW** `dropoff_predictor.py` | 이탈 예측 엔진 |

## 테스트
- 변경 완료 후 S5(sample5) 분석 실행하여 전체 파이프라인 동작 확인
- scene_cards, dropoff_analysis, performance_metrics가 video_recipe.json에 정상 출력되는지 확인
- 기존 필드(scenes, production_guide, persuasion_analysis, art_direction)도 깨지지 않는지 확인

## 환경
- Python 3.11+
- .env에 GEMINI_API_KEY (Free), GEMINI_API_KEY_PRO (Tier 3)
- 샘플 영상: samples/ 디렉토리
- 실행: `python main.py samples/sample5.mp4 --output output/s5_v2/`
