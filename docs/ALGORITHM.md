# WakaLab 분석 알고리즘 상세

> 각 Phase별 알고리즘, 설계 의도, 프롬프트 전문

---

## 전체 파이프라인 개요

```
영상 입력 (mp4, 최대 480p 리사이즈)
    │
    ├── Phase 0: STT (음성→텍스트)         Soniox API
    ├── Phase 0.1: 제품 스캔               Gemini Flash Lite
    │
    ├── Phase 1: 프레임 정량 분석           OpenCV (로컬)
    ├── Phase 2: 프레임 정성 분석           Gemini Flash Lite (배치)
    ├── Phase 2.5: 시간축 분석              로컬 계산
    ├── Phase 3: 씬 집계                    로컬 계산
    │
    ├── Phase 4: 영상 전체 분석 (5개 병렬)   Gemini Flash
    │   ├── 4a: 메인 분석 (구조/오디오/제품전략)
    │   ├── 4b: 아트 디렉션
    │   ├── 4c: 인게이지먼트
    │   ├── 4d: 7요소 분석
    │   └── 4e: α 기법 분석
    │
    ├── Phase 5: 씬 병합                    로컬 계산
    ├── Phase 6: 레시피 빌드                로컬 계산
    └── Phase 7: 통합 진단 + 처방            Gemini (일부)
```

**총 Gemini API 호출: ~8회 | 총 소요: ~12분 (Phase 4가 90%)**

---

## Phase 0: STT (음성→텍스트)

### 알고리즘
1. 영상에서 오디오 트랙 추출 (FFmpeg)
2. Soniox API로 한국어 음성 인식
3. 나레이션 타입 판별 (voice / tts / none)

### 설계 의도
- STT를 먼저 추출해서 Phase 4에서 Gemini에게 "참고용 대본"으로 제공
- Gemini가 영상 오디오를 직접 듣기도 하지만, STT 텍스트를 함께 주면 정확도 향상
- Soniox 선택 이유: 한국어 정확도 높음, 타임스탬프 제공

### 출력
```json
{
  "narration_type": "voice",     // voice | tts | none
  "segments": [
    {"start": 0.5, "end": 2.1, "text": "이거 진짜 대박인데"}
  ],
  "total_speech_sec": 31.7,
  "full_text": "이거 진짜 대박인데 통영 산지직송 생굴이..."
}
```

---

## Phase 0.1: 제품 스캔

### 알고리즘
1. 영상 파일을 Gemini에 업로드
2. "이 영상에서 무엇을 팔고 있나?" 질문
3. 카테고리 + 제품명 + 브랜드 추출

### 설계 의도
- 카테고리를 먼저 파악해야 Phase 4에서 카테고리별 특화 분석 가능
- 예: 식품 → 맛 묘사 중심 / 전자기기 → 스펙 중심

### 프롬프트
```
1. Product: What is being sold?
   - category: food/beauty/fashion/electronics/living/health/service/general
   - name: product name as shown/spoken (Korean preferred), null if unclear
   - brand: brand name if visible/mentioned, null if unclear
   - multi_product: true if multiple products featured

2. Quality Gate: Is this a marketing/commerce video?
   - is_marketing_video: true/false

3. Response (JSON only):
{
  "product": {"category": "...", "name": "...", "brand": "...", "multi_product": false},
  "is_marketing_video": true,
  "category_confidence": 0.0-1.0,
  "reasoning": "1 sentence in Korean"
}
```

### 모델: `gemini-2.5-flash-lite`

---

## Phase 1: 프레임 정량 분석 (OpenCV)

### 알고리즘
1. 영상에서 2fps로 프레임 추출 (Phase 0+)
2. 각 프레임에 대해 OpenCV로 수치 측정:

