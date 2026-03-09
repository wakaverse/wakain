# R11: 리포트 평가 엔진 + UI 개편

## 목표
"분석 결과 나열" → "영상 코칭" 전환. P13 evaluation 엔진이 핵심.

## 배경 (주인님 피드백)
- 정보 과잉, 축별 분리로 연결이 안 됨
- Hook/Body/CTA 구조가 보여야 함
- 체크리스트(팩트) + 맥락 판단(강점/개선 포인트)
- 점수 ❌ → 강점/개선 포인트 ✅
- 나중에 카테고리별 데이터 기반 판단으로 전환 가능한 구조
- 에너지 그래프는 현재가 좋음
- 씬 카드에 영상축 + 대본축 통합
- UI적 요소로 시계열 3축 해결

---

## Phase 1: P13 Evaluation 엔진 (백엔드)

### R11-01: P13 출력 스키마 설계
**Do**: evaluation 출력 구조 정의
```
EvaluationOutput {
  // 한 줄 요약
  summary: string  // "감각 자극이 효과적인 식품 프로모션. 사회적 증거 추가 시 설득력 ↑"
  
  // Hook / Body / CTA 구조 분석
  structure: {
    hook: {
      time_range: [number, number]
      scene_ids: number[]
      strengths: Insight[]    // { fact: string, comment: string }
      improvements: Insight[]
    }
    body: { ... }
    cta: { ... }
  }
  
  // 체크리스트 (데이터 기반 팩트)
  checklist: {
    category: string          // hook | body | cta | overall
    item: string              // "3초 내 제품 등장"
    passed: boolean
    evidence: string          // "product_first_appear: 0.0s"
  }[]
  
  // 강점 & 개선 포인트 (맥락 판단)
  strengths: Insight[]        // { fact, comment, related_scenes }
  improvements: Insight[]     // { fact, comment, suggestion, related_scenes }
  
  // 레시피 평가
  recipe_analysis: {
    current: string[]         // [hook, benefit, proof, ...]
    suggestion: string        // "pain_point 추가 권장"
    reason: string
  }
}
```
**Check**: 스키마가 프론트에서 렌더링 가능하고, 나중에 데이터 기반 전환 가능한가
**Act**: 승인 후 구현

### R11-02: P13 파이프라인 구현
**Do**: 
- `core/pipeline/p13_evaluate.py` 작성
- 입력: P12(build) 결과 전체 recipe_json
- LLM 호출: recipe_json을 보고 evaluation 생성
- 프롬프트: 제품 카테고리 × 영상 구조 교차 분석
- 체크리스트 항목은 규칙 기반 (LLM 없이 데이터로 판단)
- 강점/개선은 LLM 판단 (맥락 필요)
**Check**: 
- [ ] 체크리스트가 recipe_json 데이터로 정확히 판단되는가
- [ ] 강점/개선이 제품 맥락을 반영하는가
- [ ] 응답 시간 < 10초
**Act**: worker.py에 P13 호출 추가

### R11-03: worker.py + recipe_json 확장
**Do**:
- worker.py에 P13 호출 추가
- recipe_json에 `evaluation` 필드 추가
- Supabase 저장
**Check**: 
- [ ] 분석 완료 시 evaluation 데이터 포함
- [ ] 기존 분석 흐름 깨지지 않음
**Act**: Cloud Run 배포

---

## Phase 2: 리포트 UI 개편 (프론트엔드)

### R11-04: 요약 카드 개편
**Do**: SummarySection 리팩토링
- strategy → P13 summary (한국어 한 줄)
- 제품명 · 카테고리 · 플랫폼 · 시간
- 레시피 flow 유지
**Check**: 영어 텍스트 없음, 한 줄 요약이 의미 있는가

### R11-05: 구조 분석 섹션 (NEW)
**Do**: StructureSection 신규 컴포넌트
- 에너지 그래프 (AttentionCurve 이동) + 하단 블록 컬러 바
- Hook/Body/CTA 각 구간 카드
  - 강점 (🟢) / 개선 포인트 (💡)
  - 체크리스트 항목 표시
**Check**: Hook/Body/CTA 구간이 시각적으로 구분되는가

### R11-06: 씬 카드 통합 (영상축 + 대본축)
**Do**: SceneCard 신규 컴포넌트
- 왼쪽: 블록 컬러 라인
- 상단: 썸네일 (크게) + 영상축 (스타일 태그)
- 하단: 대본축 (블록 태그 + 대사 텍스트)
- 기본 접힘, 펼치면 상세
**Check**: 
- [ ] 한 씬에서 "뭘 보여주면서 뭘 말하는지" 바로 파악 가능
- [ ] 모바일에서 가독성

### R11-07: 정리 + 통합
**Do**:
- ScriptSection, VisualSection 제거 (씬 카드에 통합)
- AttentionCurveSection → 구조 분석에 통합
- EngagementSection 축소 (훅 강도 + 트리거만 유지)
- 씬 뷰 탭 제거 → 단일 뷰
- ProductSection 유지 (하단)
**Check**: 
- [ ] 빌드 성공
- [ ] 정보 계층: 요약 → 구조(평가) → 씬 카드 → 제품
- [ ] 불필요한 정보 제거됨

---

## 최종 리포트 구조
```
① 요약 카드 — P13 summary + 기본 정보 + 레시피
② 구조 분석 — 에너지 그래프 + 블록 컬러 바 + Hook/Body/CTA 평가
③ 씬 카드   — 영상축 + 대본축 통합, 블록 컬러 라인
④ 제품 분석 — claims (현재 유지)
⑤ 참여 요약 — 훅 강도 + 트리거 (축소)
```

## 작업 순서
P13 스키마(R11-01) → P13 구현(R11-02) → worker 연동(R11-03) → 프론트 순차(R11-04~07)

## 완료 기준
- [ ] P13 evaluation 데이터가 recipe_json에 포함
- [ ] 리포트 상단에 한국어 요약 + 강점/개선 포인트
- [ ] Hook/Body/CTA 구조 시각화
- [ ] 씬 카드에 영상축 + 대본축 통합
- [ ] 빌드 + 배포 성공
