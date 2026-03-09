"""P13: EVALUATE — 영상 코칭 평가.

체크리스트(규칙 기반) + 구조 분석(Hook/Body/CTA) + 강점/개선(LLM).
Gemini Flash 1콜로 LLM 부분 생성.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from google.genai import types

from core.gemini_utils import make_client
from core.schemas.evaluation import (
    ChecklistItem,
    EvaluationOutput,
    Improvement,
    Insight,
    RecipeEval,
    SegmentEval,
    StructureEval,
)
from core.schemas.recipe import RecipeJSON

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"


# ── 체크리스트 (규칙 기반) ─────────────────────────────────────────────────


def _check_product_first_appear(recipe: RecipeJSON) -> ChecklistItem:
    t = recipe.meta.product_first_appear
    return ChecklistItem(
        category="hook",
        item="3초 내 제품 등장",
        passed=t < 3.0,
        evidence=f"product_first_appear: {t:.1f}s",
    )


def _check_visual_energy(recipe: RecipeJSON) -> ChecklistItem:
    rhythm = recipe.visual.rhythm
    if rhythm and rhythm.attention_curve and rhythm.attention_curve.points:
        first3 = rhythm.attention_curve.points[:3]
        avg = sum(p.score for p in first3) / len(first3) if first3 else 0
        passed = avg > 50
        evidence = f"첫 3포인트 평균 어텐션: {avg:.0f}"
    else:
        avg = 0
        passed = False
        evidence = "어텐션 커브 데이터 없음"
    return ChecklistItem(
        category="hook",
        item="시각적 변화 (에너지)",
        passed=passed,
        evidence=evidence,
    )


def _check_text_hook(recipe: RecipeJSON) -> ChecklistItem:
    from core.schemas.enums import VisualForm

    found = False
    evidence_parts: list[str] = []
    for scene in recipe.scenes:
        if scene.role and "hook" in scene.role.lower():
            for vf in scene.visual_forms:
                if vf.form in (VisualForm.EXPLANATION, VisualForm.TEXT_OVERLAY):
                    found = True
                    evidence_parts.append(f"scene {scene.scene_id}: {vf.form.value}")
    return ChecklistItem(
        category="hook",
        item="텍스트/질문 훅",
        passed=found,
        evidence=", ".join(evidence_parts) if evidence_parts else "hook 씬에 텍스트 요소 없음",
    )


def _check_benefit(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "benefit" in flow
    return ChecklistItem(
        category="body",
        item="benefit 블록 존재",
        passed=passed,
        evidence=f"flow_order: {flow}",
    )


def _check_proof(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "proof" in flow
    return ChecklistItem(
        category="body",
        item="proof/evidence 존재",
        passed=passed,
        evidence=f"flow_order: {flow}",
    )


def _check_social_proof(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "social_proof" in flow
    return ChecklistItem(
        category="body",
        item="social_proof 존재",
        passed=passed,
        evidence=f"flow_order: {flow}",
    )


def _check_pain_point(recipe: RecipeJSON) -> ChecklistItem:
    found = False
    for scene in recipe.scenes:
        if scene.role and any(kw in scene.role.lower() for kw in ("pain", "problem")):
            found = True
            break
    return ChecklistItem(
        category="body",
        item="pain_point 존재",
        passed=found,
        evidence="씬 role에서 pain/problem 발견" if found else "pain/problem role 씬 없음",
    )


def _check_style_diversity(recipe: RecipeJSON) -> ChecklistItem:
    n = len(recipe.visual.style_distribution)
    return ChecklistItem(
        category="body",
        item="다양한 영상 스타일 (2종 이상)",
        passed=n >= 2,
        evidence=f"style_distribution 키 수: {n}",
    )


def _check_cta_exists(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "cta" in flow
    return ChecklistItem(
        category="cta",
        item="CTA 블록 존재",
        passed=passed,
        evidence=f"flow_order: {flow}",
    )


def _check_cta_urgency(recipe: RecipeJSON) -> ChecklistItem:
    urgency_keywords = ["한정", "할인", "지금", "오늘", "마감", "특가", "무료", "선착순", "즉시"]
    found_in: list[str] = []
    for block in recipe.script.blocks:
        btype = block.block.value if hasattr(block.block, "value") else str(block.block)
        if btype == "cta":
            for kw in urgency_keywords:
                if kw in block.text:
                    found_in.append(kw)
    passed = len(found_in) > 0
    return ChecklistItem(
        category="cta",
        item="긴급성 요소",
        passed=passed,
        evidence=f"발견 키워드: {found_in}" if found_in else "CTA 텍스트에 긴급성 키워드 없음",
    )


def _build_checklist(recipe: RecipeJSON) -> list[ChecklistItem]:
    return [
        _check_product_first_appear(recipe),
        _check_visual_energy(recipe),
        _check_text_hook(recipe),
        _check_benefit(recipe),
        _check_proof(recipe),
        _check_social_proof(recipe),
        _check_pain_point(recipe),
        _check_style_diversity(recipe),
        _check_cta_exists(recipe),
        _check_cta_urgency(recipe),
    ]


# ── 구조 분석 (Hook/Body/CTA 구간 분리) ───────────────────────────────────


def _time_overlaps(a: list[float], b: list[float]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _build_structure(recipe: RecipeJSON) -> StructureEval:
    """script.blocks의 time_range로 Hook/Body/CTA 구간 분리."""
    blocks = recipe.script.blocks
    if not blocks:
        empty_seg = SegmentEval(time_range=[0, 0])
        return StructureEval(hook=empty_seg, body=empty_seg, cta=empty_seg)

    # Hook: 첫 블록이 hook이면 그 time_range
    first_block = blocks[0]
    first_type = first_block.block.value if hasattr(first_block.block, "value") else str(first_block.block)
    if first_type == "hook":
        hook_range = list(first_block.time_range)
    else:
        hook_range = [0, 0]

    # CTA: 마지막 블록이 cta이면 그 time_range
    last_block = blocks[-1]
    last_type = last_block.block.value if hasattr(last_block.block, "value") else str(last_block.block)
    if last_type == "cta":
        cta_range = list(last_block.time_range)
    else:
        cta_range = [0, 0]

    # Body: Hook 끝 ~ CTA 시작
    body_start = hook_range[1] if hook_range[1] > 0 else (blocks[0].time_range[0] if blocks else 0)
    body_end = cta_range[0] if cta_range[0] > 0 else (blocks[-1].time_range[1] if blocks else 0)
    body_range = [body_start, body_end]

    def _match_scenes(time_range: list[float]) -> list[int]:
        if time_range[0] == 0 and time_range[1] == 0:
            return []
        return [s.scene_id for s in recipe.scenes if _time_overlaps(time_range, list(s.time_range))]

    def _match_block_types(time_range: list[float]) -> list[str]:
        if time_range[0] == 0 and time_range[1] == 0:
            return []
        result = []
        for b in blocks:
            bt = b.block.value if hasattr(b.block, "value") else str(b.block)
            if _time_overlaps(time_range, list(b.time_range)):
                result.append(bt)
        return result

    return StructureEval(
        hook=SegmentEval(
            time_range=hook_range,
            scene_ids=_match_scenes(hook_range),
            block_types=_match_block_types(hook_range),
        ),
        body=SegmentEval(
            time_range=body_range,
            scene_ids=_match_scenes(body_range),
            block_types=_match_block_types(body_range),
        ),
        cta=SegmentEval(
            time_range=cta_range,
            scene_ids=_match_scenes(cta_range),
            block_types=_match_block_types(cta_range),
        ),
    )


# ── Recipe 요약 (토큰 절약) ────────────────────────────────────────────────


def _build_recipe_summary(recipe: RecipeJSON) -> dict:
    """LLM에 전달할 recipe 요약본. 전체 대비 ~85% 토큰 절약."""
    return {
        "identity": {
            "name": recipe.identity.name,
            "brand": recipe.identity.brand,
            "category_ko": recipe.identity.category_ko,
            "sub_category_ko": recipe.identity.sub_category_ko,
            "target_audience": recipe.identity.target_audience,
        },
        "product": {
            "claims": [
                {"type": c.type.value if hasattr(c.type, "value") else str(c.type),
                 "claim": c.claim, "layer": c.layer.value if hasattr(c.layer, "value") else str(c.layer)}
                for c in recipe.product.claims
            ],
        },
        "script": {
            "flow_order": [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order],
            "blocks": [
                {"block": b.block.value if hasattr(b.block, "value") else str(b.block),
                 "time_range": list(b.time_range),
                 "text": b.text}
                for b in recipe.script.blocks
            ],
        },
        "visual": {
            "style_distribution": recipe.visual.style_distribution,
            "style_primary": recipe.visual.style_primary,
        },
        "scenes": [
            {"scene_id": s.scene_id, "time_range": list(s.time_range),
             "style": s.style, "role": s.role,
             "description": s.description or ""}
            for s in recipe.scenes
        ],
        "meta": {
            "duration": recipe.meta.duration,
            "platform": recipe.meta.platform.value if hasattr(recipe.meta.platform, "value") else str(recipe.meta.platform),
            "product_first_appear": recipe.meta.product_first_appear,
        },
        "engagement": {
            "hook_strength": recipe.engagement.retention_analysis.hook_strength.value
            if hasattr(recipe.engagement.retention_analysis.hook_strength, "value")
            else str(recipe.engagement.retention_analysis.hook_strength),
        },
    }


# ── LLM 프롬프트 ──────────────────────────────────────────────────────────

_LLM_PROMPT = """\
You are an expert video marketing coach. Analyze the following recipe_json and checklist results
to provide coaching insights.