| 측정값 | 알고리즘 | 용도 |
|--------|---------|------|
| brightness | HSV V채널 평균 | 밝기 변화 감지 |
| saturation | HSV S채널 평균 | 색 선명도 |
| contrast | 표준편차 기반 | 대비 측정 |
| edge_diff | Sobel 엣지 → 16×16 그리드 → L1 거리 | 컷 감지, 시각 변화량 |
| color_diff | RGB 히스토그램 64-bin × 3ch 거리 | 색상 변화 감지 |
| dominant_colors | K-means (k=5) 클러스터링 | 주요 색상 추출 |
| text_region | 모폴로지 그래디언트 → 텍스트 영역 % | 텍스트 존재 감지 |
| face_detection | OpenCV CascadeClassifier | 얼굴 유무 |
| skin_tone | HSV 범위 필터링 → 비율 | 사람 존재 추정 |

### 설계 의도
- API 호출 없이 로컬에서 빠르게 (~5초) 기초 데이터 추출
- edge_diff + color_diff = 프레임 간 변화량 → 컷 감지 + 에너지 측정의 기반
- Phase 2.5 시간축 분석의 원본 데이터

### 핵심 수식
```python
# edge_diff: Sobel 엣지를 16×16 그리드로 나눠 이전 프레임과 L1 거리
edge_grid = sobel_magnitude → resize(16,16) → mean per cell
edge_diff = L1_distance(grid_current, grid_previous)

# color_diff: RGB 히스토그램 거리
hist_r, hist_g, hist_b = 64-bin histograms
color_diff = (dist(r) + dist(g) + dist(b)) / 3  # correlation distance
```

---

## Phase 2: 프레임 정성 분석 (Gemini Flash Lite)

### 알고리즘
1. 프레임을 5장씩 배치로 묶어 Gemini에 전송
2. 각 프레임의 시각적 의미 해석 (JSON 배열로 반환)
3. 재시도 로직: 5회까지 exponential backoff

### 설계 의도
- Phase 1은 "숫자", Phase 2는 "의미"
- 사람이 프레임을 보고 파악하는 것과 같은 정보 추출
- 배치 처리로 API 호출 최소화 (74장 → ~15회 호출)

### 프롬프트 (System Instruction)
```
You are a shortform marketing video analyst. You analyse individual frames
to extract structured visual metadata for building a video recipe.

You will receive MULTIPLE frames in a single request.
Analyse EACH frame independently and return a JSON array.

Be precise with shot_type classification:
  - closeup: main subject occupies >60% of frame
  - medium: 30-60%
  - wide: <30%
  - overhead: camera looks down from above
  - pov: first-person perspective
  - split_screen: frame is visually divided into panels

For text_overlay: set to null if no text is visible.
  Detect: font_color, outline, shadow, background_box, font_size.
For product_presentation: if no product visible, use visibility="hidden".
For human_element: if no person visible, use role="none".

For artwork analysis:
- typography: font family (gothic/rounded/serif/handwritten/display/monospace),
  weight, color, highlight technique (color_change/size_increase/underline/
  box_highlight/glow/bold_keyword)
- graphic_elements: icon/sticker/emoji/arrow/circle_highlight/underline/
  box_border/gradient_overlay/pattern_bg/logo/badge/watermark
- layout_zones: top/middle/bottom → text/product/person/graphic/empty/mixed
- color_design: primary_color, accent_color, contrast level, harmony type
```

### 모델: `gemini-2.5-flash-lite`
### 출력 (프레임 1개당)
```json
{
  "timestamp": 2.5,
  "shot_type": "closeup",
  "subject_type": "product",
  "composition": {"layout": "center", "visual_weight": "center", "depth": "flat"},
  "text_overlay": {"content": "초특가!", "font_color": "#FF0000", "font_size": "large"},
  "product_presentation": {"visibility": "prominent", "angle": "front", "context": "in_use"},
  "human_element": {"role": "presenter", "emotion": "excited", "eye_contact": true},
  "color_mood": "bold_contrast",
  "attention_element": "product closeup",
  "artwork": {
    "typography": {"family": "gothic", "weight": "bold", "highlight": "color_change"},
    "graphic_elements": ["emoji", "arrow"],
    "layout_zones": {"top": "text", "middle": "product", "bottom": "text"},
    "color_design": {"primary_color": "#FF6B35", "text_bg_contrast": "high"}
  }
}
```

