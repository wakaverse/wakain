# TASK: 분석 파이프라인 + 프론트엔드 업그레이드

## 참고 문서
- `SPEC_WAKALAB_v4.md` — 전체 스펙 (반드시 먼저 읽을 것)
- `docs/SHORTS_SCRIPT_7STEP.md` — 7요소 프레임워크 상세

## 목표
분석 결과를 "추상 라벨"에서 "구체적이고 재현 가능한 레시피"로 업그레이드.

---

## Phase 1: 백엔드 — 분석 파이프라인 업그레이드

### 1-1. video_analyzer.py 프롬프트 수정 (Phase 4)

현재 `analyzer/src/video_analyzer.py`의 Gemini 프롬프트를 수정하여, 기존 분석에 **공통 레이어 + 7요소 심화**를 추가.

#### 공통 레이어 (모든 영상에 추가)
`persuasion_analysis` 안에 새 필드 추가:

```json
"script_analysis": {
  "hook": {
    "text": "김이 다 거기서 거기라고요?",
    "time_range": [0, 2.3],
    "pattern": "직접경험감탄",
    "direct_experience": true
  },
  "appeals": [
    {
      "element": "authority",
      "used": true,
      "subtype": "경력연차형",
      "text": "발효 전문가",
      "time_range": [0, 3]
    },
    {
      "element": "sensory_description",
      "used": true,
      "subtype": "미각+촉각",
      "senses": ["taste", "touch"],
      "onomatopoeia": ["바삭", "사르르"],
      "contrast_structure": true,
      "text": "겉은 바삭하면서 속은...",
      "time_range": [5, 10]
    },
    {
      "element": "simplicity",
      "used": true,
      "subtype": "숫자형",
      "text": "4가지 맛만 고르면",
      "time_range": [10, 12]
    },
    {
      "element": "social_proof",
      "used": true,
      "subtype": "실적형",
      "extreme_premise": false,
      "voluntary_action": false,
      "text": "일본 24개국 18000매장",
      "time_range": [18, 22]
    }
  ],
  "cta": {
    "type": "보증형",
    "text": "맛 없으면 보장",
    "keyword": null,
    "time_range": [25, 28]
  },
  "flow_order": ["authority", "hook", "sensory_description", "simplicity", "process", "social_proof", "cta"],
  "elements_used": 7,
  "elements_total": 7,
  "advanced_techniques": {
    "reversal_structure": false,
    "connecting_endings": true,
    "info_overload": false,
    "target_consistency": true
  },
  "video_style": "talking_head_commerce"
}
```

#### 프롬프트에 추가할 지시:
기존 프롬프트 마지막에 `script_analysis` 섹션 추가. 7요소 정의를 프롬프트에 포함:

```
## Script Analysis (대본 분석)

Analyze the script/narration using the 7-element framework for shopping shortform:

Elements to detect (check which are present):
1. Authority (권위 부여): Who speaks and what credibility device?
   - Subtypes: professional_job, career_years, picky_taste, celebrity_ref, backstory, life_veteran
2. Hook (감탄 훅): First 3 seconds — direct experience emotion/action?
   - Must be first-person experience, NOT indirect ("해외에서 난리" = bad)
3. Sensory Description (상황 묘사): Which senses? Onomatopoeia? Contrast structure?
   - Senses: visual, tactile, taste, smell, auditory
4. Simplicity (간편함 어필): How is the barrier lowered?
   - Patterns: number_limit ("3가지만"), one_step, time_limit, empathy
5. Process (과정 묘사): Showing the making/using? (optional, skip if overlaps with 3)
6. Social Proof (사회적 증거): Others' reactions or personal change?
   - Extreme premise ("안 먹던", "안 쓰던")? Voluntary action?
   - WARNING: Direct health/weight claims = false advertising risk
7. CTA (행동 유도): Comment-inducing? Link? Purchase?

Also detect advanced techniques:
- Reversal structure (걱정→해소)
- Connecting endings (~는데, ~해서 flow without periods)
- Info overload (3+ functional specs = too many)
- Target consistency (single target throughout)

Output flow_order as the actual sequence found in the video.
Output video_style from: talking_head_commerce, brand_ad, product_demo, caption_text, asmr, comparison, other
```

