"""P13 Evaluation — 영상 코칭 스키마.

"분석 결과 나열"이 아닌 "영상 코칭"을 위한 평가 레이어.
- 체크리스트: 규칙 기반 (데이터로 판단, LLM 불필요)
- 강점/개선: LLM 맥락 판단 (제품 카테고리 × 영상 구조)
- 나중에 카테고리별 데이터 기반 판단으로 전환 가능한 구조
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── 체크리스트 (규칙 기반, LLM 불필요) ─────────────────────────────────────


class ChecklistItem(BaseModel):
    """데이터 기반 팩트 체크. passed는 규칙으로 판단."""

    category: str = Field(description="hook | body | cta | overall")
    item: str = Field(description="체크 항목 (한국어)")
    passed: bool = Field(description="충족 여부")
    evidence: str = Field(description="판단 근거 (데이터 참조)")


# ── 인사이트 (LLM 맥락 판단) ──────────────────────────────────────────────


class Insight(BaseModel):
    """강점 또는 개선 포인트. 맥락 판단 포함."""

    fact: str = Field(description="팩트 (데이터에서 확인된 것)")
    comment: str = Field(description="맥락 판단 (왜 이게 중요한지)")
    related_scenes: list[int] = Field(
        default_factory=list, description="관련 씬 ID"
    )


class Improvement(Insight):
    """개선 포인트. Insight + 제안."""

    suggestion: str = Field(description="구체적 개선 제안")


# ── 구간 평가 (Hook / Body / CTA) ────────────────────────────────────────


class SegmentEval(BaseModel):
    """Hook / Body / CTA 각 구간 평가."""

    time_range: list[float] = Field(description="[시작, 종료]")
    scene_ids: list[int] = Field(default_factory=list, description="해당 구간 씬 ID")
    block_types: list[str] = Field(
        default_factory=list, description="해당 구간 블록 유형 (hook, benefit, proof...)"
    )
    strengths: list[Insight] = Field(default_factory=list, description="강점")
    improvements: list[Improvement] = Field(
        default_factory=list, description="개선 포인트"
    )


class StructureEval(BaseModel):
    """Hook → Body → CTA 3단 구조 평가."""

    hook: SegmentEval = Field(description="Hook 구간 평가")
    body: SegmentEval = Field(description="Body 구간 평가")
    cta: SegmentEval = Field(description="CTA 구간 평가")


# ── 레시피 평가 ───────────────────────────────────────────────────────────


class RecipeEval(BaseModel):
    """현재 레시피 vs 개선 제안."""

    current: list[str] = Field(description="현재 블록 순서")
    suggestion: str = Field(description="개선 제안 (한국어)")
    reason: str = Field(description="제안 이유 (한국어)")


# ── 콘텐츠 포지셔닝 ──────────────────────────────────────────────────────


class ContrastMechanism(BaseModel):
    """통념 vs 반전 대비 구조."""

    common_belief: str = Field(description="시청자의 일반적 통념")
    contrarian_reality: str = Field(description="이 영상이 보여주는 반전")


class ContentPositioning(BaseModel):
    """콘텐츠 포지셔닝 분석."""

    unique_angle: str = Field(description="이 영상의 차별화된 접근 각도 (1~2문장)")
    storytelling_format: str = Field(description="스토리텔링 포맷 (예: 문제해결 리뷰, Before/After, 언박싱...)")
    why_it_works: str = Field(description="이 포맷이 왜 효과적인지 (2~3문장)")
    contrast: ContrastMechanism | None = Field(
        default=None, description="대비 구조 (없으면 None)"
    )


# ── 훅 분석 ──────────────────────────────────────────────────────────────


class HookAnalysis(BaseModel):
    """훅 상세 분석."""

    strength: str = Field(description="strong / moderate / weak")
    reason: str = Field(description="훅 강도 판단 이유 (1~2문장)")
    title_hook_alignment: str = Field(
        description="제목과 훅의 정합성 평가 (1~2문장)"
    )
    product_appear_sec: float = Field(description="제품 첫 등장 (초)")
    first_3s_energy: str = Field(description="첫 3초 시각 에너지 평가")


# ── P13 최종 출력 ─────────────────────────────────────────────────────────


class EvaluationOutput(BaseModel):
    """P13 evaluation 최종 출력. recipe_json.evaluation에 저장."""

    # 한 줄 요약
    summary: str = Field(
        description="영상 코칭 한 줄 요약 (한국어). "
        "예: '먹음직스러운 장면이 잘 살아있어요. 실제 후기 장면을 넣으면 신뢰감이 더 올라갑니다.'"
    )

    # 콘텐츠 포지셔닝 (신규)
    positioning: ContentPositioning = Field(description="콘텐츠 포지셔닝 분석")

    # 훅 분석 (신규)
    hook_analysis: HookAnalysis = Field(description="훅 상세 분석")

    # Hook / Body / CTA 구조 평가
    structure: StructureEval = Field(description="3단 구조 평가")

    # 체크리스트 (규칙 기반)
    checklist: list[ChecklistItem] = Field(
        default_factory=list, description="데이터 기반 체크리스트"
    )

    # 종합 강점 & 개선 포인트
    strengths: list[Insight] = Field(
        default_factory=list, description="종합 강점"
    )
    improvements: list[Improvement] = Field(
        default_factory=list, description="종합 개선 포인트"
    )

    # 레시피 평가
    recipe_eval: RecipeEval = Field(description="레시피 평가 + 개선 제안")

    # 씬별 한줄 평가 (P13 LLM 생성)
    scene_evaluations: dict[str, str] = Field(
        default_factory=dict,
        description="씬 ID → 한줄 평가 (30~50자)",
    )

    # 핵심 설득 한 문장
    core_persuasion: str = Field(
        default="",
        description="이 영상의 전체 소구를 한 문장으로 압축",
    )
