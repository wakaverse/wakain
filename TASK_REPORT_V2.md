# TASK: 개별 분석 리포트 — 구조 중심 재설계

## 핵심 원칙
1. **판정 배제** — 점수, 등급, ✅⚠️❌, 초록/빨강 판정 색상 절대 금지. "이렇게 생겼다"만 보여줌
2. **2축 구조** — 대본(스토리텔링) + 영상(완주력)
3. **제품 가치 기준** — 제품/브랜드 정보를 기준으로 소구가 핵심 가치를 얼마나 커버하는지

## 포지가 이전에 만든 것
커밋 `906a109`에서 ScoreCardSection + KeyInsightsSection을 추가했는데, 점수/판정이 들어가서 원칙에 어긋남.
→ **이 두 컴포넌트를 삭제하고** 아래 새 설계로 교체할 것.

## 수정 대상
- `frontend/src/pages/ReportPage.tsx`
- 필요 시 새 컴포넌트 파일 생성

## 새 설계: 요약 카드 (한줄 요약 바로 아래)

### 카드: 영상 구조 요약 (VideoStructureSummary)

상단 — 제품 정보 (product_json에서)
```
[카테고리 아이콘] 제품명 · 브랜드 · 카테고리
```
예: 🍽️ 태풍김 · 태풍김 · 식품

---

중단 — 📝 대본 (스토리텔링)

| 항목 | 데이터 소스 | 표시 |
|------|-----------|------|
| 훅 | structure.hook_type + hook_line (또는 verdict_json.hook_analysis에서 추출) | "시연형 — 김이 다 거기서 거기라고요?" |
| 소구 | persuasion_analysis.appeal_points[].type + claim | 소구 유형 태그 나열 (예: `감각` `성분` `공정` `실적` `보증`) |
| 소구 수 | appeal_points.length | "11개 소구 포인트" |
| 설득 흐름 | appeal_structure.groups[].name | "관심유발 → 신뢰구축 → 행동촉구" (화살표로 연결) |
| CTA | structure.cta_start + audio에서 CTA 관련 | "보증 기반 CTA (25초)" |

---

하단 — 🎬 영상 (완주력)

| 항목 | 데이터 소스 | 표시 |
|------|-----------|------|
| 길이 · 컷 수 | meta.duration, structure.scene_sequence.length | "28초 · 12컷" |
| 편집 속도 | avg_cut_interval 계산 | "평균 2.3초/컷" |
| 제품 노출 | product_emphasis.screen_time_ratio, first_appear | "노출 80% · 첫 등장 0초" |
| 사람 | persuasion_analysis.presenter.type, face_shown | "내레이터 · 얼굴 노출" |
| 제품 강조 기법 | product_emphasis.emphasis_techniques[] | `클로즈업` `패키지` `시연` `질감` |
| 컷 패턴 | temporal.cut_rhythm.pattern (있으면) | "감속 패턴" (없으면 표시 안 함) |

---

## UI 스타일
- Apple 미니멀: #fafafa 배경, 깔끔한 카드
- 폰트: 기존 프로젝트 폰트 유지
- 소구 유형은 **태그/뱃지** 형태 (둥근 pill, 연한 회색 배경, 진한 텍스트)
- 설득 흐름은 → 화살표로 연결된 단계 표시
- 제품 강조 기법도 태그 형태
- 모바일 퍼스트: 세로 스크롤 자연스럽게
- **색상은 모두 중립 톤** (회색/검정/흰색 계열)

## 데이터 접근
프론트엔드에서 이미 내려오는 데이터:
- `result.video_recipe` → recipe JSON (structure, meta, audio, persuasion_analysis, product_strategy, effectiveness_assessment 등)
- `result.temporal` → temporal_json (optional)
- `result.appeal_structure` → {groups, scenes}
- `result.product` → product_json (product_name, product_brand, category, category_ko)
- `result.verdict` → verdict_json

실제 데이터 구조 확인:
```bash
python3 -c "import json; r=json.load(open('backend/output/ccabd1c2-13aa-4cc3-a648-206462579e32/ccabd1c2-13aa-4cc3-a648-206462579e32_video_recipe.json')); vr=r['video_recipe']; print(json.dumps(vr.get('structure'), ensure_ascii=False, indent=2))"

python3 -c "import json; r=json.load(open('backend/output/ccabd1c2-13aa-4cc3-a648-206462579e32/ccabd1c2-13aa-4cc3-a648-206462579e32_video_recipe.json')); vr=r['video_recipe']; print(json.dumps(vr.get('persuasion_analysis'), ensure_ascii=False, indent=2))"
```

## 주의사항
- ScoreCardSection, KeyInsightsSection (커밋 906a109) → 삭제
- optional 데이터(temporal, appeal_structure 등) 없으면 해당 항목 숨김
- `npm run build` 성공 필수
- git commit 할 것
- **배포하지 말 것**