---

## Phase 2.5: 시간축 분석 (로컬)

### 알고리즘

**Attention Curve (시각 에너지 곡선):**
```python
score = edge_norm × 0.4 + color_norm × 0.4 + bright_norm × 0.2

# 정규화:
edge_norm = min(edge_diff / 60.0, 1.0)     # 60 = high threshold
color_norm = min(color_diff / 1.5, 1.0)     # 1.5 = high threshold
bright_norm = min(|brightness_delta| / 0.3, 1.0)

# 0~100 스케일
score = int(score × 100)
```

**Attention Arc 분류:**
```python
if std(scores) < 10: arc = "flat"
elif mid_peak > first_quarter and mid_peak > last_quarter: arc = "building→peak→fade"
elif first_half_avg > second_half_avg: arc = "fading"
elif second_half_avg > first_half_avg: arc = "building"
elif avg > 45: arc = "sustained_high"
elif avg < 20: arc = "sustained_low"
```

**Cut Rhythm (컷 리듬):**
```python
# 컷 감지: SceneDetect 또는 edge_diff > 40 폴백
# 3초 슬라이딩 윈도우 내 컷 수 = cut_density
for t in range(0, duration, 1):
    cuts_in_window = count(cuts between t and t+3)
    density_timeline.append({"t": t, "cuts_per_3s": cuts_in_window})

# 리듬 패턴 분류
if std(intervals) < mean × 0.3: pattern = "regular"
elif intervals trending down: pattern = "accelerating"
elif intervals trending up: pattern = "decelerating"
else: pattern = "irregular"
```

### 설계 의도
- API 호출 없이 Phase 1 데이터만으로 시간축 패턴 추출
- 시각 에너지 곡선 = "영상이 얼마나 역동적인가"의 시계열
- 잘 만든 영상은 에너지가 리드미컬하게 반복됨 (실험적 관찰)

---

## Phase 3: 씬 집계 (로컬)

### 알고리즘
1. SceneDetect (PySceneDetect) 컷 경계 기준으로 프레임 그룹핑
2. 씬별 시각 요약 계산 (평균 밝기, 채도, 주요 색상)
3. 씬별 콘텐츠 요약 계산 (주요 샷타입, 피사체, 텍스트)
4. 씬별 어텐션 통계 계산 (Phase 2.5 데이터 활용)
5. 씬별 아트워크 요약

### 설계 의도
- 프레임 단위 (74장) → 씬 단위 (8~12개)로 압축
- Phase 4에서 Gemini가 파악한 씬 구조와 매칭하기 위한 기반

---

## Phase 4: 영상 전체 분석 (Gemini Flash, 핵심)

### 아키텍처
- 영상 파일을 Gemini File API로 업로드 (최대 20MB, 초과 시 리사이즈)
- **5개 분석을 asyncio.gather로 병렬 실행** (동일 영상 파일 공유)
- 각 분석은 독립 스키마 + 독립 프롬프트
- 모든 호출: temperature=0.1, response_mime_type="application/json"

```python
results = await asyncio.gather(
    _do_4a(),  # 메인 분석
    _do_4b(),  # 아트 디렉션
    _do_4c(),  # 인게이지먼트
    _do_4d(),  # 7요소
    _do_4e(),  # α 기법
)
```

### 왜 5개로 나눴나?
- **Gemini 스키마 복잡도 제한**: 하나의 response_schema가 너무 크면 Gemini가 null을 반환
- script_analysis를 persuasion_analysis 안에 넣었다가 전체가 null 된 사고 발생 (2026-03-05)
- 해결: 각 분석을 독립 호출로 분리 → 안정성 확보

### 공통 System Instruction
모든 4a~4e에 동일 System Instruction 적용:
```
You are a shortform marketing video analyst specialising in Korean commerce ads.
Analyse the uploaded video holistically — audio, structure, product strategy,
and effectiveness. Respond with valid JSON matching the requested schema exactly.
```

