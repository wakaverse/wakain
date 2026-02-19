# Video Analyzer v2 — 고도화 로드맵

## 마케터가 우리 분석기술로 얻는 것

### 🎯 핵심 가치 정의

마케터는 전문가다. "훅이 있어야 한다"는 당연히 안다.
그들이 **못 하는 것, 시간이 걸리는 것, 감으로만 하던 것**을 데이터로 바꿔주는 게 가치.

---

### Value 1: 소구 레시피 해독 (Appeal Recipe Decoding)

**"이 영상이 왜 팔리는지, 설득 구조를 해부해준다"**

마케터가 경쟁사 잘 나가는 영상을 봐도 "좋네, 잘 만들었네" 수준.
우리는 이걸 해체한다:

```
① myth_bust (0s)  — "청소기가 다 거기서 거기?"  → 통념 파괴로 멈추게
② achievement (2s) — "진짜 청소기가 해줌"       → 결과 약속
③ sensory (4s)     — "착! 밀착, 쓱~ 빨아들이고"  → 감각 시연
④ spec×3 (6-12s)   — 듀얼모터/680g/LED          → 스펙 3연타
⑤ process×2 (14s)  — 원터치 먼지통/세워두기      → 편의성 시연
⑥ urgency (22s)    — 한정수량 초특가              → 긴급성
⑦ lifestyle (26s)  — "가볍지만 강력한"           → 브랜드 메시지
```

→ **이 순서가 왜 이 카테고리에서 작동하는지**까지 설명
→ 제작팀에 "이 순서대로, 이 소구로" 바로 지시 가능
→ 내 제품으로 치환하면 → **새 영상의 청사진**

**현재 상태:** ✅ 구현 완료 (persuasion_analysis + appeal_layering + scene mapping)
**고도화:** 카테고리별 소구 패턴 DB 축적 → "음식은 sensory 2회 반복이 핵심" 같은 인사이트

---

### Value 2: 정량 벤치마크 (Quantitative Benchmark)

**"감이 아니라 숫자로 내 영상의 위치를 안다"**

마케터: "이 영상 괜찮은 것 같은데..."
우리: "같은 카테고리 성공 영상 대비:"

```
                    내 영상    성공 평균    판정
씬 밀도              0.4/초    0.8/초     ❌ 절반 (컷이 느림)
소구 포인트            6개      11개      ❌ 부족 (설득력 약함)
첫 소구 등장          5.2초    1.8초     ❌ 늦음 (이탈 위험)
sensory 소구 횟수      0회      2회      ❌ 없음 (체험감 제로)
에너지 피크           0.45     0.78      ❌ 약함 (임팩트 부족)
CTA 시점             없음     24초      ❌ 전환 장치 없음
```

→ **어디가 얼마나 부족한지** 수치로 보임
→ "컷을 2배로 늘리고, sensory 2회 넣고, CTA 추가하세요"가 자동으로 도출

**현재 상태:** △ 개별 영상 수치는 있음, 벤치마크 기준선 없음
**필요:** 카테고리별 성공/실패 기준선 데이터 축적

---

### Value 3: 씬 단위 제작 지시서 (Scene-Level Production Brief)

**"분석 결과가 바로 제작 스펙이 된다"**

마케터가 편집자/디자이너에게 넘기는 기존 방식:
→ "레퍼런스 이거 참고해서 비슷한 느낌으로 만들어주세요"
→ 해석 차이 → 수정 3-4회 → 시간/비용 낭비

우리가 주는 것:
```
Scene 3 [4.0-6.5초] — sensory 소구
├── 역할: 감각 시연 (흡입력)
├── 샷: 클로즈업, 바닥 밀착 앵글
├── 액션: 청소기가 바닥의 먼지를 흡입하는 장면
├── 텍스트: "착! 밀착, 쓱~" / 고딕 노랑 #FFD700 / 중앙하단
├── 사운드: 흡입 효과음 + BGM 유지
├── 에너지: 0.68 (중상)
├── 컷 리듬: 하드컷, 0.8초 간격
└── 아트워크: 배경 화이트, 제품 중심, info_graphic 스타일
```

