# TASK: 리포트 페이지 업그레이드 — 인사이트 중심 재설계

## 목표
현재 리포트가 원시 데이터를 나열하고 있음. 데이터를 **조합**해서 사용자(마케터)가 바로 활용할 수 있는 **인사이트 + 액션** 형태로 리포트를 업그레이드.

## 수정 대상
- `frontend/src/pages/ReportPage.tsx` (메인 리포트 페이지)
- `frontend/src/types/index.ts` (필요 시 타입 추가)
- `frontend/src/lib/api.ts` (필요 시)

## 데이터 소스 (이미 프론트엔드로 내려오는 것들)
- `result.video_recipe` — recipe JSON (구조, 스타일, 오디오, 씬, performance_metrics, dropoff_analysis, temporal_profile, production_guide, scene_cards, art_direction, product_strategy, persuasion_analysis, effectiveness_assessment)
- `result.temporal` — temporal_json (attention_curve, cut_rhythm, exposure_curve, visual_journey, color_change_curve, text_dwell, zoom_events, transition_texture, caption_pattern) ※ 일부 결과에만 있음, optional 처리 필수
- `result.diagnosis` — 5차원 진단
- `result.prescriptions` — 처방
- `result.stt` — STT 전사
- `result.appeal_structure` — 소구 구조 (씬별 appeals)
- `result.persuasion_lens` — 7+α 설득 공식
- `result.caption_map` — 자막 맵
- `result.verdict` — 마케팅 판정

## 추가할 카드 (2개)

### 카드 1: 구조 해부 (Structure Breakdown)
**위치:** 한줄 요약 바로 아래
**목적:** "이 영상이 어떻게 생겼는지" 한 눈에 보여줌

**⚠️ 핵심 원칙: 판정 배제!**
- 점수, 등급, ✅⚠️❌ 판정 표현 **절대 사용 금지**
- "잘됐다/안됐다"가 아니라 "이렇게 생겼다"를 보여줌
- 판단은 사용자가 함. 우리는 구조를 보여줄 뿐

**2축 구조: 대본 × 영상**

상단 — 📝 대본 (스토리텔링)
| 항목 | 데이터 소스 | 표시 예시 |
|------|-----------|----------|
| 훅 유형 | structure.hook_type, hook_line | "시연형 — 제품 사용 장면으로 시작" |
| 소구 포인트 | appeal_count, primary_appeal, appeal_layering | "기능 → 비교 → 가격 3단 소구" |
| 설득 흐름 | appeal_structure.groups | "관심유발(씬1~3) → 신뢰(씬4) → 구매유도(씬5)" |
| CTA | cta_line, time_to_cta | "프로필 링크 (12초)" |

하단 — 🎬 영상 (완주력)
| 항목 | 데이터 소스 | 표시 예시 |
|------|-----------|----------|
| 편집 리듬 | avg_cut_interval, total_cuts, cut_rhythm.pattern | "평균 1.8초 · 15컷 · 감속 패턴" |
| 제품/사람 | product_focus_ratio, human_screen_time_ratio, exposure_curve.circulation_pattern | "제품 35% · 사람 42% · 사람→제품 순환" |
| 시각 스타일 | art_direction.tone_and_manner, color_palette | "밝고 깨끗한 톤 · 파스텔 컬러" |
| 영상 길이 | duration | "28초" |

**UI:** Sandcastles 스타일 카드형, 깔끔하게 세로 나열. 아이콘 + 한줄 텍스트.
- Apple 미니멀: 흑백 베이스, #fafafa 배경
- 모바일 퍼스트: 세로 스크롤 자연스럽게

### 카드 2: 핵심 인사이트 (Key Insights)
**위치:** 성적표 바로 아래
**목적:** "이 영상이 왜 잘됐는지 / 안 됐는지" 3줄로 요약

**데이터 조합해서 인사이트 생성 (프론트엔드 로직):**

인사이트는 데이터를 조합해서 자동 생성. 아래 패턴 중 상위 3개를 선택:

1. **제품 노출 전략** — exposure_curve.total_product_time_ratio + time_to_first_appeal 조합
   - 예: "제품이 {time_to_first_appeal}초에 첫 등장, 전체 {ratio}% 노출. {circulation_pattern} 구조"

2. **편집 리듬** — cut_rhythm.pattern + avg_interval + attention_arc 조합
   - 예: "평균 {avg}초 빠른 컷 + {pattern} 패턴. 시각 에너지 {arc}"

3. **소구 구조** — appeal_count + primary_appeal + appeal_layering 조합
   - 예: "{count}개 소구 포인트, {primary}를 중심으로 {layering} 전개"

4. **훅 효과** — hook_rating + hook_time + hookLine 조합
   - 예: "첫 {hook_time}초에 '{hookLine}'으로 시선 고정. 훅 강도: {rating}"

5. **자막/텍스트** — text_readability_score + texts_per_second 조합
   - 예: "초당 {tps}개 자막, 가독성 {score}점. {적정/과다/부족} 수준"

