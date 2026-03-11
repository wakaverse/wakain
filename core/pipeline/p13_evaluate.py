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
    ContentPositioning,
    ContrastMechanism,
    EvaluationOutput,
    HookAnalysis,
    Improvement,
    Insight,
    RecipeEval,
    SegmentEval,
    StructureEval,
)
from core.schemas.enums import PersuasionStrategy
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
        evidence=f"제품 첫 등장: {t:.1f}초" if t > 0 else "영상 시작부터 제품 노출",
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
                if vf.form in (VisualForm.EXPLANATION, VisualForm.EVIDENCE):
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
    count = flow.count("benefit")
    return ChecklistItem(
        category="body",
        item="장점/매력 소개",
        passed=passed,
        evidence=f"장점 소개 {count}회 포함" if passed else "장점 소개 구간 없음",
    )


def _check_proof(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "proof" in flow
    return ChecklistItem(
        category="body",
        item="증거/근거 장면",
        passed=passed,
        evidence="근거 제시 구간 있음" if passed else "근거 제시 구간 없음",
    )


def _check_social_proof(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "social_proof" in flow
    return ChecklistItem(
        category="body",
        item="후기/반응 장면",
        passed=passed,
        evidence="후기·반응 구간 있음" if passed else "후기·반응 구간 없음",
    )


def _check_pain_point(recipe: RecipeJSON) -> ChecklistItem:
    found = False
    for scene in recipe.scenes:
        if scene.role and any(kw in scene.role.lower() for kw in ("pain", "problem")):
            found = True
            break
    return ChecklistItem(
        category="body",
        item="공감 장면 ('이런 고민 있죠?')",
        passed=found,
        evidence="고민/문제 공감 장면 있음" if found else "고민/문제 공감 장면 없음",
    )


def _check_style_diversity(recipe: RecipeJSON) -> ChecklistItem:
    n = len(recipe.visual.style_distribution)
    return ChecklistItem(
        category="body",
        item="다양한 영상 스타일 (2종 이상)",
        passed=n >= 2,
        evidence=f"{n}가지 스타일 사용" if n >= 2 else "1가지 스타일만 사용",
    )


def _check_cta_exists(recipe: RecipeJSON) -> ChecklistItem:
    flow = [b.value if hasattr(b, "value") else str(b) for b in recipe.script.flow_order]
    passed = "cta" in flow
    return ChecklistItem(
        category="cta",
        item="행동 유도 (구매/댓글/팔로우)",
        passed=passed,
        evidence="행동 유도 구간 있음" if passed else "행동 유도 구간 없음",
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
        item="마감/긴급 멘트",
        passed=passed,
        evidence=f"'{', '.join(found_in)}' 키워드 사용" if found_in else "마감·긴급 키워드 없음",
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
                 "text": b.text,
                 "utterances": [
                     {"text": u.text, "time_range": list(u.time_range)}
                     for u in b.utterances
                 ]}
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
        "script_alpha_summary": recipe.script.alpha_summary.model_dump(mode="json") if hasattr(recipe.script, "alpha_summary") and recipe.script.alpha_summary else {},
        "engagement": {
            "hook_strength": recipe.engagement.retention_analysis.hook_strength.value
            if hasattr(recipe.engagement.retention_analysis.hook_strength, "value")
            else str(recipe.engagement.retention_analysis.hook_strength),
            "hook_reason": recipe.engagement.retention_analysis.hook_reason or "",
        },
        "product_exposure_pct": recipe.meta.product_exposure_pct if hasattr(recipe.meta, "product_exposure_pct") else 0,
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
  "summary": "영상 전략 요약 2~3줄. 이 영상이 무엇을 하고 있는지, 어떤 전략으로 설득하는지 서술.",
  "positioning": {{
    "unique_angle": "이 영상의 차별화된 접근 각도 (1~2문장). 예: '일상의 불편함에서 시작해 하나의 제품으로 해결하는 경험 공유'",
    "storytelling_format": "스토리텔링 포맷명 (예: 문제해결 리뷰, Before/After, 언박싱, 체험기, 비교 리뷰, 튜토리얼...)",
    "why_it_works": "이 포맷이 이 제품/카테고리에서 왜 효과적인지 2~3문장",
    "contrast": {{
      "common_belief": "시청자의 일반적 통념 (예: '브라탑은 지지력이 약해서 외출용이 아니다')",
      "contrarian_reality": "이 영상이 보여주는 반전 (예: '이 브라탑은 속옷 없이도 외출 가능할 정도로 안정적')"
    }}
  }},
  "hook_analysis": {{
    "strength": "strong/moderate/weak",
    "reason": "훅 강도 판단 이유 1~2문장",
    "title_hook_alignment": "영상 제목(또는 첫 자막)과 훅의 정합성 평가 1~2문장",
    "product_appear_sec": 0.5,
    "first_3s_energy": "첫 3초 시각 에너지 평가 (예: '정적인 제품 샷으로 시작하여 에너지 낮음')"
  }},
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
  }},
  "claim_translations": [
    {{
      "claim_text": "원본 claim 텍스트 (product.claims에서 가져온 것)",
      "translation": "이 스펙이 영상에서 소비자 경험으로 어떻게 번역되었는지 (예: '세라마이드 3종 함유' → '세수 후에도 당기지 않는 촉촉함')",
      "strategy": "experience_shift | loss_aversion | info_preempt | social_evidence | price_anchor"
    }}
  ]
}}