→ 편집자가 **해석할 필요 없이** 그대로 제작
→ 수정 횟수 최소화 → 제작 속도 2-3배

**현재 상태:** △ production_guide에 기본 정보 있음, 소구+아트워크 미통합
**고도화:** 소구 + 에너지 + 아트워크 + 트랜스크립트를 씬별 통합 카드로

---

### Value 4: 대량 비교 분석 (Batch Competitive Analysis)

**"경쟁사 50개 영상에서 승리 공식을 추출한다"**

사람이 못 하는 것:
- 경쟁사 영상 50개를 일관된 기준으로 분석
- 성공/실패 영상의 통계적 패턴 추출
- 카테고리 넘어선 범용 패턴 발견

```
[음식 카테고리 벤치마크 — 성공 영상 25개 분석]

필수 소구 패턴:
  1. sensory (시식/ASMR) — 100% 포함, 평균 2.3회
  2. specification — 92% 포함, 평균 2.8개
  3. origin/process — 84% 포함

필수 구조:
  - myth_bust 또는 emotional 훅: 88%
  - 첫 소구 2초 이내: 80%
  - problem_solution 구조: 76%

킬러 조합 TOP 3:
  1. myth_bust→sensory→spec릴레이→guarantee (전환율 +45%)
  2. emotional→ingredient릴레이→process→price (전환율 +32%)
  3. sensory→social_proof→spec→urgency (전환율 +28%)
```

→ "이 카테고리에서는 이 조합이 이긴다"
→ 감이 아니라 **데이터 기반 크리에이티브 전략**

**현재 상태:** ❌ 미구현 (10개 샘플로는 통계적 유의성 부족)
**필요:** 카테고리별 50개+ 영상, 전환 성과 라벨링

---

### Value 5: 이탈 구간 예측 (Drop-off Prediction)

**"시청자가 어디서 나가는지 초 단위로 안다"**

```
에너지 커브 + 정보 밀도 + 소구 매핑:

0━━━━5━━━━10━━━━15━━━━20━━━━25━━━━30
█████▓▓▓▓██████▓▓░░░░░████████████
hook  spec  demo    ⚠️GAP   urgency+CTA

⚠️ 15-20초 구간 위험:
  - 에너지 0.18 (최저)
  - 새 소구 없음 (5초간 공백)
  - 텍스트 없음
  → 예상 이탈률 상승 구간

💡 개선: 이 구간에 social_proof (리뷰/판매량) 삽입 권장
```

→ **유튜브 잔존율 그래프 없이도** 위험 구간 사전 예측
→ 편집 전에 구조적 약점 파악

**현재 상태:** △ 에너지 커브 + 시계열 분석 있음, 이탈 예측 로직 미구현
**고도화:** 에너지 × 정보 밀도 × 소구 간격 → 이탈 위험도 스코어

---

### Value 6: 아트 디렉션 복제 (Art Direction Cloning)

**"잘 되는 영상의 비주얼을 정확히 복제한다"**

마케터: "저 영상 느낌으로 만들어줘"
디자이너: "느낌이 뭔데요...?"

우리:
```
[S5 태풍김 — 아트 디렉션 스펙]
톤앤매너: bold_graphic (강렬한 정보형)
제목 폰트: 고딕 Bold
텍스트 컬러: #FFFFFF / #FFD700 (흰+금)
강조: 글자 확대 + 노란색 + 밑줄
배경: 따뜻한 톤, 공장/제품 실사
컬러 온도: warm
레이아웃: 텍스트 중앙하단, 고정정보 좌상단
반복 요소: 제품 패키지샷, 공장 컨베이어, 시식 클로즈업
```

→ 디자이너에게 **"느낌"이 아니라 "스펙"**으로 전달
→ 브랜드 일관성 유지하면서 양산 가능

**현재 상태:** ✅ 구현 완료 (3-level artwork: frame/scene/video)
**고도화:** 카테고리별 아트 디렉션 트렌드 분석

---

## 고도화 로드맵

