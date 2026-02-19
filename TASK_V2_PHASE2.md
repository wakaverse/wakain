# Task: Video Analyzer v2 — Phase 2: 스코어 카드 + 비교 엔진 + 벤치마크

## 전제
- Phase 1 (attention 리네임 + scene cards + dropoff predictor + perf metrics) 완료 후 진행
- 글로벌 서비스 전제, 코드 영어 / 출력 한영 병기

---

## 작업 4: 스코어 카드 시스템 (Score Card)

### 목표
리포트 최상단에 **4가지 직관적 점수 + 한 줄 진단**을 자동 생성.
마케터가 전체 리포트를 안 읽어도 핵심을 1초에 파악.

### 4가지 스코어

#### 4-1. 후킹 지수 (Scroll-Stop Score)
```
"첫 3초가 시청자를 멈추게 하는가?"
```

**계산 (로컬, 비용 0):**
```python
scroll_stop_score = weighted_sum(
    첫 3초 평균 attention_score     * 0.25,   # 시각 자극
    첫 소구 등장 시점 점수           * 0.25,   # 2초 이내=100, 3초=70, 5초+=0
    첫 3초 텍스트 존재 여부          * 0.15,   # 있으면 100, 없으면 0
    훅 타입 점수                    * 0.20,   # myth_bust/curiosity=100, emotional=70, none=0
    첫 3초 제품 식별 가능 여부        * 0.15,   # full=100, partial=50, none=0
)
```

**데이터 소스:**
- scenes[0:N] (time_range < 3.0)의 attention_score 평균
- persuasion_analysis.appeal_points[0].visual_proof.timestamp
- scenes[0:N]의 text_effects 존재 여부
- structure.scene_sequence[0].role == "hook" 여부
- scenes[0:N]의 content_summary.product_visibility

#### 4-2. 브랜드 존재감 (Brand Prominence Index)
```
"제품/브랜드가 충분히, 잘 보이는가?"
```

**계산:**
```python
brand_prominence = weighted_sum(
    제품 노출 시간 비율              * 0.35,   # product visible 씬 duration / total
    제품 중심 구도 비율              * 0.30,   # composition=center인 씬 비율
    제품 클로즈업 비율               * 0.20,   # shot_type=closeup + product visible
    로고/브랜드명 텍스트 등장 횟수     * 0.15,   # text_effects에서 브랜드 관련 텍스트
)
```

**데이터 소스:**
- scenes[].content_summary.product_visibility (full/partial/none)
- scenes[].visual_summary.composition
- scenes[].visual_summary.dominant_shot
- scenes[].text_effects + product_strategy.brand_visibility

#### 4-3. 메시지 정합성 (Message Alignment Score)
```
"말(나레이션/텍스트)과 화면(비주얼)이 일치하는가?"
```

**계산 (로컬, 소구 기반):**
```python
# 각 소구 포인트에 대해:
#   - visual_proof가 있는가? (시각적 증거 기법)
#   - 해당 씬의 content_summary.subject와 소구 유형이 일치하는가?
#   - 나레이션과 화면 피사체가 같은 것을 가리키는가?

alignment_score = (정합 소구 수 / 전체 소구 수) * 100
```

**정합 판정 룰:**
```
sensory 소구 + 화면에 제품 사용 장면 → 정합 ✅
specification 소구 + 화면에 텍스트 오버레이 → 정합 ✅
process 소구 + 화면에 제조 공정 → 정합 ✅
social_proof 소구 + 화면에 증거 (리뷰/매출/수상) → 정합 ✅
소구 있는데 화면은 무관한 장면 → 불일치 ❌
```

**데이터 소스:**
- persuasion_analysis.appeal_points[].visual_proof.technique
- scenes[].content_summary.subject_type
- scenes[].appeal_points와 visual_summary 교차

#### 4-4. CTA 도달률 (CTA Completion Rate)
```
"영상 끝까지 봤을 때 행동으로 이어지는가?"
```

**계산:**
```python
cta_completion = weighted_sum(
    마지막 5초 평균 attention_score   * 0.25,   # 끝까지 집중 유지
    CTA 존재 여부                    * 0.25,   # role=cta인 씬 존재
    가격/혜택 정보 존재               * 0.20,   # product_strategy.price_shown
    긴급성 소구 존재                  * 0.15,   # urgency/scarcity 소구
    보장/약속 소구 존재               * 0.15,   # guarantee 소구
)
```