## Context
- Product category: {category_ko} > {sub_category_ko}
- Product name: {product_name}
- Platform: {platform}
- Duration: {duration}s
- Output language: {output_language}

## Recipe JSON (summary — key fields only):
{recipe_json}

## Checklist Results (rule-based, already computed):
{checklist_json}

## Structure Analysis (Hook/Body/CTA segments):
{structure_json}

## Your Task
Provide coaching insights in **{output_language}** as JSON with this exact structure:

{{
  "summary": "영상 코칭 한 줄 요약. 예: '감각 자극이 효과적인 식품 프로모션. 사회적 증거 추가 시 설득력 ↑'",
  "hook_strengths": [
    {{"fact": "데이터에서 확인된 팩트", "comment": "왜 이게 이 제품에 효과적인지 맥락 설명", "related_scenes": [0]}}
  ],
  "hook_improvements": [
    {{"fact": "팩트", "comment": "왜 필요한지", "suggestion": "구체적으로 뭘 하면 되는지", "related_scenes": []}}
  ],
  "body_strengths": [],
  "body_improvements": [],
  "cta_strengths": [],
  "cta_improvements": [],
  "overall_strengths": [
    {{"fact": "팩트", "comment": "맥락 설명", "related_scenes": []}}
  ],
  "overall_improvements": [
    {{"fact": "팩트", "comment": "왜 필요한지", "suggestion": "구체적 개선 제안", "related_scenes": []}}
  ],
  "recipe_eval": {{
    "current": ["hook", "benefit", "proof", "cta"],
    "suggestion": "개선 제안 (한국어)",
    "reason": "제안 이유 (한국어)"
  }}
}}

