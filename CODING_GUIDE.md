# CODING_GUIDE.md — WakaIn AI 코딩 가이드라인

> AI 코딩 에이전트가 이 프로젝트를 수정할 때 반드시 따라야 하는 규칙입니다.

---

## 1. 수정 범위

- 요청받은 기능의 파일만 수정할 것
- 요청 외 파일 임의 수정 금지
- "개선", "리팩토링" 등 요청하지 않은 변경은 하지 않을 것

## 2. 파일 구조

```
backend/app/
  routes/{기능명}.py        # 새 API 라우트
  services/{기능명}.py      # 새 서비스 로직
  worker.py                # 파이프라인 실행만 (services/ import)
  config.py                # 환경변수 관리

frontend/src/
  pages/                   # 페이지 컴포넌트
  components/{기능명}/      # 새 UI 컴포넌트
  components/Report/tabs/  # 리포트 탭 컴포넌트
  lib/                     # 유틸리티, API 클라이언트
```

## 3. Backend 규칙

- Python 3.11+ type hints 필수
- 함수에 독스트링(docstring) 작성
- `app.services.storage._supabase()` / `_s3()` 사용 (직접 클라이언트 생성 금지)
- 각 서비스 모듈은 서로 import 금지 (storage만 예외)
- 새 의존성 추가 시 `requirements.txt` 업데이트
- 환경변수는 `config.py`에서만 관리

## 4. Frontend 규칙

- TypeScript strict 모드 준수
- 컴포넌트 props에 interface/type 명시
- 새 API 호출은 `lib/api.ts` 패턴 따를 것
- Tailwind CSS 클래스 사용 (inline style 지양)

## 5. Import 규칙

- 기존 import 패턴을 따를 것
- Backend: `from app.services.{module} import {function}`
- Frontend: 상대 경로 `../` 보다 `@/` alias 사용

## 6. 데이터베이스

- 마이그레이션 SQL은 `supabase/migrations/` 에 날짜 순번으로 작성
- 파일명 형식: `YYYYMMDD_NNN_{description}.sql`
- RLS 정책 변경 시 반드시 명시

## 7. API 설계

- RESTful 패턴 준수 (GET/POST/PUT/DELETE)
- 응답은 JSON, 에러는 `{"detail": "message"}` 형식
- 인증 필요 API는 `Depends(get_current_user)` 사용

## 8. 테스트

- 새 API 추가 시 `tests/backend/` 에 테스트 작성
- mock 기반 유닛 테스트 (실제 DB 연결 없음)
- 테스트 파일명: `test_{기능명}.py`

## 9. 커밋 & PR

- 커밋 메시지: `{type}({scope}): {description}` (예: `feat(R24): 회수 제한 API`)
- 수정한 파일 목록 반드시 PR 본문에 명시
- 수정 이유 간략 기재

## 10. 금지 사항

- `.env`, credential 파일 커밋 금지
- `console.log` / `print` 디버깅 코드 잔류 금지 (로깅은 `logger` 사용)
- 하드코딩된 URL, API 키 금지
- `any` 타입 남용 금지 (TypeScript)
- `# type: ignore` 남용 금지 (Python)

## 11. 수정 보고

모든 변경 후 반드시 다음을 보고할 것:
- 수정한 파일 목록 (경로 + 줄 수)
- 수정 이유 간략 기재
- 기존 기능 영향 여부