**데이터 소스:**
- scenes[-N:]의 attention_score (마지막 5초)
- structure.scene_sequence에서 role=cta 존재
- product_strategy.price_shown, offer_type
- persuasion_analysis.appeal_points에서 urgency/guarantee 존재

### 한 줄 진단 (One-Line Diagnosis)

**생성 로직 (로컬, 룰 기반):**
```python
# 4개 점수 중 가장 높은 것 = 강점, 가장 낮은 것 = 약점
strongest = max(scores)  # "맛 자극이 훌륭합니다"
weakest = min(scores)    # "가격 정보가 부족합니다"

# 약점에 대한 개선 제안 = dropoff_analysis에서 가장 위험한 구간의 suggestion
fix = dropoff_analysis.worst_zone.suggestion

diagnosis = f"{strongest.label}은(는) {strongest.adjective}({strongest.score}점)하지만, "
           f"{weakest.label}이(가) 부족하여({weakest.score}점) 전환이 약할 수 있습니다. "
           f"{fix}"
```

### 스키마
```python
class ScoreCard(BaseModel):
    """리포트 상단 스코어 카드 / Report Score Card"""
    scroll_stop_score: int         # 0-100 후킹 지수
    scroll_stop_grade: str         # excellent/good/fair/poor
    scroll_stop_reason: str        # "강한 myth_bust 훅 + 1.5초 내 첫 소구"
    
    brand_prominence: int          # 0-100 브랜드 존재감
    brand_prominence_grade: str
    brand_prominence_reason: str
    
    message_alignment: int         # 0-100 메시지 정합성
    message_alignment_grade: str
    message_alignment_reason: str
    
    cta_completion: int            # 0-100 CTA 도달률
    cta_completion_grade: str
    cta_completion_reason: str
    
    overall_score: int             # 4개 평균
    overall_grade: str
    one_line_diagnosis: str        # 한 줄 진단 (한국어)
    one_line_diagnosis_en: str     # 한 줄 진단 (영어)

class GradeThreshold:
    """등급 기준"""
    EXCELLENT = 80  # 80-100
    GOOD = 60       # 60-79
    FAIR = 40       # 40-59
    POOR = 0        # 0-39
```

### 구현
- 새 파일: `src/score_card.py`
- `recipe_builder.py`에서 호출하여 `video_recipe.json`에 `score_card` 필드 추가
- 입력: scenes, persuasion_analysis, product_strategy, structure, dropoff_analysis

---

## 작업 5: 비교 엔진 (Comparison Engine)

### 목표
N개 영상의 recipe를 비교하여 자동 비교 리포트 생성.
"A안 vs B안" 또는 "우리 vs 경쟁사"

### 새 파일: `src/comparator.py`

### CLI
```bash
python main.py compare output/s1/*/video_recipe.json output/s3/*/video_recipe.json output/s5/*/video_recipe.json
python main.py compare output/s1/*/video_recipe.json output/s2/*/video_recipe.json --labels "성공안,실패안"
```

### 비교 항목

```python
class VideoSummary(BaseModel):
    """비교용 영상 요약 / Video Summary for Comparison"""
    name: str
    label: Optional[str]           # success/failure 또는 사용자 지정
    duration: float
    scene_count: int
    cut_density: float
    
    # Score Card
    scroll_stop_score: int
    brand_prominence: int
    message_alignment: int
    cta_completion: int
    overall_score: int
    
    # Appeal
    appeal_count: int
    appeal_types: List[str]
    appeal_diversity: int
    first_appeal_sec: float
    
    # Performance
    attention_avg: int
    attention_valley_count: int
    product_focus_ratio: float
    time_to_cta: Optional[float]
    
    # Structure
    structure_type: str
    hook_type: Optional[str]       # 첫 소구 유형
    closer_type: Optional[str]     # 마지막 소구 유형

class ComparisonReport(BaseModel):
    """비교 리포트 / Comparison Report"""
    videos: List[VideoSummary]
    
    # 정량 비교 테이블
    metrics_table: Dict[str, List]
    
    # 핵심 차이점 (자동 추출)
    key_differences: List[str]     # "A는 소구 13개, B는 6개 (2.2배 차이)"
    
    # 소구 패턴 비교
    common_appeals: List[str]      # 공통 소구 유형
    unique_appeals: Dict[str, List[str]]  # 영상별 고유 소구
    
    # 집중도 곡선 비교 데이터 (겹치기용)
    attention_curves: Dict[str, List[Tuple[float, int]]]  # {name: [(time, score), ...]}
    
    # 승패 판정 (2개 영상일 때)
    winner: Optional[str]
    winner_reason: Optional[str]
    
    # 공통 성공 패턴 (3개+ 성공 영상일 때)
    winning_formula: Optional[List[str]]
```