### 트랙별 보조 프롬프트
영상에 나레이션이 있으면 STT 결과를 추가 컨텍스트로 제공:
```
## 분석 트랙: VOICE (내레이션 기반)
이 영상에는 음성 내레이션이 있습니다. 아래 STT 결과를 참고하여 분석하세요.
[STT 세그먼트 텍스트]
```

---

### Phase 4a: 메인 분석

**추출 정보:**
1. meta (플랫폼/카테고리/타겟)
2. structure (내러티브 타입, 씬 시퀀스, 훅/제품등장/CTA 타이밍)
3. audio (음악 장르/BPM/에너지, 보이스 톤, SFX, 싱크)
4. product_strategy (등장/시연/가격/소셜프루프/긴급성)
5. effectiveness_assessment (훅/플로우/CTA 평가)
6. persuasion_analysis (소구 포인트 전체 추출)

**소구 분석 핵심 규칙:**
```
⚠️ "both"를 사용하지 마세요!
같은 시점이라도 대본 소구(source=script)와 비주얼 소구(source=visual)를
별도 항목으로 분리하세요.

예: 나레이션 "이거 좋아요" + 화면 제품 클로즈업
→ {source: "script", type: "emotional", claim: "나레이션 기반"}
→ {source: "visual", type: "feature_demo", claim: "클로즈업 기반"}
두 개 별도 항목!

모든 컷에 최소 1개의 visual 소구가 있어야 합니다.
30초 영상 → 10~20개 이상 소구 포인트.
```

**모델:** `gemini-2.5-flash`
**스키마:** `_RESPONSE_SCHEMA` (~400줄)

---

### Phase 4b: 아트 디렉션

**추출 정보:**
- 타이포 시스템 (heading/body 폰트, 색상, 강조 기법)
- 색상 시스템 (브랜드 컬러, 배경, 색온도)
- 그래픽 아이덴티티 (스타일, 반복 요소)
- 레이아웃 시스템 (텍스트 위치, 프레임 구도)
- 스타일 레퍼런스 ("쿠팡 라이브 스타일" 등)

**프롬프트:**
```
Analyse the visual identity and art direction of this shortform marketing video.
Focus on typography, color system, graphic elements, and layout patterns.
Phase 2 frame analysis data (실측):
[프레임별 artwork 데이터를 텍스트로 주입]
```

**설계 의도:** Phase 2 프레임 데이터를 "실측 데이터"로 제공하여 Gemini의 추측을 줄임

**모델:** `gemini-2.5-flash`
**스키마:** `_ART_DIRECTION_SCHEMA`

---

### Phase 4c: 인게이지먼트

**추출 정보:**
1. empathy_triggers (공감 트리거 리스트)
2. narrative_analysis (내러티브 패턴, 텐션 아크, 호기심 갭)
3. retention_analysis (훅 강도, 이탈 위험, 재시청/공유/댓글 트리거)
4. dropoff_analysis (이탈 위험 구간, 안전 구간)

**프롬프트:**
```
Analyse this shortform marketing video's engagement factors.
Focus on empathy triggers, narrative structure, and retention.
Identify specific timestamps for drop-off risks and engagement peaks.
```

**모델:** `gemini-2.5-flash`
**스키마:** `_ENGAGEMENT_SCHEMA`

---

### Phase 4d: 7요소 분석 (대본 해부)

**7요소 프레임워크:**
```
① authority (권위 부여) — 전문직/경력/셀럽추천/까다로운입맛
② hook (감탄 훅) — 첫 3초, 직접 경험 감정 (추측 아닌 체험)
③ sensory_description (상황 묘사) — 오감 자극 (시각/촉각/미각/후각/청각)
④ simplicity (간편함 어필) — 진입장벽 낮추기 (숫자제한/원스텝/시간제한/공감)
⑤ process (과정 묘사) — 만들기/사용 과정 보여주기 (선택)
⑥ social_proof (사회적 증거) — 타인 반응, 개인 변화
⑦ cta (행동 유도) — 댓글유도/공감참여/보증형/링크형
```

