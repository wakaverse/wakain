# Task: 카테고리 인사이트 API + 프론트 페이지

## 목표
분석된 영상 데이터를 카테고리별로 집계해서 "이 카테고리에서 잘 먹히는 패턴"을 보여주는 페이지

## 백엔드 API

### GET /api/insights/categories
카테고리 목록 + 각 카테고리별 영상 수

Response:
```json
[
  { "category": "식품", "count": 25 },
  { "category": "건강", "count": 13 },
  ...
]
```

### GET /api/insights/category/{category_name}
특정 카테고리의 패턴 분석

Response:
```json
{
  "category": "식품",
  "video_count": 25,
  "appeal_distribution": [
    { "type": "feature_demo", "label": "기능 시연", "count": 104, "percentage": 87 },
    { "type": "manufacturing", "label": "제조 공법", "count": 42, "percentage": 56 },
    ...
  ],
  "element_usage": [
    { "element": "simplicity", "label": "④ 간편", "count": 16, "percentage": 64 },
    { "element": "process", "label": "⑤ 과정", "count": 8, "percentage": 32 },
    ...
  ],
  "flow_patterns": [
    { "flow": "훅→간편→묘사→과정→CTA", "count": 3 },
    ...
  ],
  "alpha_techniques": {
    "emotion": [{ "type": "empathy", "label": "공감", "count": 5 }],
    "structure": [{ "type": "contrast", "label": "대조", "count": 8 }],
    "connection": [{ "type": "bridge_sentence", "label": "브릿지", "count": 3 }]
  },
  "sample_videos": [
    { "job_id": "...", "product_name": "보넬드 그린주스", "title": "..." }
  ]
}
```

## 구현 방법
- Supabase에서 results 테이블 조회 (product_json.category_ko + recipe_json)
- 서버사이드에서 집계 (Python Counter/defaultdict)
- auth 필요: 로그인 유저의 분석 결과만 OR 전체 공개 (전체로 하자)

## 백엔드 파일
- `backend/app/routes/insights.py` 신규 생성
- `backend/app/main.py`에 router 등록

## 프론트엔드 페이지

### /insights — 카테고리 인사이트 페이지

상단: 카테고리 칩 (식품 25 | 건강 13 | 리빙 13 | 전자기기 12 | 패션 10 | 뷰티 4)
클릭하면 해당 카테고리 인사이트 표시

카테고리 선택 시:
1. **소구 분포** — 가로 바 차트 (유형별 사용 %)
2. **7요소 사용률** — 요소별 사용 % 바
3. **대표 배치 패턴** — flow_order TOP 3
4. **α 기법** — 감정/구조/연결 기법 빈도
5. **샘플 영상** — 이 카테고리 분석 영상 목록 (클릭→리포트 이동)

### 디자인
- 기존 wakain.site 스타일 따르기 (bg-white, rounded-2xl, border-gray-100)
- 바 차트는 Tailwind CSS로 구현 (라이브러리 없이)
- 모바일 우선 (숏폼 서비스)

## 프론트엔드 파일
- `frontend/src/pages/InsightsPage.tsx` 신규 생성
- `frontend/src/lib/api.ts`에 API 호출 함수 추가
- `frontend/src/App.tsx`에 라우트 추가
- 사이드바/네비게이션에 "인사이트" 메뉴 추가

## 한글 라벨 매핑
appeal type → 한글은 기존 APPEAL_TYPE_KO 사용:
```
myth_bust: '통념 깨기', ingredient: '성분/원재료', manufacturing: '제조 공법',
track_record: '실적/수상', price: '가격 어필', comparison: '비교',
guarantee: '보증/자신감', origin: '원산지', feature_demo: '기능 시연',
spec_data: '스펙/수치', design_aesthetic: '디자인', authenticity: '진정성',
social_proof: '사회적 증거', urgency: '긴급/한정', lifestyle: '라이프스타일',
nostalgia: '향수/추억', authority: '전문성/권위', emotional: '공감'
```

element → 한글:
```
authority: ①권위, hook: ②훅, sensory_description: ③묘사,
simplicity: ④간편, process: ⑤과정, social_proof: ⑥증거, cta: ⑦CTA
```

## DB 접속
- SUPABASE_URL=https://btektycyknkqetmfmywc.supabase.co
- 환경변수 SUPABASE_SERVICE_KEY 사용 (이미 Cloud Run에 설정됨)
- results 테이블: product_json, recipe_json 컬럼 사용

## 주의사항
- auth는 service key로 직접 조회 (인사이트는 공개 데이터)
- product_json이 null인 결과는 스킵
- recipe_json.video_recipe 안에 persuasion_analysis, script_analysis, script_alpha 있음
- script_analysis, script_alpha는 최근 분석만 있음 (레거시에는 없음)
- 기존 코드 패턴 따르기 (FastAPI router, React hooks)