### 핵심 차이점 자동 추출 로직
```python
def find_key_differences(videos: List[VideoSummary]) -> List[str]:
    """수치 차이가 큰 항목을 자동으로 찾아 문장 생성"""
    diffs = []
    
    metrics = [
        ("씬 수", "scene_count", "개"),
        ("씬 밀도", "cut_density", "/초"),
        ("소구 수", "appeal_count", "개"),
        ("후킹 지수", "scroll_stop_score", "점"),
        ("평균 집중도", "attention_avg", "%"),
        ("CTA 도달률", "cta_completion", "점"),
    ]
    
    for label, key, unit in metrics:
        values = [getattr(v, key) for v in videos]
        if max(values) > 0:
            ratio = max(values) / max(min(values), 0.01)
            if ratio >= 1.5:  # 1.5배 이상 차이나면 핵심 차이
                names = [v.name for v in videos]
                diffs.append(
                    f"{label}: {names[values.index(max(values))]} {max(values)}{unit} vs "
                    f"{names[values.index(min(values))]} {min(values)}{unit} ({ratio:.1f}배)"
                )
    
    return sorted(diffs, key=lambda x: float(x.split('(')[-1].split('배')[0]), reverse=True)
```

### 집중도 곡선 겹치기 데이터
```python
def extract_attention_curve(recipe: dict) -> List[Tuple[float, int]]:
    """scene cards에서 시간-집중도 쌍 추출 (정규화: 0-100% 타임라인)"""
    total_dur = recipe['meta']['duration'] or recipe['structure']['total_duration_sec']
    curve = []
    for sc in recipe['scene_cards']:
        mid_time = (sc['time_range'][0] + sc['time_range'][1]) / 2
        pct = (mid_time / total_dur) * 100  # 0-100% 정규화 (길이 다른 영상 비교용)
        curve.append((round(pct, 1), sc['attention_score']))
    return curve
```

---

## 작업 6: 벤치마크 DB (Category Benchmark)

### 목표
분석한 영상이 쌓이면서 카테고리별 기준선이 자동 업데이트.
"같은 카테고리 성공 영상 평균 대비 내 영상의 위치"

### 구조
```
benchmark/
  index.json                    # 등록된 영상 목록
  food/
    baseline.json               # 통계 (성공/실패 평균)
    appeal_patterns.json        # 소구 패턴 빈도
  beauty/
    baseline.json
    appeal_patterns.json
  electronics/
    ...
```

### 새 파일: `src/benchmark_manager.py`

### CLI
```bash
# 벤치마크에 영상 등록
python main.py benchmark add output/s5/*/video_recipe.json --label success --category food

# 카테고리 기준선 조회
python main.py benchmark show food

# 내 영상을 벤치마크와 비교
python main.py benchmark compare output/new/*/video_recipe.json --category food
```

### 기준선 스키마
```python
class CategoryBaseline(BaseModel):
    """카테고리 벤치마크 기준선 / Category Benchmark Baseline"""
    category: str
    sample_count: int
    success_count: int
    failure_count: int
    last_updated: str
    
    # 성공 영상 평균
    success_avg: Dict[str, float]   # {scroll_stop: 82, brand_prominence: 71, ...}
    # 실패 영상 평균  
    failure_avg: Dict[str, float]
    
    # 소구 패턴
    top_appeal_types: List[Tuple[str, float]]      # [(sensory, 0.92), (spec, 0.88), ...]
    avg_appeal_count: Dict[str, float]              # {success: 11.2, failure: 6.4}
    common_hook_types: List[Tuple[str, float]]      # [(myth_bust, 0.60), (emotional, 0.25)]
    common_closer_types: List[Tuple[str, float]]    # [(guarantee, 0.45), (urgency, 0.30)]
    
    # 구조 패턴
    avg_cut_density: Dict[str, float]               # {success: 0.82, failure: 0.35}
    avg_attention: Dict[str, float]                  # {success: 62, failure: 38}
    avg_duration: Dict[str, float]                   # {success: 28.5, failure: 31.2}
    
    # 승리 공식 (winning formula)
    winning_formulas: List[str]     # ["myth_bust→sensory→spec릴레이→guarantee (80%)"]

class BenchmarkComparison(BaseModel):
    """벤치마크 대비 비교 결과 / Benchmark Comparison Result"""
    video_name: str
    category: str
    
    # 기준선 대비 포지션
    vs_success: Dict[str, str]      # {scroll_stop: "+12 (평균 이상)", cut_density: "-0.3 (평균 이하)"}
    vs_failure: Dict[str, str]
    
    # 판정
    position: str                   # "상위 20%" / "평균 수준" / "하위 30%"
    missing_elements: List[str]     # 성공 영상에는 있고 이 영상에는 없는 것
    excess_elements: List[str]      # 이 영상에만 있는 것 (차별점 or 불필요)
```