**프롬프트 핵심:**
```
Detect which of the 7 elements are present and in what order.

For hook: extract the actual first-3-second sentence and classify its pattern.
  - Must be first-person experience, NOT indirect ("해외에서 난리" = bad hook)
  - Patterns: 직접경험감탄, 행동변화형, 극적반응형, 사람반응형

For each element: set used=true only if clearly present.
Include the actual text from the video.

flow_order: actual sequence of elements found
(e.g. ["authority","hook","sensory_description","simplicity","social_proof","cta"])

Also detect advanced techniques:
- reversal_structure (반전 구조): 걱정→해소
- connecting_endings (연결어미): ~는데, ~해서
- info_overload (정보 과밀): 3+ specs in quick succession
- target_consistency (타깃 일관성)
```

**설계 의도:**
- 7요소 = "재료" → 어떤 설득 도구가 사용됐나
- flow_order = "레시피" → 어떤 순서로 배치됐나
- 같은 7요소도 배치 순서에 따라 효과가 다름

**모델:** `gemini-2.5-flash`
**스키마:** `_SCRIPT_ANALYSIS_SCHEMA`

---

### Phase 4e: α 기법 분석 (대본 기술)

**7요소가 "무엇을 말하나"(What)라면, α는 "어떻게 말하나"(How)**

**3개 레이어:**

| 레이어 | 기법 수 | 역할 |
|--------|---------|------|
| 감정 (emotion) | 8종 | 시청자 감정 자극 |
| 구조 (structure) | 8종 | 정보 배치 방식 |
| 연결 (connection) | 5종 | 문장 간 전환 |

**프롬프트 핵심:**
```
Focus on HOW the script delivers its message, not WHAT it says.

1. utterances: Break the script into individual sentences.
   For each:
   - text: exact words spoken
   - time_range: [start_sec, end_sec]
   - element: which 7-element it belongs to
   - emotion_layer: empathy/fomo/anticipation/relief/curiosity/pride/nostalgia/frustration
   - structure_layer: reversal/contrast/repetition/info_density/escalation/before_after/problem_solution/story_arc
   - connection_layer: bridge_sentence/rhythm_shift/callback/question_answer/pause_emphasis

2. emotion_techniques: All emotion techniques with time ranges
   - empathy: "이런 적 있으시죠?" shared experience
   - fomo: fear of missing out, urgency
   - anticipation: building curiosity
   - relief: resolving tension
   - curiosity: "I need to know"
   - pride: feeling smart/special
   - nostalgia: triggering memories
   - frustration: identifying pain points

3. structure_techniques: All structural techniques
   - reversal: flipping expectations ("근데 이 가격이요...")
   - contrast: A vs B comparison
   - repetition: "바삭, 더 바삭, 바삭바삭"
   - info_density: many claims in short time
   - escalation: building intensity
   - before_after: transformation
   - problem_solution: pain → product
   - story_arc: beginning/middle/end

4. connection_techniques: All transition techniques
   - bridge_sentence: "그래서", "근데 더 놀라운 건"
   - rhythm_shift: sudden pace change
   - callback: referencing earlier content
   - question_answer: rhetorical Q&A
   - pause_emphasis: strategic pause
```

**설계 의도:**
- 같은 7요소를 사용해도 α 기법이 다르면 완전히 다른 영상이 됨
- 예: "간편함 어필" + "공감(empathy)" vs "간편함 어필" + "대조(contrast)" → 느낌 다름
- 발화별 주석(utterances)이 핵심 — 대사 하나하나에 어떤 기법이 쓰였는지 태깅

**모델:** `gemini-2.5-flash`
**스키마:** `_SCRIPT_ALPHA_SCHEMA`

---

## Phase 5: 씬 병합 (로컬)

### 알고리즘
1. Phase 3 (로컬 씬 데이터) + Phase 4a (Gemini 씬 인식) 매칭
2. Gemini가 파악한 씬 역할(hook/demo/cta)을 로컬 씬에 부여
3. 시간축 기반 매칭 (Gemini scene_sequence ↔ Phase 3 scene_boundaries)

