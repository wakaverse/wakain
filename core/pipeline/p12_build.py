"""P12: BUILD — RecipeJSON 조립 (로컬 전용, API 호출 없음).

전체 Phase 결과를 RecipeJSON으로 조립.
R1에서는 P1/P2/P7/P8/P9/P10이 없으므로, 있는 것만 조립하고 나머지는 기본값.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from core.schemas.enums import (
    AttentionArc,
    Category,
    ColorTone,
    CutRhythm,
    EnergyProfile,
    FaceExposure,
    HookStrength,
    HumanPresenceType,
    Platform,
    RiskLevel,
    ShotType,
    TempoLevel,
    TextUsage,
    VoiceType,
)
from core.schemas.pipeline import (
    EngageOutput,
    MergeOutput,
    P6Output,
    ProductOutput,
    ScanOutput,
    ScriptOutput,
    STTOutput,
    TemporalOutput,
)
from collections import Counter

from core.schemas.enums import RiskLevel
from core.schemas.recipe import (
    MetaAudio,
    MetaHumanPresence,
    MetaMusic,
    MetaSfx,
    MetaVoice,
    PipelineInfo,
    RecipeAttentionCurve,
    RecipeAttentionPoint,
    RecipeClaim,
    RecipeDropoff,
    RecipeEngagement,
    RecipeIdentity,
    RecipeJSON,
    RecipeMeta,
    RecipeProduct,
    RecipeProduction,
    RecipeRetention,
    RecipeRhythm,
    RecipeScene,
    RecipeScript,
    RecipeStyleInfo,
    RecipeSummary,
    RecipeVisual,
    RecipeVisualForm,
)

logger = logging.getLogger(__name__)

_RISK_LEVEL_PRIORITY = {RiskLevel.LOW: 1, RiskLevel.MEDIUM: 2, RiskLevel.HIGH: 3}


def _time_overlaps(range_a: list[float], range_b: list[float]) -> bool:
    """두 [start, end] 구간이 겹치는지 판별."""
    return range_a[0] < range_b[1] and range_b[0] < range_a[1]


def _find_risk_level(
    time_range: list[float],
    risk_zones: list,
) -> str | None:
    """time_range와 겹치는 risk_zones 중 가장 높은 risk_level 반환."""
    max_priority = 0
    max_level: RiskLevel | None = None
    for zone in risk_zones:
        if _time_overlaps(time_range, zone.time_range):
            p = _RISK_LEVEL_PRIORITY.get(zone.risk_level, 0)
            if p > max_priority:
                max_priority = p
                max_level = zone.risk_level
    return max_level.value if max_level else None


def _build_product(p2_output: ScanOutput | None, p7_output: ProductOutput | None) -> RecipeProduct:
    """제품 축 조립."""
    # P7 claims → RecipeClaim 변환
    claims = []
    if p7_output:
        claims = [
            RecipeClaim(
                claim=c.claim,
                type=c.type,
                layer=c.layer,
                verifiable=c.verifiable,
                time_range=c.time_range,
                source=c.source,
            )
            for c in p7_output.claims
        ]

    if p2_output:
        return RecipeProduct(
            category=p2_output.product.category,
            category_ko=p2_output.product.category_ko,
            sub_category=p2_output.product.sub_category,
            sub_category_ko=p2_output.product.sub_category_ko,
            name=p2_output.product.name,
            brand=p2_output.product.brand,
            multi_product=p2_output.product.multi_product,
            is_marketing_video=p2_output.is_marketing_video,
            claims=claims,
        )
    return RecipeProduct(
        category=Category.OTHER,
        category_ko="기타",
        sub_category="unknown",
        sub_category_ko="미분류",
        is_marketing_video=True,
        claims=claims,
    )


def _build_script(
    p10_output: ScriptOutput | None,
    p1_output: STTOutput | None = None,
    p9_output: EngageOutput | None = None,
) -> RecipeScript:
    """대본 축 조립 + P1 utterance 매칭 + P9 dropoff risk 매핑."""
    if p10_output:
        from core.schemas.recipe import RecipeAlpha, RecipeAlphaSummary, RecipeBlock, RecipeUtterance

        # P9 risk_zones 준비
        risk_zones = p9_output.dropoff_analysis.risk_zones if p9_output else []

        blocks = []
        for block in p10_output.blocks:
            block_alpha = RecipeAlpha(
                emotion=block.alpha.emotion,
                structure=block.alpha.structure,
                connection=block.alpha.connection,
            )

            # P10 utterances (기존 로직 유지)
            utterances = [
                RecipeUtterance(
                    text=u.text,
                    time_range=u.time_range,
                    alpha=RecipeAlpha(
                        emotion=u.alpha.emotion,
                        structure=u.alpha.structure,
                        connection=u.alpha.connection,
                    ),
                )
                for u in block.utterances
            ]

            # P1 STT segments → utterance 추가 (P10 utterances가 비어있을 때)
            if not utterances and p1_output:
                for seg in p1_output.segments:
                    seg_range = [seg.start, seg.end]
                    if _time_overlaps(seg_range, block.time_range):
                        utterances.append(
                            RecipeUtterance(
                                text=seg.text,
                                time_range=seg_range,
                                alpha=block_alpha,
                            )
                        )

            # dropoff risk 매핑
            dropoff_risk = _find_risk_level(block.time_range, risk_zones)

            blocks.append(
                RecipeBlock(
                    block=block.block,
                    text=block.text,
                    time_range=block.time_range,
                    benefit_sub=block.benefit_sub,
                    product_claim_ref=block.product_claim_ref,
                    alpha=block_alpha,
                    utterances=utterances,
                    dropoff_risk=dropoff_risk,
                )
            )
        return RecipeScript(
            blocks=blocks,
            flow_order=p10_output.flow_order,
            alpha_summary=RecipeAlphaSummary(
                emotion=p10_output.alpha_summary.emotion,
                structure=p10_output.alpha_summary.structure,
                connection=p10_output.alpha_summary.connection,
            ),
        )
    return RecipeScript()


def _build_visual(
    p6_output: P6Output | None,
    p5_output: TemporalOutput | None,
    p11_output: MergeOutput | None,
    p9_output: EngageOutput | None = None,
) -> RecipeVisual:
    """영상 축 조립."""
    scenes: list[RecipeScene] = []
    style_distribution: dict[str, float] = {}
    style_primary: str | None = None
    style_secondary: str | None = None

    # P9 risk_zones 준비
    risk_zones = p9_output.dropoff_analysis.risk_zones if p9_output else []

    # P11이 있으면 P11의 MergedScene 사용, 없으면 P6에서 직접 변환
    if p11_output:
        for ms in p11_output.scenes:
            visual_forms = []
            for vf in ms.visual_forms:
                if isinstance(vf, dict):
                    visual_forms.append(RecipeVisualForm(**vf))
                else:
                    visual_forms.append(
                        RecipeVisualForm(form=vf.form, method=vf.method, target=vf.target)
                    )
            scenes.append(
                RecipeScene(
                    scene_id=ms.scene_id,
                    time_range=ms.time_range,
                    duration=ms.duration,
                    style=ms.style,
                    style_sub=ms.style_sub,
                    role=ms.role,
                    visual_forms=visual_forms,
                    production=RecipeProduction(
                        dominant_shot_type=ms.production.dominant_shot_type,
                        dominant_color_tone=ms.production.dominant_color_tone,
                        text_usage=ms.production.text_usage,
                    ),
                    description=ms.description,
                    matched_blocks=ms.matched_blocks,
                    dropoff_risk=_find_risk_level(ms.time_range, risk_zones),
                )
            )
        style_distribution = p11_output.style_distribution
        style_primary = p11_output.style_primary
        style_secondary = p11_output.style_secondary
    elif p6_output:
        for s in p6_output.scenes:
            scenes.append(
                RecipeScene(
                    scene_id=s.scene_id,
                    time_range=s.time_range,
                    duration=s.duration,
                    style=s.style,
                    style_sub=s.style_sub,
                    role=s.role,
                    production=RecipeProduction(
                        dominant_shot_type=s.production.dominant_shot_type,
                        dominant_color_tone=s.production.dominant_color_tone,
                        text_usage=s.production.text_usage,
                    ),
                    description=s.description,
                    dropoff_risk=_find_risk_level(s.time_range, risk_zones),
                )
            )

    # P5 rhythm
    rhythm: RecipeRhythm | None = None
    if p5_output:
        attention_points = [
            RecipeAttentionPoint(t=p.t, score=p.score)
            for p in p5_output.attention_curve.points
        ]
        rhythm = RecipeRhythm(
            cut_rhythm=p5_output.cut_rhythm.pattern,
            attention_arc=p5_output.attention_arc,
            tempo_level=p5_output.tempo_level,
            total_cuts=p5_output.total_cuts,
            avg_cut_duration=p5_output.avg_cut_duration,
            attention_curve=RecipeAttentionCurve(
                points=attention_points,
                peak_timestamps=p5_output.attention_curve.peak_timestamps,
                avg=p5_output.attention_curve.avg,
            ),
        )

    return RecipeVisual(
        scenes=scenes,
        style_distribution=style_distribution,
        style_primary=style_primary,
        style_secondary=style_secondary,
        rhythm=rhythm,
    )


def _build_engagement(p9_output: EngageOutput | None) -> RecipeEngagement:
    """인게이지먼트 조립."""
    if p9_output:
        from core.schemas.recipe import (
            RecipeEngageTrigger,
            RecipeHookElement,
            RecipeHookScan,
            RecipeRiskZone,
            RecipeSafeZone,
        )

        # hook_scan 매핑
        hook_scan = None
        src_scan = p9_output.retention_analysis.hook_scan
        if src_scan:
            def _map_element(el) -> RecipeHookElement:
                return RecipeHookElement(
                    appeal_type=el.appeal_type,
                    text_banner=el.text_banner,
                    text_banner_content=el.text_banner_content,
                    person_appear=el.person_appear,
                    product_appear=el.product_appear,
                    sound_change=el.sound_change,
                    cut_count=el.cut_count,
                    dominant_element=el.dominant_element,
                )
            hook_scan = RecipeHookScan(
                first_3s=_map_element(src_scan.first_3s),
                first_8s=_map_element(src_scan.first_8s),
                hook_type=src_scan.hook_type,
                summary=src_scan.summary,
            )

        retention = RecipeRetention(
            hook_strength=p9_output.retention_analysis.hook_strength,
            hook_reason=p9_output.retention_analysis.hook_reason,
            hook_scan=hook_scan,
            rewatch_triggers=[
                RecipeEngageTrigger(time=t.time, trigger=t.trigger)
                for t in p9_output.retention_analysis.rewatch_triggers
            ],
            share_triggers=[
                RecipeEngageTrigger(time=t.time, trigger=t.trigger)
                for t in p9_output.retention_analysis.share_triggers
            ],
            comment_triggers=[
                RecipeEngageTrigger(time=t.time, trigger=t.trigger)
                for t in p9_output.retention_analysis.comment_triggers
            ],
        )
        dropoff = RecipeDropoff(
            risk_zones=[
                RecipeRiskZone(
                    time_range=z.time_range,
                    risk_level=z.risk_level,
                    reason=z.reason,
                )
                for z in p9_output.dropoff_analysis.risk_zones
            ],
            safe_zones=[
                RecipeSafeZone(time_range=z.time_range, reason=z.reason)
                for z in p9_output.dropoff_analysis.safe_zones
            ],
        )
        return RecipeEngagement(retention_analysis=retention, dropoff_analysis=dropoff)

    return RecipeEngagement(
        retention_analysis=RecipeRetention(
            hook_strength=HookStrength.MODERATE,
            hook_reason="분석 데이터 부족 — R2 Gemini Phase 필요",
        ),
        dropoff_analysis=RecipeDropoff(),
    )


def _build_meta(
    p2_output: ScanOutput | None,
    output_language: str = "ko",
    p1_output: STTOutput | None = None,
) -> RecipeMeta:
    """메타 정보 조립."""
    # video_language: STTOutput에 language 필드가 추가되면 활용
    video_language = getattr(p1_output, "language", None) if p1_output else None

    if p2_output:
        m = p2_output.meta
        a = p2_output.audio
        return RecipeMeta(
            platform=m.platform,
            duration=m.duration,
            aspect_ratio=m.aspect_ratio,
            target_audience=m.target_audience,
            product_exposure_pct=m.product_exposure_pct,
            product_first_appear=m.product_first_appear,
            human_presence=MetaHumanPresence(
                has_face=m.human_presence.has_face,
                type=m.human_presence.type,
                face_exposure=m.human_presence.face_exposure,
            ),
            audio=MetaAudio(
                music=MetaMusic(
                    present=a.music.present,
                    genre=a.music.genre,
                    energy_profile=a.music.energy_profile,
                ),
                voice=MetaVoice(type=a.voice.type, tone=a.voice.tone),
                sfx=MetaSfx(used=a.sfx.used, types=a.sfx.types),
            ),
            output_language=output_language,
            video_language=video_language,
        )
    return RecipeMeta(
        platform=Platform.REELS,
        duration=0.0,
        aspect_ratio="9:16",
        target_audience="일반",
        product_exposure_pct=0,
        product_first_appear=0.0,
        human_presence=MetaHumanPresence(
            has_face=False,
            type=HumanPresenceType.NONE,
            face_exposure=FaceExposure.NONE,
        ),
        audio=MetaAudio(
            music=MetaMusic(present=False),
            voice=MetaVoice(type=VoiceType.NONE),
            sfx=MetaSfx(used=False),
        ),
        output_language=output_language,
        video_language=video_language,
    )


_BLOCK_KO = {
    "hook": "훅", "benefit": "장점", "demo": "시연", "cta": "행동유도",
    "pain_point": "고민제기", "social_proof": "사회적증거", "differentiation": "차별점",
    "authority": "전문가", "experience": "경험", "spec": "기능", "trust": "신뢰",
    "value": "가치", "proof": "증거", "promotion": "할인/혜택",
}

_CLAIM_TYPE_KO = {
    "composition": "성분/원료", "function": "기능/효과", "experience": "체험/후기",
    "trust": "신뢰/권위", "value": "가격/가치", "comparison": "비교/차별",
}

_STYLE_KO = {
    "demo": "데모", "review": "리뷰", "problem_solution": "문제해결",
    "before_after": "전후비교", "story": "스토리", "listicle": "리스트",
    "trend_ride": "트렌드", "promotion": "프로모션", "sensory": "감성",
    "explanation": "설명", "visual": "시각적",
}


def _summarize_flow(flow_order: list) -> str:
    """flow_order를 한국어 요약 (연속 동일 블록은 ×N)."""
    if not flow_order:
        return ""
    groups: list[tuple[str, int]] = []
    for block_type in flow_order:
        val = block_type.value if hasattr(block_type, "value") else str(block_type)
        if groups and groups[-1][0] == val:
            groups[-1] = (val, groups[-1][1] + 1)
        else:
            groups.append((val, 1))
    parts = []
    for val, count in groups:
        ko = _BLOCK_KO.get(val, val)
        if count > 1:
            parts.append(f"{ko}×{count}")
        else:
            parts.append(ko)
    return "→".join(parts)


def _build_identity(p2_output: ScanOutput | None) -> RecipeIdentity:
    """제품/영상 정체성 조립 — P02 SCAN 결과에서 추출."""
    if p2_output:
        return RecipeIdentity(
            category=p2_output.product.category,
            category_ko=p2_output.product.category_ko,
            sub_category=p2_output.product.sub_category,
            sub_category_ko=p2_output.product.sub_category_ko,
            name=p2_output.product.name,
            brand=p2_output.product.brand,
            is_marketing_video=p2_output.is_marketing_video,
            platform=p2_output.meta.platform,
            target_audience=p2_output.meta.target_audience,
        )
    return RecipeIdentity(
        category=Category.OTHER,
        category_ko="기타",
        sub_category="unknown",
        sub_category_ko="미분류",
        is_marketing_video=True,
        platform=Platform.REELS,
        target_audience="일반",
    )


def _build_style_info(p11_output: MergeOutput | None) -> RecipeStyleInfo:
    """영상 스타일 요약 — P11 MERGE 결과에서 추출."""
    if p11_output:
        return RecipeStyleInfo(
            primary=p11_output.style_primary,
            secondary=p11_output.style_secondary,
            distribution=p11_output.style_distribution,
        )
    return RecipeStyleInfo()


def _build_strategy(
    p11_output: MergeOutput | None,
    p5_output: TemporalOutput | None,
    p7_output: ProductOutput | None = None,
    p10_output: ScriptOutput | None = None,
) -> str:
    """전략 요약 생성 (한국어): "{소구유형} 중심 {스타일}형. {구조흐름} 구조." """
    # claims_top_type → 한국어
    claims_top_type_ko: str | None = None
    if p7_output and p7_output.claims:
        type_counter = Counter(c.type.value for c in p7_output.claims)
        top_type = type_counter.most_common(1)[0][0]
        claims_top_type_ko = _CLAIM_TYPE_KO.get(top_type, top_type)

    # style_primary → 한국어
    style_ko: str | None = None
    if p11_output and p11_output.style_primary:
        sp = p11_output.style_primary.value if hasattr(p11_output.style_primary, "value") else str(p11_output.style_primary)
        style_ko = _STYLE_KO.get(sp, sp)

    # flow_summary (이미 한국어)
    flow_summary: str | None = None
    if p10_output and p10_output.flow_order:
        flow_summary = _summarize_flow(p10_output.flow_order)

    # 조립
    if claims_top_type_ko and style_ko and flow_summary:
        return f"{claims_top_type_ko} 중심 {style_ko}형. {flow_summary} 구조."

    parts = []
    if claims_top_type_ko:
        parts.append(f"{claims_top_type_ko} 중심")
    if style_ko:
        parts.append(f"{style_ko}형")
    if flow_summary:
        parts.append(f"{flow_summary} 구조")
    if p5_output:
        tempo_ko = {"fast": "빠름", "medium": "보통", "slow": "느림"}.get(
            p5_output.tempo_level.value if hasattr(p5_output.tempo_level, "value") else str(p5_output.tempo_level), "보통")
        parts.append(f"템포: {tempo_ko}")
    if parts:
        return " / ".join(parts) + "."
    return "분석 데이터 부족"


async def run(
    p5_output: TemporalOutput | None = None,
    p6_output: P6Output | None = None,
    p11_output: MergeOutput | None = None,
    p1_output: STTOutput | None = None,
    p2_output: ScanOutput | None = None,
    p7_output: ProductOutput | None = None,
    p9_output: EngageOutput | None = None,
    p10_output: ScriptOutput | None = None,
    output_language: str = "ko",
) -> RecipeJSON:
    """P12 실행: 전체 Phase 결과 → RecipeJSON.

    Args:
        p5_output: P5 시간축 분석 (Optional)
        p6_output: P6 씬 집계 (Optional)
        p11_output: P11 병합 (Optional)
        p1_output: P1 STT (R2)
        p2_output: P2 SCAN (R2)
        p7_output: P7 PRODUCT (R2)
        p9_output: P9 ENGAGE (R2)
        p10_output: P10 SCRIPT (R2)

    Returns:
        RecipeJSON
    """
    logger.info("P12 BUILD 시작")

    visual = _build_visual(p6_output, p5_output, p11_output, p9_output)

    recipe = RecipeJSON(
        summary=RecipeSummary(strategy=_build_strategy(p11_output, p5_output, p7_output, p10_output)),
        identity=_build_identity(p2_output),
        style=_build_style_info(p11_output),
        scenes=visual.scenes,
        product=_build_product(p2_output, p7_output),
        script=_build_script(p10_output, p1_output, p9_output),
        visual=visual,
        engagement=_build_engagement(p9_output),
        meta=_build_meta(p2_output, output_language, p1_output),
        pipeline=PipelineInfo(
            schema_version="2.0",
            analyzed_at=datetime.now(timezone.utc),
        ),
    )

    logger.info(
        "P12 BUILD 완료: schema=%s, scenes=%d",
        recipe.schema_version,
        len(recipe.visual.scenes),
    )
    return recipe


async def run_and_save(
    output_dir: Path | str | None = None,
    **kwargs,
) -> RecipeJSON:
    """run() 실행 후 결과를 JSON 파일로 저장."""
    result = await run(**kwargs)
    if output_dir:
        out_path = Path(output_dir) / "recipe.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            result.model_dump_json(indent=2),
            encoding="utf-8",
        )
        logger.info("P12 saved to %s", out_path)
    return result