#### JSON 스키마에 추가:
`video_analysis.py`의 response_schema에 `script_analysis` 객체를 추가. 위 구조에 맞게.

### 1-2. DB 스키마
- `results` 테이블에는 이미 `video_recipe_json`에 포함되므로 별도 컬럼 불필요
- `script_analysis`는 recipe의 일부로 저장됨

### 1-3. 테스트
수정 후 샘플 영상으로 로컬 테스트:
```bash
cd analyzer && python -m src.integrated_analyzer --video ../backend/output/sample_video.mp4
```
또는 기존 샘플 디렉토리 활용.

---

## Phase 2: 프론트엔드 — 해킹 결과 페이지 리뉴얼

### 2-1. ReportPage.tsx 전면 리뉴얼

SPEC v4의 "6-2. 해킹" 섹션 참고. 구조:

```
[영상 플레이어]
제품명 · 카테고리 · @크리에이터
사용 요소: ①권위 ②훅 ③묘사 ⑥증거 ⑦CTA (5/7)
배치: 권위→훅→묘사→증거→CTA

[해킹 결과 탭] [컷 뷰 탭]

── 해킹 결과 탭 ──

📝 대본 해부
  ① 권위 ✓
  경력연차형 — "김 발효 전문가"
  "김이 다 거기서 거기라고요?"

  ② 훅 ✓
  직접경험감탄
  "한 입 드셔보시면 바로 아실 겁니다"
  
  ... (사용된 요소만)

🎬 영상 구조
  편집: 평균 2.3초/컷 · 12컷 · 감속 패턴
  제품 노출: 80% · 첫 등장 0초
  강조 기법: 클로즈업 · 패키지 · 시연 · 질감
  사람: 내레이터 · 얼굴 노출

레시피
  권위→훅→묘사→간편→과정→증거→CTA
  [대본 생성] [소재 확장] [비교에 추가] [복사]
```

### 2-2. 기존 컴포넌트 정리
- `ScoreCardSection` → 삭제 (이전 태스크에서 만든 것)
- `KeyInsightsSection` → 삭제
- `VideoStructureSummary` → 삭제 (방금 만든 것)
- 기존 "한줄 요약", "훅 분석", "영상 리듬감", "설득 구조", "내 제품에 적용" 카드들 → 새 구조로 교체

### 2-3. 새 컴포넌트
- `ScriptBreakdown.tsx` — 📝 대본 해부 (7요소)
- `VideoStructure.tsx` — 🎬 영상 구조
- `RecipeCard.tsx` — 레시피 + 액션 버튼
- `CutView.tsx` — 컷 뷰 탭 (타임라인형)

### 2-4. 데이터 매핑
`script_analysis`가 없는 기존 결과 → 기존 `persuasion_analysis`에서 최대한 매핑:
- `appeal_points[].type` → 7요소 중 매칭되는 것 표시
- `presenter` → ① 권위
- `product_emphasis` → 영상 구조
- 완벽하지 않아도 됨, "데이터 없음" 표시 가능

### 2-5. 디자인
- Apple 미니멀, #fafafa 배경
- 카드 세로 나열, 모바일 퍼스트
- **판정 배제** — 점수/등급/색상 판정 절대 금지
- 소구 유형은 pill 태그 (연한 회색 배경)
- 요소 사용 여부는 ✓ / 미사용은 표시 안 함 (빠진 것을 부각하지 않음)

---

## 작업 순서
1. SPEC_WAKALAB_v4.md 읽기
2. docs/SHORTS_SCRIPT_7STEP.md 읽기
3. 현재 video_analyzer.py 프롬프트 구조 파악
4. Phase 1 (백엔드) 수정
5. Phase 2 (프론트엔드) 수정
6. `npm run build` 성공 확인
7. git commit (배포 금지)

## 주의사항
- **배포하지 말 것** — 커밋까지만
- 기존 분석 결과가 깨지지 않게 backward compatible 유지
- `script_analysis`가 없는 경우의 fallback 처리 필수
- 빌드 에러 없이 완료
