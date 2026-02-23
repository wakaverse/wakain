"""리포트 생성기 / Report Generator.

VideoRecipe를 받아 markdown / telegram / summary 형식의 리포트를 생성한다.
Generates formatted reports from a VideoRecipe in multiple formats.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.schemas import VideoRecipe


# ── Recipe 로드 헬퍼 ──────────────────────────────────────────────────────────


def load_recipe(path: str | Path) -> tuple[str, VideoRecipe]:
    """recipe JSON 파일을 로드하고 (video_name, VideoRecipe) 튜플을 반환한다."""
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    raw = data.get("video_recipe", data)
    recipe = VideoRecipe.model_validate(raw)
    video_name = p.name.replace("_video_recipe.json", "")
    return video_name, recipe


# ── Markdown 리포트 ───────────────────────────────────────────────────────────


def _fmt_table_row(label: str, value: str, width: int = 25) -> str:
    return f"| {label:<{width}} | {value} |"


def generate_markdown(video_name: str, recipe: VideoRecipe) -> str:
    """전체 상세 리포트를 마크다운 형식으로 생성한다."""
    lines: list[str] = []

    # ── 헤더 ─────────────────────────────────────────────────────────────────
    lines.append(f"# 📊 Video Analysis Report: {video_name}\n")

    # ── 기본 정보 ─────────────────────────────────────────────────────────────
    lines.append("## 기본 정보\n")
    meta = recipe.meta
    vs = recipe.visual_style
    pm = recipe.performance_metrics
    lines.append(f"- **플랫폼**: {meta.platform}")
    lines.append(f"- **길이**: {meta.duration}초")
    lines.append(f"- **비율**: {meta.aspect_ratio}")
    lines.append(f"- **카테고리**: {meta.category} / {meta.sub_category}")
    lines.append(f"- **타겟 오디언스**: {meta.target_audience}")
    lines.append(f"- **씬 수**: {len(recipe.scenes)}")

    cut_density = pm.cut_density if pm else (round(vs.total_cuts / meta.duration, 3) if meta.duration > 0 else 0)
    lines.append(f"- **컷 밀도**: {cut_density:.2f}컷/초 (총 {vs.total_cuts}컷)")
    lines.append(f"- **구조 유형**: {recipe.structure.type}")
    lines.append("")

    # ── 소구 분석 ─────────────────────────────────────────────────────────────
    lines.append("## 🎯 소구 분석 (Appeal Analysis)\n")
    pa = recipe.persuasion_analysis
    if pa:
        lines.append(f"**발표자**: {pa.presenter.type} | 얼굴 노출: {'예' if pa.presenter.face_shown else '아니오'}")
        lines.append(f"**비디오 스타일**: {pa.video_style.type}{' — ' + pa.video_style.sub_style if pa.video_style.sub_style else ''}")
        lines.append(f"**핵심 소구**: {pa.primary_appeal}")
        lines.append(f"**소구 전략**: {pa.persuasion_summary}")
        lines.append("")
        lines.append(f"**소구 포인트 ({len(pa.appeal_points)}개)**\n")
        for i, ap in enumerate(pa.appeal_points, 1):
            ts = f"@{ap.visual_proof.timestamp:.1f}s" if ap.visual_proof.timestamp is not None else ""
            lines.append(f"{i}. **[{ap.type}]** {ap.claim} {ts}")
            lines.append(f"   - 시각 증거: {ap.visual_proof.description} ({ap.visual_proof.technique})")
            lines.append(f"   - 강도: {ap.strength} | 오디오 싱크: {ap.audio_sync}")
    else:
        lines.append("*소구 분석 데이터 없음*")
    lines.append("")

    # ── 집중도 분석 ───────────────────────────────────────────────────────────
    lines.append("## 📈 집중도 분석 (Attention Analysis)\n")
    tp = recipe.temporal_profile
    if pm or tp:
        attn_avg = pm.attention_avg if pm else 0
        attn_arc = tp.attention_arc if tp else "알 수 없음"
        lines.append(f"- **평균 집중도**: {attn_avg}/100")
        lines.append(f"- **집중도 패턴**: {attn_arc}")

    # scene 집중도 통계
    attn_scores = [s.attention.attention_score for s in recipe.scenes if s.attention]
    attn_peaks = [s.attention.attention_peak for s in recipe.scenes if s.attention]
    if attn_scores:
        lines.append(f"- **최고 씬 집중도**: {max(attn_peaks)}/100")
        lines.append(f"- **최저 씬 집중도**: {min(attn_scores)}/100")
        if pm:
            lines.append(f"- **집중도 저하 구간 수**: {pm.attention_valley_count}개")

    # 이탈 위험 구간
    da = recipe.dropoff_analysis
    if da:
        lines.append(f"\n**시청 유지율**: {da.overall_retention_score}/100\n")
        if da.risk_zones:
            lines.append("**이탈 위험 구간:**\n")
            for zone in da.risk_zones:
                t = zone.time_range
                lines.append(f"- {t[0]:.1f}s ~ {t[1]:.1f}s | 위험도: {zone.risk_level} ({zone.risk_score}/100)")
                lines.append(f"  - 요인: {', '.join(zone.risk_factors)}")
                lines.append(f"  - 제안: {zone.suggestion}")
    lines.append("")

    # ── 씬별 요약 ─────────────────────────────────────────────────────────────
    lines.append("## 🎬 씬별 요약 (Scene Cards)\n")
    if recipe.scene_cards:
        for sc in recipe.scene_cards:
            t = sc.time_range
            lines.append(f"### 씬 {sc.scene_id} — {sc.role} ({t[0]:.1f}s ~ {t[1]:.1f}s, {sc.duration:.1f}s)")
            lines.append(f"- **설명**: {sc.description}")
            lines.append(f"- **집중도**: {sc.attention_score} (피크: {sc.attention_peak}) | {sc.attention_level}")
            lines.append(f"- **컷**: {sc.cut_count}컷, {sc.cut_rhythm}")
            if sc.appeal_points:
                ap_types = [str(ap.get("type", "")) for ap in sc.appeal_points if isinstance(ap, dict)]
                lines.append(f"- **소구**: {', '.join(ap_types) if ap_types else str(sc.appeal_points)}")
            if sc.text_overlays:
                texts = [t.get("content", "") if isinstance(t, dict) else str(t) for t in sc.text_overlays]
                lines.append(f"- **텍스트**: {' / '.join(t for t in texts if t)}")
            if sc.narration:
                lines.append(f"- **내레이션**: {sc.narration}")
            lines.append(f"- **색상**: {', '.join(sc.color_palette[:3]) if sc.color_palette else '-'}")
            lines.append("")
    else:
        # 일반 scene 목록으로 대체
        for scene in recipe.scenes:
            t = scene.time_range
            role = scene.role
            attn = scene.attention.attention_score if scene.attention else "-"
            lines.append(f"- **씬 {scene.scene_id}** [{role}] {t[0]:.1f}s~{t[1]:.1f}s | 집중도: {attn}")
        lines.append("")

    # ── 아트 디렉션 ───────────────────────────────────────────────────────────
    lines.append("## 🎨 아트 디렉션 (Art Direction)\n")
    ad = recipe.art_direction
    if ad:
        lines.append(f"- **톤앤매너**: {ad.tone_and_manner}")
        lines.append(f"- **헤딩 폰트**: {ad.heading_font}")
        lines.append(f"- **바디 폰트**: {ad.body_font}")
        lines.append(f"- **폰트 컬러**: {', '.join(ad.font_color_system)}")
        lines.append(f"- **강조 방식**: {ad.highlight_method}")
        lines.append(f"- **브랜드 컬러**: {', '.join(ad.brand_colors)}")
        lines.append(f"- **배경 스타일**: {ad.background_style}")
        lines.append(f"- **색조**: {ad.color_temperature}")
        lines.append(f"- **그래픽 스타일**: {ad.graphic_style}")
        lines.append(f"- **반복 요소**: {', '.join(ad.recurring_elements)}")
        lines.append(f"- **텍스트 위치 패턴**: {ad.text_position_pattern}")
        lines.append(f"- **프레임 구성 규칙**: {ad.frame_composition_rule}")
        lines.append(f"- **비주얼 일관성**: {ad.visual_consistency}")
        lines.append(f"- **스타일 레퍼런스**: {ad.style_reference}")
    else:
        lines.append("*아트 디렉션 데이터 없음*")
    lines.append("")

    # ── 퍼포먼스 지표 ─────────────────────────────────────────────────────────
    lines.append("## ⚡ 퍼포먼스 지표 (Performance Metrics)\n")
    if pm:
        lines.append("| 지표 | 값 |")
        lines.append("|---|---|")
        lines.append(f"| 브랜드 노출 시간 | {pm.brand_exposure_sec:.1f}초 |")
        lines.append(f"| 제품 집중 비율 | {pm.product_focus_ratio:.1f}% |")
        lines.append(f"| 텍스트 가독성 점수 | {pm.text_readability_score}/100 |")
        lines.append(f"| 첫 소구 등장 시간 | {pm.time_to_first_appeal:.1f}초 |")
        cta_str = f"{pm.time_to_cta:.1f}초" if pm.time_to_cta is not None else "N/A"
        lines.append(f"| CTA 등장 시간 | {cta_str} |")
        lines.append(f"| 정보 밀도 | {pm.info_density:.2f} |")
        lines.append(f"| 소구 수 | {pm.appeal_count}개 |")
        lines.append(f"| 소구 다양성 | {pm.appeal_diversity}종 |")
        lines.append(f"| 컷 밀도 | {pm.cut_density:.3f}컷/초 |")
        lines.append(f"| 평균 집중도 | {pm.attention_avg}/100 |")
        lines.append(f"| 집중도 저하 구간 | {pm.attention_valley_count}개 |")
    else:
        lines.append("*퍼포먼스 지표 데이터 없음*")
    lines.append("")

    # ── 개선 제안 ─────────────────────────────────────────────────────────────
    lines.append("## 💡 개선 제안 (Improvement Suggestions)\n")
    suggestions: list[str] = []

    if da and da.improvement_priority:
        suggestions.extend(da.improvement_priority)

    if da and da.risk_zones:
        for zone in da.risk_zones:
            if zone.suggestion and zone.suggestion not in suggestions:
                suggestions.append(f"[{zone.time_range[0]:.1f}s~{zone.time_range[1]:.1f}s] {zone.suggestion}")

    ea = recipe.effectiveness_assessment
    if ea and ea.weak_points:
        for wp in ea.weak_points:
            if wp not in suggestions:
                suggestions.append(f"약점 개선: {wp}")

    if suggestions:
        for i, s in enumerate(suggestions, 1):
            lines.append(f"{i}. {s}")
    else:
        lines.append("*개선 제안 데이터 없음*")
    lines.append("")

    return "\n".join(lines)


# ── Telegram 리포트 (최대 4096자) ─────────────────────────────────────────────


def generate_telegram(video_name: str, recipe: VideoRecipe) -> str:
    """텔레그램용 간결 리포트를 생성한다 (최대 4096자)."""
    lines: list[str] = []
    meta = recipe.meta
    pm = recipe.performance_metrics
    vs = recipe.visual_style
    da = recipe.dropoff_analysis
    pa = recipe.persuasion_analysis

    # 헤더
    lines.append(f"📊 *{video_name}* 분석 결과\n")

    # 기본 정보
    lines.append("📋 *기본 정보*")
    lines.append(f"• 길이: {meta.duration}초 | 씬: {len(recipe.scenes)}개")
    cut_density = pm.cut_density if pm else (round(vs.total_cuts / meta.duration, 3) if meta.duration > 0 else 0)
    lines.append(f"• 컷 밀도: {cut_density:.2f}컷/초 | 구조: {recipe.structure.type}")
    lines.append(f"• 플랫폼: {meta.platform} | 카테고리: {meta.category}")
    lines.append("")

    # 소구 분석
    lines.append("🎯 *소구 분석*")
    if pa:
        lines.append(f"• 소구 수: {len(pa.appeal_points)}개 | 핵심: {pa.primary_appeal}")
        lines.append(f"• 스타일: {pa.video_style.type}")
        lines.append(f"• 전략: {pa.persuasion_summary}")
        # 상위 3개 소구
        for ap in pa.appeal_points[:3]:
            ts = f"@{ap.visual_proof.timestamp:.0f}s" if ap.visual_proof.timestamp is not None else ""
            lines.append(f"  ▸ [{ap.type}] {ap.claim[:40]}{'...' if len(ap.claim) > 40 else ''} {ts}")
    else:
        lines.append("• 소구 분석 데이터 없음")
    lines.append("")

    # 집중도
    lines.append("📈 *집중도*")
    attn_avg = pm.attention_avg if pm else 0
    tp = recipe.temporal_profile
    attn_arc = tp.attention_arc if tp else "-"
    lines.append(f"• 평균: {attn_avg}/100 | 패턴: {attn_arc}")

    attn_scores = [s.attention.attention_score for s in recipe.scenes if s.attention]
    attn_peaks = [s.attention.attention_peak for s in recipe.scenes if s.attention]
    if attn_scores:
        lines.append(f"• 최고: {max(attn_peaks)} | 최저: {min(attn_scores)}")

    if da:
        lines.append(f"• 유지율: {da.overall_retention_score}/100")
        if da.worst_zone:
            wz = da.worst_zone
            t = wz.time_range
            lines.append(f"• ⚠️ 최고 위험구간: {t[0]:.1f}s~{t[1]:.1f}s ({wz.risk_level})")
    lines.append("")

    # 아트 디렉션
    ad = recipe.art_direction
    if ad:
        lines.append("🎨 *아트 디렉션*")
        lines.append(f"• 톤: {ad.tone_and_manner}")
        lines.append(f"• 스타일: {ad.graphic_style} | 색조: {ad.color_temperature}")
        lines.append("")

    # 개선 제안 (상위 3개)
    lines.append("💡 *개선 제안 (Top 3)*")
    suggestions: list[str] = []
    if da and da.improvement_priority:
        suggestions.extend(da.improvement_priority[:3])
    if len(suggestions) < 3 and da and da.risk_zones:
        for zone in da.risk_zones:
            if zone.suggestion and zone.suggestion not in suggestions:
                suggestions.append(zone.suggestion)
                if len(suggestions) >= 3:
                    break
    ea = recipe.effectiveness_assessment
    if len(suggestions) < 3 and ea and ea.weak_points:
        for wp in ea.weak_points:
            if wp not in suggestions:
                suggestions.append(wp)
                if len(suggestions) >= 3:
                    break

    for i, s in enumerate(suggestions[:3], 1):
        lines.append(f"{i}. {s}")

    result = "\n".join(lines)

    # 4096자 제한
    if len(result) > 4096:
        result = result[:4093] + "..."
    return result


# ── Summary 리포트 (한 단락) ──────────────────────────────────────────────────


def generate_summary(video_name: str, recipe: VideoRecipe) -> str:
    """1단락 요약 리포트를 생성한다 (핵심 지표 + 강점 + 약점)."""
    meta = recipe.meta
    pm = recipe.performance_metrics
    vs = recipe.visual_style
    da = recipe.dropoff_analysis
    pa = recipe.persuasion_analysis
    ea = recipe.effectiveness_assessment

    # 기본 지표
    duration = meta.duration
    scene_count = len(recipe.scenes)
    cut_density = pm.cut_density if pm else round(vs.total_cuts / duration, 3) if duration > 0 else 0
    attn_avg = pm.attention_avg if pm else 0
    appeal_cnt = len(pa.appeal_points) if pa else 0
    retention = da.overall_retention_score if da else 0

    # 강점
    strengths: list[str] = []
    if ea and ea.standout_elements:
        strengths.extend(ea.standout_elements[:2])
    if not strengths and pa:
        strengths.append(f"'{pa.primary_appeal}' 소구 전략")

    # 약점
    weaknesses: list[str] = []
    if ea and ea.weak_points:
        weaknesses.extend(ea.weak_points[:1])
    if not weaknesses and da and da.improvement_priority:
        weaknesses.extend(da.improvement_priority[:1])

    strength_str = ", ".join(strengths) if strengths else "없음"
    weakness_str = ", ".join(weaknesses) if weaknesses else "없음"

    summary = (
        f"'{video_name}'은 {duration:.0f}초 분량의 {meta.platform} 마케팅 영상으로, "
        f"{scene_count}개 씬에 걸쳐 {appeal_cnt}개의 소구 포인트를 전달하며 "
        f"컷 밀도 {cut_density:.2f}컷/초, 평균 집중도 {attn_avg}/100, "
        f"시청 유지율 {retention}/100을 기록했다. "
        f"주요 강점으로는 {strength_str}이 꼽히며, "
        f"개선 과제로는 {weakness_str}이 식별되었다."
    )
    return summary


# ── 메인 진입점 ───────────────────────────────────────────────────────────────


def generate_report(
    recipe_path: str | Path,
    fmt: str = "markdown",
) -> str:
    """recipe JSON 경로를 받아 지정된 형식의 리포트 문자열을 반환한다.

    Args:
        recipe_path: *_video_recipe.json 파일 경로
        fmt: "markdown" | "telegram" | "summary"

    Returns:
        포맷된 리포트 문자열
    """
    video_name, recipe = load_recipe(recipe_path)

    if fmt == "markdown":
        return generate_markdown(video_name, recipe)
    elif fmt == "telegram":
        return generate_telegram(video_name, recipe)
    elif fmt == "summary":
        return generate_summary(video_name, recipe)
    else:
        raise ValueError(f"지원하지 않는 포맷: {fmt}. 'markdown', 'telegram', 'summary' 중 선택하세요")