## Guidelines
- Consider the product category when judging. What works for food differs from tech.
- For strengths: explain WHY it's effective for THIS product.
- For improvements: explain WHY it's needed and WHAT specifically to do.
- Keep insights actionable and specific, not generic.
- Each section should have 1-3 items.
- recipe_eval.current should reflect the actual flow_order.
- For claim_translations: analyze how each product claim (spec/fact) was translated into
  consumer experience in the video. Strategies:
  - experience_shift: 스펙→일상 경험으로 전환 ("세라마이드 3종" → "세수 후 촉촉함")
  - loss_aversion: 안 사면 손해 ("이거 안 쓰면 피부 건조해질 수 있어요")
  - info_preempt: 정보 선점→신뢰 구축 ("성분표 직접 보여드릴게요")
  - social_evidence: 타인 반응/후기 ("댓글에 다들 재구매한다고...")
  - price_anchor: 가격 비교/앵커링 ("백화점 제품 반값")
  - If no translation is evident in the video, skip that claim.
- Respond in {output_language}.

## Tone & Language (IMPORTANT)
- You are a professional video coach. Use polite, practical coaching tone (존댓말).
- NEVER use marketing jargon directly. Always translate to plain language:
  - "사회적 증거" → "실제 후기나 반응 장면"
  - "pain_point" → "'이런 고민 있죠?' 하는 공감 장면"
  - "긴급성 요소" → "'오늘까지만' 같은 마감 멘트"
  - "CTA" → "행동 유도 (구매/댓글/팔로우 등)"
  - "hook" → "첫 장면 (시선 끌기)"
  - "benefit" → "장점/매력 소개"
  - "proof" → "증거/근거 장면"
  - "social_proof" → "후기/반응 장면"
  - "differentiation" → "차별점 강조"
  - "authority" → "전문가/신뢰 요소"
- Write as if explaining to a creator who is smart but not a marketing professor.
- Be specific and actionable: "~하면 좋습니다" not "~를 고려하세요".
"""


# ── LLM 호출 ──────────────────────────────────────────────────────────────


def _extract_usage(response) -> dict:
    """Gemini response에서 usage_metadata 추출."""
    usage = {"input_tokens": 0, "output_tokens": 0, "model": MODEL}
    meta = getattr(response, "usage_metadata", None)
    if meta:
        usage["input_tokens"] = getattr(meta, "prompt_token_count", 0) or 0
        usage["output_tokens"] = getattr(meta, "candidates_token_count", 0) or 0
    return usage


async def _call_llm(
    recipe: RecipeJSON,
    checklist: list[ChecklistItem],
    structure: StructureEval,
    api_key: str | None = None,
) -> tuple[dict[str, Any], dict]:
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

    return json.loads(response.text), _extract_usage(response)


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


_VALID_STRATEGIES = {s.value for s in PersuasionStrategy}


def _apply_claim_translations(recipe: RecipeJSON, translations: list[dict]) -> None:
    """LLM claim_translations 결과를 recipe.product.claims에 매핑."""
    if not translations:
        return
    # claim_text → (translation, strategy) 매핑
    trans_map: dict[str, tuple[str, str | None]] = {}
    for t in translations:
        ct = t.get("claim_text", "")
        tr = t.get("translation", "")
        st = t.get("strategy")
        if ct and tr:
            trans_map[ct] = (tr, st if st in _VALID_STRATEGIES else None)

    for claim in recipe.product.claims:
        match = trans_map.get(claim.claim)
        if match:
            claim.translation = match[0]
            if match[1]:
                claim.strategy = PersuasionStrategy(match[1])


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
) -> tuple[EvaluationOutput, dict]:
    """P13 실행: recipe_json → EvaluationOutput.

    Args:
        recipe: P12 빌드 완료된 RecipeJSON
        api_key: Gemini API key (None이면 환경변수)

    Returns:
        (EvaluationOutput, usage_dict)
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
    llm_result, usage = await _call_llm(recipe, checklist, structure, api_key)
    logger.info("LLM 코칭 완료")

    # 4. claim 설득 번역 매핑
    _apply_claim_translations(recipe, llm_result.get("claim_translations", []))

    # 5. 조립
    structure.hook.strengths = _parse_insights(llm_result.get("hook_strengths", []))
    structure.hook.improvements = _parse_improvements(llm_result.get("hook_improvements", []))
    structure.body.strengths = _parse_insights(llm_result.get("body_strengths", []))
    structure.body.improvements = _parse_improvements(llm_result.get("body_improvements", []))
    structure.cta.strengths = _parse_insights(llm_result.get("cta_strengths", []))
    structure.cta.improvements = _parse_improvements(llm_result.get("cta_improvements", []))

    re = llm_result.get("recipe_eval", {})

    # 포지셔닝 파싱
    pos_data = llm_result.get("positioning", {})
    contrast_data = pos_data.get("contrast")
    positioning = ContentPositioning(
        unique_angle=pos_data.get("unique_angle", ""),
        storytelling_format=pos_data.get("storytelling_format", ""),
        why_it_works=pos_data.get("why_it_works", ""),
        contrast=ContrastMechanism(
            common_belief=contrast_data.get("common_belief", ""),
            contrarian_reality=contrast_data.get("contrarian_reality", ""),
        ) if contrast_data else None,
    )

    # 훅 분석 파싱
    hook_data = llm_result.get("hook_analysis", {})
    hook_analysis = HookAnalysis(
        strength=hook_data.get("strength", "moderate"),
        reason=hook_data.get("reason", ""),
        title_hook_alignment=hook_data.get("title_hook_alignment", ""),
        product_appear_sec=hook_data.get("product_appear_sec", recipe.meta.product_first_appear),
        first_3s_energy=hook_data.get("first_3s_energy", ""),
    )

    re = llm_result.get("recipe_eval", {})

    output = EvaluationOutput(
        summary=llm_result.get("summary", ""),
        positioning=positioning,
        hook_analysis=hook_analysis,
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
    return output, usage
