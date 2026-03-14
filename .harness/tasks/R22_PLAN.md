# R22 — 프로젝트 목록 버그 수정

## T1: 프로젝트 썸네일 생성 (직접 업로드)

### 현상
- 직접 업로드한 영상의 프로젝트 목록에 썸네일이 안 나옴
- URL 분석은 소셜미디어 메타데이터에서 thumbnail_url 전달되어 정상 표시

### 원인
- `backend/app/worker.py`의 `run_analysis()`가 씬 썸네일(`results.thumbnails_json`)은 만들지만
- `jobs.thumbnail_url` (프로젝트 목록용 대표 썸네일)은 설정하지 않음

### 수정
1. `worker.py`의 `run_analysis()` 완료 시점에:
   - 영상 중간 지점(duration/2) 프레임을 ffmpeg로 추출
   - R2에 `thumbnails/{job_id}/cover.jpg`로 업로드
   - `jobs.thumbnail_url`에 R2 키 저장
2. `routes/jobs.py`의 `list_jobs`와 `get_job`에서:
   - `thumbnail_url`이 R2 키(thumbnails/로 시작)면 presigned URL로 변환

### 완료 기준
- 직접 업로드 영상의 프로젝트 목록에 썸네일 이미지 표시

---

## T2: 직접 업로드 플랫폼 오감지 수정

### 현상
- 직접 업로드한 영상이 리포트에서 "tiktok"으로 표시됨
- P2 SCAN이 Gemini에게 `platform (tiktok/reels/shorts/ad)` 중 하나를 강제 선택시키기 때문

### 원인
- `core/schemas/enums.py`의 `Platform` enum에 upload/unknown 옵션 없음
- 직접 업로드 여부를 파이프라인이 알 수 없음

### 수정
1. `core/schemas/enums.py`: `Platform` enum에 `UPLOAD = "upload"` 추가
2. `core/orchestrator.py`: `PipelineConfig`에 `source_type: str | None = None` 필드 추가
3. `backend/app/worker.py`: `run_analysis()`에 `source_type` 파라미터 추가, `PipelineConfig`에 전달
4. `backend/app/routes/analyze.py`: 
   - `/analyze` (직접 업로드): `source_type="upload"` 전달
   - `/analyze-url`: `source_type="url"` 전달
5. `core/orchestrator.py`의 `run_pipeline()`:
   - P2 완료 후, `source_type == "upload"`이면 `scan_result.meta.platform`을 `"upload"`로 오버라이드
6. 프론트 수정 불필요 — AnalyzePage의 프로젝트 목록은 `channel_name`을 보여주며, platform은 리포트 내부에서만 사용

### 완료 기준
- 직접 업로드 영상의 리포트에서 platform이 "upload"로 표시 (tiktok ❌)

---

## 수정 파일 목록
- `backend/app/worker.py` (T1 + T2)
- `backend/app/routes/jobs.py` (T1)
- `backend/app/routes/analyze.py` (T2)
- `core/schemas/enums.py` (T2)
- `core/orchestrator.py` (T2)