### Phase 1: 씬 통합 카드 (1-2일)

**목표:** 6가지 Value를 씬 단위로 통합한 "완전한 씬 카드" 생성

현재 scene 데이터에 이미 있는 것:
- ✅ role, time_range, duration
- ✅ visual_summary (샷, 구도, 컬러, 모션)
- ✅ content_summary (피사체, 제품 가시성)
- ✅ energy (에너지 스코어)
- ✅ transcript_segments (대사)
- ✅ artwork (타이포, 그래픽, 레이아웃, 컬러)
- ✅ text_effects (텍스트 오버레이)
- ✅ appeal_points (소구 매핑)

부족한 것:
- ❌ production_guide와 통합 안 됨
- ❌ 소구+에너지+아트워크를 하나의 "제작 지시" 포맷으로 정리 안 됨

**산출물:**
```python
class SceneCard(BaseModel):
    """씬별 완전한 제작 지시서"""
    scene_id: int
    time_range: Tuple[float, float]
    duration: float
    
    # 역할 & 내러티브
    role: str                          # hook/demo/proof/cta...
    description: str                   # 한국어 씬 설명
    
    # 소구
    appeal_type: Optional[str]         # myth_bust/sensory/spec...
    appeal_description: Optional[str]  # 소구 내용
    appeal_visual_proof: Optional[str] # 시각적 증거 기법
    
    # 촬영 지시
    shot_type: str                     # closeup/medium/wide
    camera_motion: str                 # static/pan/zoom
    subject: str                       # product/person/text
    
    # 에너지 & 리듬
    energy_score: float                # 0-1
    energy_level: str                  # 정적/중/강/클라이막스
    cut_rhythm: str                    # "2 cuts, 0.8s/cut"
    transition: str                    # hard_cut/dissolve/fade
    
    # 텍스트 & 아트
    text_content: Optional[str]        # 표시할 텍스트
    text_style: Optional[str]          # "고딕 Bold #FFD700 중앙하단"
    color_palette: List[str]           # 씬 컬러
    graphic_style: str                 # photo_real/info_graphic
    
    # 오디오
    narration: Optional[str]           # 나레이션 스크립트
    sound_direction: str               # "BGM 유지 + 흡입 효과음"
```

**작업:** recipe_builder.py에서 기존 scenes + production_guide를 통합하는 로직

---

### Phase 2: 이탈 예측 엔진 (1-2일)

**목표:** 에너지 × 정보 밀도 × 소구 간격 → 구간별 이탈 위험도

```python
class DropOffRisk(BaseModel):
    time_range: Tuple[float, float]
    risk_score: float          # 0-1 (1=확실한 이탈)
    risk_factors: List[str]    # ["에너지 드랍", "소구 공백 4초", "텍스트 없음"]
    suggestion: str            # "social_proof 삽입 권장"

class DropOffAnalysis(BaseModel):
    risk_zones: List[DropOffRisk]
    safest_zone: Tuple[float, float]
    overall_retention_score: float  # 0-100
```

**로직 (비용 0, 로컬):**
- 에너지 0.2 미만 3초 이상 → 위험
- 소구 포인트 간격 5초 이상 → 위험
- 텍스트/나레이션 공백 4초 이상 → 위험
- 씬 전환 없이 3초 이상 → 위험
- 복합 시 risk_score 누적

**작업:** temporal_analyzer.py 또는 새 파일 dropoff_predictor.py

---

### Phase 3: 비교 엔진 (2-3일)

**목표:** N개 영상 recipe를 자동 비교하는 모듈

```python
class VideoComparison(BaseModel):
    videos: List[VideoSummary]  # 각 영상 핵심 수치
    
    # 정량 비교 테이블
    metrics_table: Dict[str, List]  # {씬밀도: [0.4, 0.8, 0.9], ...}
    
    # 공통 패턴
    common_success_patterns: List[str]  # 성공 영상끼리 공통점
    common_failure_patterns: List[str]  # 실패 영상끼리 공통점
    
    # 핵심 차이
    key_differentiators: List[str]      # 성공 vs 실패 결정적 차이
    
    # 소구 패턴 비교
    appeal_frequency: Dict[str, int]    # {sensory: 8, spec: 12, ...}
    winning_combinations: List[str]     # 자주 나오는 소구 조합
```