## Guidelines
- Consider the product category when judging. What works for food differs from tech.
- For strengths: explain WHY it's effective for THIS product.
- For improvements: explain WHY it's needed and WHAT specifically to do.
- Keep insights actionable and specific, not generic.
- Each section should have 1-3 items.
- recipe_eval.current should reflect the actual flow_order.
- Respond in {output_language}.
"""


# ── LLM 호출 ──────────────────────────────────────────────────────────────


async def _call_llm(
    recipe: RecipeJSON,
    checklist: list[ChecklistItem],
    structure: StructureEval,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Gemini Flash 1콜로 강점/개선/요약/레시피 평가 생성."""
    client = make_client(api_key)

    # 토큰 절약: recipe_json 전체 대신 요약본 전달 (~85% 절약)
    recipe_summary = _build_recipe_summary(recipe)
    checklist_dicts = [c.model_dump() for c in checklist]
    structure_dict = structure.model_dump(mode="json")

    prompt = _LLM_PROMPT.format(
        category_ko=recipe.identity.category_ko,
        sub_category_ko=recipe.identity.sub_category_ko,
        product_name=recipe.product.name or "알 수 없음",
        platform=recipe.meta.platform.value if hasattr(recipe.meta.platform, "value") else str(recipe.meta.platform),
        duration=recipe.meta.duration,
        output_language=recipe.meta.output_language or "ko",
        recipe_json=json.dumps(recipe_summary, ensure_ascii=False, indent=2),
        checklist_json=json.dumps(checklist_dicts, ensure_ascii=False, indent=2),
        structure_json=json.dumps(structure_dict, ensure_ascii=False, indent=2),
    )

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=[types.Part.from_text(text=prompt)],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    return json.loads(response.text)