6. **사람 활용** — total_human_time_ratio + presenter.type 조합
   - 예: "{type} 출연 {ratio}%. 사람↔제품 {circulation} 순환"

**UI 설계:**
- 인사이트 3개를 카드 형태로 나열
- 각 인사이트: 아이콘 + 한줄 제목 + 1~2줄 설명
- 색상: 모두 중립 톤 (판정 색상 사용 금지 — 초록/빨강 ❌)
- 인사이트에 해당하는 시간 구간이 있으면 타임스탬프 표시 (클릭 시 seekTo)

## 기존 카드 정리
- "한줄 요약" 카드 → 유지
- "훅 분석" 카드 → 유지 (성적표의 훅 지표와 연동)
- "영상 리듬감" 카드 → 유지 (시각 에너지 + 편집 리듬 차트)
- "설득 구조" 카드 → 유지
- "내 제품에 적용" 카드 → 유지

## 추가 데이터: appeal_structure.groups (설득 단계 그룹핑)
`result.appeal_structure.groups[]`에 씬을 설득 단계별로 그룹핑한 데이터가 있음:
```json
{
  "group_id": 1,
  "name": "관심 유발 및 욕구 자극",
  "description": "제품의 핵심 강점과 효능을 제시하여...",
  "scene_ids": [1, 2, 3],
  "color": "#4ECDC4"
}
```
- 보통 3~4개 그룹 (관심유발 → 신뢰구축 → 행동촉구 등)
- **핵심 인사이트 카드**에서 "설득 흐름" 인사이트로 활용:
  - 예: "관심유발(씬1~3) → 신뢰구축(씬4) → 구매유도(씬5) 3단 구조"
- **영상 성적표**에서 "설득 구조 완성도" 지표로 활용 가능
- 타입은 이미 `AppealGroup`으로 정의되어 있음 (`frontend/src/types/index.ts`)

## 핵심 프레임: 대본 × 영상 2축 구조
숏폼은 크게 **대본(스토리텔링)**과 **영상(완주력)** 두 축으로 나뉨:

### 📝 대본 축 — "왜 사야 하는지" (설득력)
- 소구 포인트 (appeal_points, appeal_count, appeal_diversity)
- 설득 구조 (persuasion_lens, appeal_structure.groups)
- 훅 라인 (hook_line, hook_rating)  
- CTA (cta_strength, time_to_cta)
- 나레이션/자막 (stt, caption_map)

### 🎬 영상 축 — "끝까지 보게 하는 힘" (완주력)
- 편집 리듬 (cut_rhythm, cut_density)
- 시각 에너지 (attention_curve, attention_avg)
- 컷 변화/전환 (transition_texture, zoom_events)
- 제품/사람 노출 (exposure_curve, product_focus_ratio)
- 아트 디렉션 (art_direction, color_change_curve)

### 성적표에 반영
성적표를 이 **2축으로 나눠서** 표시:
```
📝 대본  🟢 소구 5개 · 3단 설득 구조 · CTA 강함
🎬 영상  🟡 평균 1.3초 빠른 컷 · 후반 밀도 감소 주의
```

### 인사이트에 반영
인사이트도 대본/영상 축 라벨 붙여서 구분:
- 📝 "5개 소구를 관심유발→신뢰→구매유도 3단으로 전개"
- 🎬 "평균 1.3초 빠른 컷이 초반 이탈 방지, 후반 감속 패턴"

## 주의사항
- `temporal` 데이터는 **optional** — 없는 경우 해당 지표는 "-" 또는 숨김 처리
- 모바일 대응: 카드가 좁은 화면에서도 깨지지 않게
- 기존 컴포넌트/스타일(Tailwind) 유지
- 빌드 에러 없이 완료할 것 (`npm run build` 성공)
- 배포하지 말 것 — 커밋까지만

## 샘플 데이터 확인
로컬에서 실제 데이터 구조를 확인하려면:
```bash
# Recipe 구조
python3 -c "import json; r=json.load(open('backend/output/ccabd1c2-13aa-4cc3-a648-206462579e32/ccabd1c2-13aa-4cc3-a648-206462579e32_video_recipe.json')); vr=r['video_recipe']; [print(k, type(v).__name__) for k,v in vr.items()]"

# Temporal 구조  
python3 -c "import json; t=json.load(open('backend/output/ccabd1c2-13aa-4cc3-a648-206462579e32/ccabd1c2-13aa-4cc3-a648-206462579e32_temporal.json')); [print(k, type(v).__name__) for k,v in t.items()]"

# Performance metrics
python3 -c "import json; r=json.load(open('backend/output/ccabd1c2-13aa-4cc3-a648-206462579e32/ccabd1c2-13aa-4cc3-a648-206462579e32_video_recipe.json')); pm=r['video_recipe']['performance_metrics']; [print(k,v) for k,v in pm.items()]"
```
