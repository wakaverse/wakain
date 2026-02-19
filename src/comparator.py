"""비디오 비교 엔진 / Video Comparison Engine.

여러 video recipe JSON을 로드해 나란히 비교하고 VideoComparison을 출력한다.
Loads multiple video recipe JSONs and produces a side-by-side VideoComparison.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Optional

from src.schemas import (
    ComparisonInsight,
    VideoComparison,
    VideoRecipe,
    VideoSummary,
)


# ── Recipe 로드 헬퍼 ──────────────────────────────────────────────────────────


def _find_recipe_path(path: str | Path) -> Path:
    """주어진 경로에서 *_video_recipe.json 파일을 찾아 반환한다.

    path가:
    - 직접 JSON 파일 경로 → 그대로 반환
    - 디렉토리 → 하위에서 *_video_recipe.json 검색
    """
    p = Path(path)
    if p.is_file():
        return p
    # 디렉토리: 재귀 검색
    matches = list(p.rglob("*_video_recipe.json"))
    if not matches:
        raise FileNotFoundError(f"*_video_recipe.json not found under {p}")
    # 가장 최근 수정 파일 선택
    return sorted(matches, key=lambda f: f.stat().st_mtime, reverse=True)[0]


def _load_recipe(path: str | Path) -> tuple[str, VideoRecipe]:
    """recipe JSON 파일을 로드하고 (video_name, VideoRecipe) 튜플을 반환한다."""
    recipe_path = _find_recipe_path(path)
    data = json.loads(recipe_path.read_text(encoding="utf-8"))
    raw = data.get("video_recipe", data)
    recipe = VideoRecipe.model_validate(raw)
    # video_name: 파일명에서 _video_recipe.json 제거
    video_name = recipe_path.name.replace("_video_recipe.json", "")
    return video_name, recipe


# ── VideoSummary 추출 ─────────────────────────────────────────────────────────


def _extract_summary(video_name: str, recipe: VideoRecipe, label: Optional[str] = None) -> VideoSummary:
    """VideoRecipe에서 VideoSummary를 추출한다. 없는 필드는 안전하게 기본값 처리."""

    # 기본 정보
    duration = recipe.meta.duration
    scene_count = len(recipe.scenes)

    # 컷 밀도 (PerformanceMetrics 우선, 없으면 visual_style에서 계산)
    pm = recipe.performance_metrics
    if pm:
        cut_density = pm.cut_density
        product_focus_ratio = pm.product_focus_ratio
        text_readability = pm.text_readability_score
        info_density = pm.info_density
        appeal_count = pm.appeal_count
        time_to_cta = pm.time_to_cta
    else:
        # fallback: visual_style에서 계산
        vs = recipe.visual_style
        cut_density = round(vs.total_cuts / duration, 3) if duration > 0 else 0.0
        product_focus_ratio = vs.product_screen_time_ratio * 100
        text_readability = 50  # 알 수 없는 경우 중간값
        info_density = 0.0
        appeal_count = 0
        time_to_cta = recipe.structure.cta_start if recipe.structure.cta_start > 0 else None

    # 소구 분석 (persuasion_analysis)
    pa = recipe.persuasion_analysis
    if pa:
        appeal_types = list(dict.fromkeys(ap.type for ap in pa.appeal_points))  # 순서 유지 중복 제거
        dominant_appeal_sequence = [ap.type for ap in pa.appeal_points]
        first_appeal_time = pa.product_emphasis.first_appear if pa.product_emphasis else 0.0
        if not appeal_count:
            appeal_count = len(pa.appeal_points)
    else:
        appeal_types = []
        dominant_appeal_sequence = []
        first_appeal_time = recipe.structure.product_first_appear

    # 집중도 분석 — scene attention에서 집계
    attn_scores = []
    attn_peaks = []
    for scene in recipe.scenes:
        if scene.attention:
            attn_scores.append(scene.attention.attention_score)
            attn_peaks.append(scene.attention.attention_peak)

    if pm and pm.attention_avg:
        attention_avg = pm.attention_avg
    elif attn_scores:
        attention_avg = int(sum(attn_scores) / len(attn_scores))
    else:
        attention_avg = 0

    attention_min = min(attn_scores) if attn_scores else 0
    attention_max = max(attn_peaks) if attn_peaks else 0

    # 이탈 분석 retention score
    da = recipe.dropoff_analysis
    retention_score = da.overall_retention_score if da else 50

    # 아트 스타일
    ad = recipe.art_direction
    art_style = ad.tone_and_manner if ad else "알 수 없음"

    return VideoSummary(
        video_name=video_name,
        label=label,
        duration=duration,
        scene_count=scene_count,
        cut_density=cut_density,
        appeal_count=appeal_count,
        appeal_types=appeal_types,
        attention_avg=attention_avg,
        attention_min=attention_min,
        attention_max=attention_max,
        first_appeal_time=first_appeal_time,
        time_to_cta=time_to_cta,
        product_focus_ratio=product_focus_ratio,
        text_readability=text_readability,
        info_density=info_density,
        retention_score=retention_score,
        dominant_appeal_sequence=dominant_appeal_sequence,
        art_style=art_style,
    )


# ── metrics_table 빌드 ────────────────────────────────────────────────────────


def _build_metrics_table(summaries: list[VideoSummary]) -> dict[str, list]:
    """각 지표를 영상 순서대로 나열한 metrics_table 딕셔너리를 생성한다."""
    return {
        "duration": [s.duration for s in summaries],
        "scene_count": [s.scene_count for s in summaries],
        "cut_density": [s.cut_density for s in summaries],
        "appeal_count": [s.appeal_count for s in summaries],
        "attention_avg": [s.attention_avg for s in summaries],
        "attention_min": [s.attention_min for s in summaries],
        "attention_max": [s.attention_max for s in summaries],
        "first_appeal_time": [s.first_appeal_time for s in summaries],
        "time_to_cta": [s.time_to_cta for s in summaries],
        "product_focus_ratio": [s.product_focus_ratio for s in summaries],
        "text_readability": [s.text_readability for s in summaries],
        "info_density": [s.info_density for s in summaries],
        "retention_score": [s.retention_score for s in summaries],
    }


# ── 패턴 분석 ─────────────────────────────────────────────────────────────────


def _find_patterns(summaries: list[VideoSummary]) -> list[str]:
    """주어진 영상 목록에서 공통 패턴을 추출한다."""
    if not summaries:
        return []

    patterns = []

    # 평균 집중도
    avg_attn = sum(s.attention_avg for s in summaries) / len(summaries)
    patterns.append(f"평균 집중도: {avg_attn:.0f}/100")

    # 평균 컷 밀도
    avg_cut = sum(s.cut_density for s in summaries) / len(summaries)
    patterns.append(f"평균 컷 밀도: {avg_cut:.2f}컷/초")

    # 공통 소구 유형
    all_types: list[str] = []
    for s in summaries:
        all_types.extend(s.appeal_types)
    if all_types:
        counter = Counter(all_types)
        threshold = len(summaries)  # 모든 영상에 나타나는 유형
        common = [t for t, c in counter.items() if c >= threshold]
        if common:
            patterns.append(f"공통 소구 유형: {', '.join(common)}")

    # 평균 retention_score
    avg_ret = sum(s.retention_score for s in summaries) / len(summaries)
    patterns.append(f"평균 유지율: {avg_ret:.0f}/100")

    # 소구 첫 등장 시간
    avg_first_appeal = sum(s.first_appeal_time for s in summaries) / len(summaries)
    patterns.append(f"첫 소구 등장 평균: {avg_first_appeal:.1f}초")

    return patterns


def _find_key_differentiators(
    success: list[VideoSummary],
    failure: list[VideoSummary],
) -> list[str]:
    """성공/실패 그룹 간 핵심 차이점을 찾는다."""
    if not success or not failure:
        return []

    diffs = []

    def avg(lst: list, key: str) -> float:
        vals = [getattr(s, key) for s in lst]
        return sum(vals) / len(vals) if vals else 0.0

    # 집중도 비교
    s_attn = avg(success, "attention_avg")
    f_attn = avg(failure, "attention_avg")
    if abs(s_attn - f_attn) >= 5:
        winner = "성공" if s_attn > f_attn else "실패"
        diffs.append(f"집중도: 성공 {s_attn:.0f} vs 실패 {f_attn:.0f} → {winner} 영상이 높음")

    # retention_score 비교
    s_ret = avg(success, "retention_score")
    f_ret = avg(failure, "retention_score")
    if abs(s_ret - f_ret) >= 5:
        diffs.append(f"시청 유지율: 성공 {s_ret:.0f} vs 실패 {f_ret:.0f}")

    # 컷 밀도 비교
    s_cut = avg(success, "cut_density")
    f_cut = avg(failure, "cut_density")
    if abs(s_cut - f_cut) >= 0.1:
        diffs.append(f"컷 밀도: 성공 {s_cut:.2f}/초 vs 실패 {f_cut:.2f}/초")

    # 소구 수 비교
    s_ap = avg(success, "appeal_count")
    f_ap = avg(failure, "appeal_count")
    if abs(s_ap - f_ap) >= 2:
        diffs.append(f"소구 수: 성공 {s_ap:.0f}개 vs 실패 {f_ap:.0f}개")

    # 정보 밀도 비교
    s_id = avg(success, "info_density")
    f_id = avg(failure, "info_density")
    if abs(s_id - f_id) >= 0.3:
        diffs.append(f"정보 밀도: 성공 {s_id:.2f} vs 실패 {f_id:.2f}")

    # 첫 소구 등장 시간 비교
    s_fat = avg(success, "first_appeal_time")
    f_fat = avg(failure, "first_appeal_time")
    if abs(s_fat - f_fat) >= 1.0:
        faster = "성공" if s_fat < f_fat else "실패"
        diffs.append(f"첫 소구 등장: 성공 {s_fat:.1f}초 vs 실패 {f_fat:.1f}초 → {faster} 영상이 빠름")

    return diffs


def _find_winning_combinations(success: list[VideoSummary]) -> list[str]:
    """성공 영상에서 자주 등장하는 소구 조합 패턴을 찾는다."""
    if not success:
        return []

    # 각 성공 영상의 소구 시퀀스에서 bigram 추출
    bigrams: list[str] = []
    for s in success:
        seq = s.dominant_appeal_sequence
        for i in range(len(seq) - 1):
            bigrams.append(f"{seq[i]} → {seq[i+1]}")

    if not bigrams:
        return []

    counter = Counter(bigrams)
    # 2회 이상 등장하거나 상위 5개
    results = [combo for combo, cnt in counter.most_common(5) if cnt >= 1]
    return results


# ── 인사이트 생성 ──────────────────────────────────────────────────────────────


def _generate_insights(
    summaries: list[VideoSummary],
    success: list[VideoSummary],
    failure: list[VideoSummary],
) -> list[ComparisonInsight]:
    """비교 분석 결과에서 인사이트를 생성한다."""
    insights: list[ComparisonInsight] = []

    if not summaries:
        return insights

    # ── 집중도 인사이트 ──────────────────────────────────────────────────────
    attn_vals = [s.attention_avg for s in summaries]
    best_attn = max(summaries, key=lambda s: s.attention_avg)
    worst_attn = min(summaries, key=lambda s: s.attention_avg)

    if len(summaries) > 1 and (max(attn_vals) - min(attn_vals)) >= 10:
        insights.append(ComparisonInsight(
            category="attention",
            finding=f"집중도 편차 큼: 최고 {best_attn.attention_avg} ({best_attn.video_name}) vs 최저 {worst_attn.attention_avg} ({worst_attn.video_name})",
            evidence=f"영상별 평균 집중도: {', '.join(f'{s.video_name}={s.attention_avg}' for s in summaries)}",
            recommendation="집중도 높은 영상의 컷 리듬과 소구 배치 전략을 참조할 것",
        ))

    # ── 소구 인사이트 ────────────────────────────────────────────────────────
    all_appeal_types: list[str] = []
    for s in summaries:
        all_appeal_types.extend(s.appeal_types)
    if all_appeal_types:
        top_appeal = Counter(all_appeal_types).most_common(1)[0][0]
        insights.append(ComparisonInsight(
            category="appeal",
            finding=f"가장 빈번한 소구 유형: {top_appeal}",
            evidence=f"전체 소구 빈도: {dict(Counter(all_appeal_types).most_common(5))}",
            recommendation=f"'{top_appeal}' 소구를 핵심 전략으로 강화하고, 감성 소구와 병행 사용 권장",
        ))

    # ── 구조 인사이트 ────────────────────────────────────────────────────────
    cut_vals = [s.cut_density for s in summaries]
    if len(summaries) > 1 and (max(cut_vals) - min(cut_vals)) >= 0.2:
        fastest = max(summaries, key=lambda s: s.cut_density)
        insights.append(ComparisonInsight(
            category="structure",
            finding=f"컷 편집 속도 차이: {fastest.video_name}이 가장 빠름 ({fastest.cut_density:.2f}컷/초)",
            evidence=f"영상별 컷 밀도: {', '.join(f'{s.video_name}={s.cut_density:.2f}' for s in summaries)}",
            recommendation="타겟 집중도 구간(훅/클라이막스)에서 빠른 컷 편집 적용 권장",
        ))

    # ── 성공 vs 실패 인사이트 ────────────────────────────────────────────────
    if success and failure:
        s_ret = sum(s.retention_score for s in success) / len(success)
        f_ret = sum(s.retention_score for s in failure) / len(failure)
        insights.append(ComparisonInsight(
            category="structure",
            finding=f"성공 영상의 시청 유지율이 {s_ret - f_ret:.0f}점 높음 (성공: {s_ret:.0f} vs 실패: {f_ret:.0f})",
            evidence=f"성공={[s.retention_score for s in success]}, 실패={[s.retention_score for s in failure]}",
            recommendation="이탈 위험 구간 개선과 강한 훅으로 초기 시청 유지율 확보",
        ))

    # ── 아트워크 인사이트 ────────────────────────────────────────────────────
    art_styles = [s.art_style for s in summaries if s.art_style and s.art_style != "알 수 없음"]
    if art_styles:
        insights.append(ComparisonInsight(
            category="artwork",
            finding=f"아트 스타일 다양성: {len(set(art_styles))}가지",
            evidence=f"스타일 목록: {'; '.join(f'{s.video_name}: {s.art_style}' for s in summaries if s.art_style)}",
            recommendation="상위 성과 영상의 톤앤매너를 브랜드 아이덴티티로 표준화 고려",
        ))

    return insights


# ── 메인 비교 함수 ─────────────────────────────────────────────────────────────


def compare_videos(
    paths: list[str | Path],
    labels: Optional[list[str]] = None,
) -> VideoComparison:
    """N개의 영상 recipe 경로를 받아 VideoComparison을 반환한다.

    Args:
        paths: video recipe JSON 파일 경로 또는 output 디렉토리 경로 목록
        labels: 각 영상에 대한 레이블 목록 ("success" / "failure" / None)

    Returns:
        VideoComparison 객체
    """
    if labels and len(labels) != len(paths):
        raise ValueError(f"labels 수({len(labels)})와 paths 수({len(paths)})가 다릅니다")

    # 레이블 준비
    label_list: list[Optional[str]] = labels if labels else [None] * len(paths)

    # 각 영상 로드 + VideoSummary 추출
    summaries: list[VideoSummary] = []
    for path, label in zip(paths, label_list):
        video_name, recipe = _load_recipe(path)
        summary = _extract_summary(video_name, recipe, label=label)
        summaries.append(summary)
        print(f"  ✓ {video_name} (label={label}, attn={summary.attention_avg}, retention={summary.retention_score})")

    # 성공/실패 그룹 분리
    success = [s for s in summaries if s.label == "success"]
    failure = [s for s in summaries if s.label == "failure"]

    # metrics_table 빌드
    metrics_table = _build_metrics_table(summaries)

    # 패턴 분석
    success_patterns = _find_patterns(success)
    failure_patterns = _find_patterns(failure)
    key_differentiators = _find_key_differentiators(success, failure)

    # 소구 빈도 집계
    all_appeal_types: list[str] = []
    for s in summaries:
        all_appeal_types.extend(s.appeal_types)
    appeal_frequency = dict(Counter(all_appeal_types))

    # 성공 영상 winning combinations
    winning_combinations = _find_winning_combinations(success)

    # 인사이트 생성
    insights = _generate_insights(summaries, success, failure)

    return VideoComparison(
        videos=summaries,
        metrics_table=metrics_table,
        success_patterns=success_patterns,
        failure_patterns=failure_patterns,
        key_differentiators=key_differentiators,
        appeal_frequency=appeal_frequency,
        winning_combinations=winning_combinations,
        insights=insights,
    )
