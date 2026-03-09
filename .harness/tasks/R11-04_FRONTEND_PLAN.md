# R11-04~07: 프론트엔드 리포트 개편

## 목표
기존 6개 섹션 나열 → 코칭 중심 단일 뷰로 개편

## 작업 순서

### R11-04: EvaluationSection + 타입 정의
1. `frontend/src/types/recipe.ts`에 evaluation 타입 추가:
   ```ts
   evaluation?: {
     summary: string;
     checklist: Array<{ category: string; item: string; passed: boolean; evidence: string }>;
     structure: {
       hook: SegmentEval;
       body: SegmentEval;
       cta: SegmentEval;
     };
     strengths: Array<{ fact: string; comment: string; related_scenes: number[] }>;
     improvements: Array<{ fact: string; comment: string; suggestion: string; related_scenes: number[] }>;
     recipe_eval: { current: string[]; suggestion: string; reason: string };
   }
   ```
2. `frontend/src/components/Report/EvaluationSection.tsx` 신규:
   - P13 summary 표시 (큰 텍스트)
   - 체크리스트: ✅/❌ 아이콘 + 카테고리 그룹 (Hook/Body/CTA)
   - 전체 강점/개선 포인트

### R11-05: StructureSection
1. `frontend/src/components/Report/StructureSection.tsx` 신규:
   - 에너지 그래프 (기존 AttentionCurveSection 로직 이동)
   - 블록 컬러 바 (flow_order 기반, 시간 비례)
   - Hook/Body/CTA 각 구간별 strengths/improvements 표시

### R11-06: 씬 카드 개편
1. ScenesTab의 씬 카드에 대본 utterance 통합:
   - 썸네일 위: 영상축 (style, visual_forms)
   - 썸네일 아래: 대본축 (utterances + 블록 타입 컬러 라인)
   - script.blocks와 time_range 매칭으로 해당 씬의 대본 표시

### R11-07: 통합 + 정리
1. 탭 제거 → 단일 뷰:
   - EvaluationSection (코칭 요약)
   - StructureSection (구조 분석)
   - Scene cards (씬 카드 통합)
   - ProductSection (유지)
   - RecipeCard (현재→제안 비교)
2. 삭제: ScriptSection, VisualSection, EngagementSection, AttentionCurveSection (별도)
3. 기존 파일은 Report_v1/ 폴더로 백업 (이미 있음)

## 블록 컬러 매핑
- hook: #EF4444 (빨강)
- benefit: #3B82F6 (파랑)
- proof: #10B981 (초록)
- differentiation: #8B5CF6 (보라)
- social_proof: #F59E0B (노랑)
- cta: #EC4899 (핑크)
- 기타: #6B7280 (회색)

## 완료 기준
- [x] evaluation 타입 정의
- [ ] EvaluationSection 렌더링 (evaluation 없으면 기존 SummarySection 폴백)
- [ ] StructureSection 에너지 그래프 + 블록 바 + 코칭
- [ ] 씬 카드에 대본 통합
- [ ] 탭 제거, 단일 뷰
- [ ] npm run build 성공
- [ ] CF Pages 배포