### 설계 의도
- 로컬 데이터 (정확한 수치) + Gemini 데이터 (의미 해석) 결합
- 씬별로 "밝기 142, 채도 85, 역할 hook, 기법 emotional_hook" 통합 정보

---

## Phase 6: 레시피 빌드 (로컬)

### 알고리즘
1. Track 1 데이터 (Phase 1+2+3 프레임 기반) 집계
2. Track 2 데이터 (Phase 4 Gemini 영상 기반) 통합
3. temporal, engagement, script, alpha 데이터 주입
4. video_recipe JSON 완성

### 설계 의도
- 모든 분석 결과를 하나의 JSON으로 조립
- 이 JSON이 프론트엔드 리포트의 유일한 데이터 소스
- "레시피" = 이 영상을 다시 만들 수 있는 모든 정보

### 주입 데이터
```python
for key in ("empathy_triggers", "narrative_analysis", 
            "retention_analysis", "script_analysis", "script_alpha"):
    if key in video_analysis:
        recipe_dict[key] = video_analysis[key]
```

---

## Phase 7: 통합 진단 + 처방

### 알고리즘
1. **7a 캡션 매핑**: Phase 2 프레임 데이터에서 텍스트 오버레이 타임라인 구축
2. **7b 3축 진단**: 소구축/영상축/대본축 각각의 구조 분석
3. **7c 처방 생성**: 카테고리별 프로필 기반 개선 제안
4. **7d 마케터 심판**: Gemini로 종합 평가 (verdict)

### 설계 의도
- Phase 6까지 = "이 영상에 뭐가 있나" (분석)
- Phase 7 = "이 영상을 어떻게 개선하나" (진단+처방)
- ⚠️ 현재 프론트에서 비표시 (판정 배제 원칙)
- 향후 온톨로지/지식그래프 피딩용으로 데이터 생성 유지

### 7c 처방 로직
```python
# 카테고리별 프로필 (예: 식품)
profile = get_category_profile("food")
# → 식품은 맛 묘사(sensory)가 중요, 과정(process) 선택적

# 레시피 vs 프로필 비교 → 처방 생성
prescriptions = generate_prescriptions(recipe, profile, diagnosis)
# → "훅이 약함: FOMO 추가 추천" 등
```

---

## 모델 사용 정리

| Phase | 모델 | 호출 수 | 용도 |
|-------|------|---------|------|
| 0 | Soniox API | 1 | STT |
| 0.1 | gemini-2.5-flash-lite | 1 | 제품 스캔 |
| 1 | OpenCV (로컬) | 0 | 수치 측정 |
| 2 | gemini-2.5-flash-lite | ~15 (배치) | 프레임 해석 |
| 2.5 | 로컬 | 0 | 시간축 |
| 3 | 로컬 | 0 | 씬 집계 |
| 4a | gemini-2.5-flash | 1 | 메인 분석 |
| 4b | gemini-2.5-flash | 1 | 아트 디렉션 |
| 4c | gemini-2.5-flash | 1 | 인게이지먼트 |
| 4d | gemini-2.5-flash | 1 | 7요소 |
| 4e | gemini-2.5-flash | 1 | α 기법 |
| 5 | 로컬 | 0 | 병합 |
| 6 | 로컬 | 0 | 레시피 조립 |
| 7d | gemini-2.5-flash | 1 | 마케터 심판 |

---

## 설계 원칙

1. **로컬 우선**: API 없이 할 수 있는 건 로컬에서 (비용 절감 + 속도)
2. **병렬 실행**: Phase 4 5개 호출을 동시에 (12분 → 5분 수준)
3. **스키마 분리**: Gemini 스키마 복잡도 제한 회피
4. **판정 배제**: 점수/등급 없음 — 구조만 보여주고 사용자가 판단
5. **구체적 텍스트**: "시연형 훅" 같은 추상 라벨 ❌ → 실제 대사 + 시간 ✅
6. **2축 분석**: 대본(WHY BUY) × 영상(WATCH) — 같은 대본도 영상이 다르면 다른 효과
7. **7+α 분리**: 7요소(What) + α(How) — 같은 재료도 조리법이 다르면 다른 맛
