# R12: STT 타임스탬프 파이프라인 연결

## 배경
- P1(STT) 결과에 발화별 타임스탬프가 있으나, P12(BUILD)에서 recipe_json으로 전달 시 utterances.timestamp가 0.0으로 유실
- P13(EVALUATE)이 블록 text만 보고 코칭 → P9 블록 분류 오류에 취약
- STT 원본(발화 + 타임스탬프)이 P13까지 전달되어야 정확한 코칭 가능

## 목표
- P1 STT 타임스탬프가 recipe_json.script.blocks[].utterances까지 정확히 전달
- P13 요약본에 STT 원본 포함 → LLM이 블록 분류에 의존하지 않고 대사 흐름 직접 판단

## TODO
- [ ] R12-01: P1→P12 타임스탬프 전달 경로 분석
- [ ] R12-02: utterances 타임스탬프 매핑 수정
- [ ] R12-03: P13 요약본에 STT 원본 추가
- [ ] R12-04: E2E 테스트 + 배포

## 상태: Plan 미확정 (분석 필요)