**작업:** 새 파일 comparator.py + main.py에 compare 서브커맨드

---

### Phase 4: 카테고리 벤치마크 DB (3-5일)

**목표:** 분석한 영상이 쌓일수록 벤치마크가 정밀해지는 구조

```
benchmark/
  food/
    success_baseline.json   # 성공 영상 평균 수치
    failure_baseline.json   # 실패 영상 평균 수치
    appeal_patterns.json    # 소구 패턴 통계
    art_trends.json         # 아트 디렉션 트렌드
  beauty/
    ...
  electronics/
    ...
```

**프로세스:**
```
영상 분석 완료
  → recipe에 성공/실패 라벨 + 카테고리 태깅
  → benchmark DB에 수치 추가
  → 기준선 자동 업데이트
  → 다음 영상 분석 시 "평균 대비" 자동 비교
```

**작업:** benchmark_manager.py + Supabase 또는 로컬 JSON

---

### Phase 5: 리포트 생성기 (2-3일)

**목표:** 텔레그램 보고서 포맷을 자동 생성

현재: 브릿지가 수동으로 정리해서 보냄
목표: `python main.py report s5` → 포맷팅된 리포트 자동 출력

```
python main.py report sample5 --format telegram
python main.py report sample5 --format markdown
python main.py report sample5 --format html
python main.py compare sample1 sample3 sample5 --label success
```

**작업:** report_generator.py

---

### Phase 6: 템플릿 엔진 (3-5일)

**목표:** 성공 영상 레시피 → 재사용 가능한 템플릿 → 새 제품 적용

```
1. 레시피 추상화
   S5(태풍김) 레시피에서 제품 특정 정보 제거
   → "음식×리뷰형 30초 템플릿"

2. 템플릿 구조
   Scene 1: [HOOK] myth_bust — "{제품 카테고리}가 다 거기서 거기?"
   Scene 2: [DEMO] sensory — {제품}을 먹는/쓰는 클로즈업
   Scene 3: [SPEC] specification×3 — {스펙1}/{스펙2}/{스펙3}
   ...

3. 새 제품 적용
   템플릿 + 새 제품 정보 입력
   → WakaShorts에 넘길 제작 지시서 자동 생성
```

**작업:** template_engine.py

---

## 일정 요약

| Phase | 기능 | 기간 | 가치 |
|-------|------|------|------|
| **1** | 씬 통합 카드 | 1-2일 | Value 1,3 완성 |
| **2** | 이탈 예측 | 1-2일 | Value 5 신규 |
| **3** | 비교 엔진 | 2-3일 | Value 4 기초 |
| **4** | 벤치마크 DB | 3-5일 | Value 2,4 완성 |
| **5** | 리포트 생성 | 2-3일 | 서비스화 기반 |
| **6** | 템플릿 엔진 | 3-5일 | WakaShorts 연동 |

**총 예상: 12-20일 (1인 개발 기준)**

Phase 1-2 완료 시: 개별 영상 분석의 완성도 최고 수준
Phase 3-4 완료 시: 대량 분석 + 벤치마크 → 유료 서비스 가치
Phase 5-6 완료 시: 자동화 + WakaShorts 연동 → 크랩스 핵심 파이프라인

---

## 경쟁 포지셔닝

```
ATOMOS: "이 영상 잘 만들었어?" → 체크리스트 합격/불합격
        (QC 도구)

우리:   "이 영상이 왜 팔려? 어떻게 복제해?" → 레시피+벤치마크+제작지시
        (전략 도구 + 제작 자동화)
```

체크리스트는 **주니어가 시니어 없이도 기본 품질을 맞추는 도구**.
우리는 **시니어가 데이터로 더 날카로운 전략을 세우는 도구**.

타겟이 다르고, 우리가 더 높은 가치를 제공한다.

---

*마지막 업데이트: 2026-02-19*