### 벤치마크 업데이트 로직
```python
def update_baseline(category: str, recipes: List[dict]):
    """등록된 영상들로 기준선 재계산"""
    success = [r for r in recipes if r['label'] == 'success']
    failure = [r for r in recipes if r['label'] == 'failure']
    
    baseline = CategoryBaseline(
        category=category,
        sample_count=len(recipes),
        success_count=len(success),
        failure_count=len(failure),
        success_avg=average_metrics(success),
        failure_avg=average_metrics(failure),
        top_appeal_types=count_appeal_frequency(success),
        winning_formulas=extract_winning_formulas(success),
        ...
    )
    save_baseline(category, baseline)
```

---

## 작업 7: 리포트 생성기 (Report Generator)

### 목표
분석 결과를 포맷팅된 리포트로 자동 출력.

### 새 파일: `src/report_generator.py`

### CLI
```bash
python main.py report output/s5/*/video_recipe.json --format markdown
python main.py report output/s5/*/video_recipe.json --format html
python main.py report output/s5/*/video_recipe.json --format telegram
```

### 리포트 구조

```
1. 스코어 카드 (4점수 + 한 줄 진단)
2. 설득 구조 (소구 레이어링 타임라인)
3. 집중도 곡선 (피크/골짜기 마킹)
4. 이탈 위험 구간 (개선 제안 포함)
5. 씬 카드 (주요 5-7개)
6. 아트 디렉션 요약
7. 퍼포먼스 지표
8. 강점 & 약점 & 개선 포인트
9. 템플릿 (이 구조를 내 제품에 적용하려면)
10. (있으면) 벤치마크 대비 포지션
```

### Markdown 생성 예시
```python
def generate_markdown(recipe: dict) -> str:
    sc = recipe['score_card']
    
    report = f"""# 📊 숏폼 분석 리포트 — {recipe.get('meta',{}).get('product_name','영상')}

## 🎯 스코어 카드

| 지표 | 점수 | 등급 |
|------|------|------|
| 후킹 지수 (Scroll-Stop) | {sc['scroll_stop_score']}/100 | {sc['scroll_stop_grade']} |
| 브랜드 존재감 (Brand Prominence) | {sc['brand_prominence']}/100 | {sc['brand_prominence_grade']} |
| 메시지 정합성 (Message Alignment) | {sc['message_alignment']}/100 | {sc['message_alignment_grade']} |
| CTA 도달률 (CTA Completion) | {sc['cta_completion']}/100 | {sc['cta_completion_grade']} |

**💡 {sc['one_line_diagnosis']}**

...
"""
    return report
```

---

## 작업 8: 템플릿 엔진 (Template Engine)

### 목표
성공 영상의 레시피에서 제품 특정 정보를 제거 → 재사용 가능한 템플릿 생성
→ 새 제품 정보 입력 시 제작 지시서 자동 생성

### 새 파일: `src/template_engine.py`

### CLI
```bash
# 레시피에서 템플릿 추출
python main.py template extract output/s5/*/video_recipe.json --name "food_review_30s"

# 템플릿에 새 제품 적용
python main.py template apply templates/food_review_30s.json --product "신라면" --appeals "sensory,specification,social_proof"
```