# ── 조립 ──────────────────────────────────────────────────────────────────


def _parse_insights(items: list[dict]) -> list[Insight]:
    return [
        Insight(
            fact=i.get("fact", ""),
            comment=i.get("comment", ""),
            related_scenes=i.get("related_scenes", []),
        )
        for i in items
    ]


def _parse_improvements(items: list[dict]) -> list[Improvement]:
    return [
        Improvement(
            fact=i.get("fact", ""),
            comment=i.get("comment", ""),
            suggestion=i.get("suggestion", ""),
            related_scenes=i.get("related_scenes", []),
        )
        for i in items
    ]


async def run(
    recipe: RecipeJSON,
    api_key: str | None = None,
) -> EvaluationOutput:
    """P13 실행: recipe_json → EvaluationOutput.

    Args:
        recipe: P12 빌드 완료된 RecipeJSON
        api_key: Gemini API key (None이면 환경변수)

    Returns:
        EvaluationOutput
    """
    logger.info("P13 EVALUATE 시작")

    # 1. 체크리스트 (규칙 기반)
    checklist = _build_checklist(recipe)
    logger.info("체크리스트 완료: %d items, passed=%d",
                len(checklist), sum(1 for c in checklist if c.passed))

    # 2. 구조 분석
    structure = _build_structure(recipe)
    logger.info("구조 분석 완료: hook=%s, body=%s, cta=%s",
                structure.hook.time_range, structure.body.time_range, structure.cta.time_range)

    # 3. LLM 호출 (강점/개선/요약/레시피 평가)
    llm_result = await _call_llm(recipe, checklist, structure, api_key)
    logger.info("LLM 코칭 완료")

    # 4. 조립
    structure.hook.strengths = _parse_insights(llm_result.get("hook_strengths", []))
    structure.hook.improvements = _parse_improvements(llm_result.get("hook_improvements", []))
    structure.body.strengths = _parse_insights(llm_result.get("body_strengths", []))
    structure.body.improvements = _parse_improvements(llm_result.get("body_improvements", []))
    structure.cta.strengths = _parse_insights(llm_result.get("cta_strengths", []))
    structure.cta.improvements = _parse_improvements(llm_result.get("cta_improvements", []))

    re = llm_result.get("recipe_eval", {})

    output = EvaluationOutput(
        summary=llm_result.get("summary", ""),
        structure=structure,
        checklist=checklist,
        strengths=_parse_insights(llm_result.get("overall_strengths", [])),
        improvements=_parse_improvements(llm_result.get("overall_improvements", [])),
        recipe_eval=RecipeEval(
            current=re.get("current", [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]),
            suggestion=re.get("suggestion", ""),
            reason=re.get("reason", ""),
        ),
    )

    logger.info("P13 EVALUATE 완료")
    return output