### 템플릿 스키마
```python
class SceneTemplate(BaseModel):
    """씬 템플릿 / Scene Template"""
    scene_id: int
    time_pct: Tuple[float, float]      # 0-100% (절대 시간 대신 비율)
    duration_pct: float
    role: str
    appeal_type: Optional[str]
    
    # 제작 지시 (제품 무관)
    shot_type: str
    camera_motion: str
    text_template: Optional[str]       # "{제품명}이 다 거기서 거기?"
    graphic_style: str
    attention_target: int              # 목표 집중도
    
    # 플레이스홀더
    placeholders: List[str]            # ["제품명", "스펙1", "가격"]

class StructureTemplate(BaseModel):
    """구조 템플릿 / Structure Template"""
    name: str
    category: str                      # food/beauty/electronics
    style: str                         # review/demo/comparison
    duration_range: Tuple[int, int]    # (25, 35) 초
    
    # 소구 순서 (핵심)
    appeal_sequence: List[str]         # [myth_bust, sensory, spec, social_proof, ...]
    
    # 씬 템플릿
    scenes: List[SceneTemplate]
    
    # 메타
    source_video: str                  # 원본 영상 정보
    success_score: int                 # 원본 overall_score
    
    # 사용법
    required_inputs: List[str]         # ["제품명", "카테고리", "핵심 스펙 3개", "가격"]
```

### 추출 로직
```python
def extract_template(recipe: dict, name: str) -> StructureTemplate:
    """레시피에서 제품 특정 정보를 제거하고 템플릿화"""
    
    total_dur = recipe['meta']['duration']
    scenes = recipe['scene_cards']
    
    template_scenes = []
    placeholders_all = set()
    
    for sc in scenes:
        # 시간을 비율로 변환
        start_pct = (sc['time_range'][0] / total_dur) * 100
        end_pct = (sc['time_range'][1] / total_dur) * 100
        
        # 텍스트에서 제품명 → 플레이스홀더
        text = sc.get('text_overlays', [{}])[0].get('text', '')
        placeholders = detect_placeholders(text, recipe['meta'])
        
        template_scenes.append(SceneTemplate(
            scene_id=sc['scene_id'],
            time_pct=(round(start_pct,1), round(end_pct,1)),
            duration_pct=round((end_pct - start_pct), 1),
            role=sc['role'],
            appeal_type=sc['appeal_points'][0]['type'] if sc['appeal_points'] else None,
            shot_type=sc['shot_type'],
            camera_motion=sc['camera_motion'],
            text_template=templatize_text(text, placeholders),
            graphic_style=sc['graphic_style'],
            attention_target=sc['attention_score'],
            placeholders=list(placeholders),
        ))
        placeholders_all.update(placeholders)
    
    return StructureTemplate(
        name=name,
        category=recipe['meta']['category'],
        style=recipe['persuasion_analysis']['video_style']['type'],
        appeal_sequence=[s.appeal_type for s in template_scenes if s.appeal_type],
        scenes=template_scenes,
        source_video=recipe['meta'].get('filename', ''),
        success_score=recipe['score_card']['overall_score'],
        required_inputs=sorted(placeholders_all),
    )
```

---

## 파일 변경 요약

| 파일 | 작업 | 내용 |
|------|------|------|
| **NEW** `src/score_card.py` | 4 | 4가지 스코어 + 한 줄 진단 |
| **NEW** `src/comparator.py` | 5 | N개 영상 비교 엔진 |
| **NEW** `src/benchmark_manager.py` | 6 | 카테고리별 벤치마크 DB |
| **NEW** `src/report_generator.py` | 7 | 리포트 자동 생성 (md/html/telegram) |
| **NEW** `src/template_engine.py` | 8 | 레시피→템플릿 추출/적용 |
| `schemas.py` | 4-8 | ScoreCard, ComparisonReport, CategoryBaseline, StructureTemplate 등 |
| `recipe_builder.py` | 4 | score_card 계산 호출 추가 |
| `main.py` | 5-8 | compare, benchmark, report, template 서브커맨드 |

## 실행 순서
1. 작업 4 (스코어 카드) — 개별 분석 완성
2. 작업 5 (비교 엔진) — A vs B 가능
3. 작업 7 (리포트 생성) — 출력 자동화
4. 작업 6 (벤치마크) — 데이터 축적 구조
5. 작업 8 (템플릿) — WakaShorts 연동 준비

## 테스트
- S5로 스코어카드 생성 → 4개 점수 합리성 확인
- S1 vs S2 (성공 vs 실패) 비교 리포트 → 차이점 자동 추출 확인
- S1,S3,S5 (성공 3개) → food 벤치마크 기준선 생성
- S5 레시피 → 템플릿 추출 → "신라면"으로 적용 → 제작 지시서 확인
