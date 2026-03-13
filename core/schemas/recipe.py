"""WakaLab V2 RecipeJSON — 최종 recipe_json 스키마 (3축 구조)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from core.schemas.evaluation import EvaluationOutput
from core.schemas.enums import (
    AttentionArc,
    BlockType,
    BenefitSub,
    Category,
    ClaimLayer,
    ClaimSource,
    ClaimType,
    ColorTone,
    CutRhythm,
    EnergyProfile,
    FaceExposure,
    HookStrength,
    HumanPresenceType,
    PersuasionStrategy,
    Platform,
    RiskLevel,
    ShotType,
    TempoLevel,
    TextUsage,
    VisualForm,
    VoiceType,
)


# ── Summary ───────────────────────────────────────────────────────────────


class RecipeSummary(BaseModel):
    strategy: str = Field(description="핵심 전략 1~2문장 요약 (P12 생성)")


# ── Product (제품 축) ─────────────────────────────────────────────────────


class RecipeClaim(BaseModel):
    claim: str = Field(description="제품 특징/주장")
    type: ClaimType = Field(description="소비자 질문 분류")
    layer: ClaimLayer = Field(description="객관성 층위")
    verifiable: bool = Field(description="검증 가능 여부")
    time_range: list[float] = Field(description="[시작, 종료]")
    source: ClaimSource = Field(description="소스")
    # 2계층 — 설득 번역
    translation: str | None = Field(default=None, description="소비자 경험으로 번역된 표현")
    strategy: PersuasionStrategy | None = Field(default=None, description="설득 전략 유형")


class RecipeProduct(BaseModel):
    category: Category = Field(description="대분류")
    category_ko: str = Field(description="대분류 한글명")
    sub_category: str = Field(description="소분류")
    sub_category_ko: str = Field(description="소분류 한글명")
    name: str | None = Field(default=None, description="제품명")
    brand: str | None = Field(default=None, description="브랜드")
    multi_product: bool = Field(default=False, description="복수 제품 여부")
    is_marketing_video: bool = Field(default=True, description="마케팅 영상 여부")
    claims: list[RecipeClaim] = Field(default_factory=list, description="제품 특징 목록 (P7)")


# ── Script (대본 축) ──────────────────────────────────────────────────────


class RecipeAlpha(BaseModel):
    emotion: str | None = Field(default=None, description="감정 기법")
    structure: str | None = Field(default=None, description="구조 기법")
    connection: str | None = Field(default=None, description="연결 기법")


class RecipeUtterance(BaseModel):
    text: str = Field(description="발화 텍스트")
    time_range: list[float] = Field(description="[시작, 종료]")
    alpha: RecipeAlpha = Field(description="화법 기법")


class RecipeBlock(BaseModel):
    block: BlockType = Field(description="블록 유형")
    text: str = Field(description="블록 전체 텍스트")
    time_range: list[float] = Field(description="[시작, 종료]")
    benefit_sub: BenefitSub | None = Field(default=None, description="베네핏 하위")
    product_claim_ref: str | None = Field(default=None, description="연결된 제품 특징")
    alpha: RecipeAlpha = Field(description="대표 화법")
    utterances: list[RecipeUtterance] = Field(default_factory=list, description="발화 단위 (P12 STT 매칭)")
    matched_scenes: list[int] = Field(default_factory=list, description="매칭 씬 ID (P11)")
    dropoff_risk: str | None = Field(default=None, description="이탈 위험 (P12)")


class RecipeAlphaSummary(BaseModel):
    emotion: dict[str, int] = Field(default_factory=dict, description="감정 기법 빈도")
    structure: dict[str, int] = Field(default_factory=dict, description="구조 기법 빈도")
    connection: dict[str, int] = Field(default_factory=dict, description="연결 기법 빈도")


class RecipeScript(BaseModel):
    blocks: list[RecipeBlock] = Field(default_factory=list, description="대본 블록 목록")
    flow_order: list[BlockType] = Field(default_factory=list, description="블록 배치 순서")
    alpha_summary: RecipeAlphaSummary = Field(
        default_factory=RecipeAlphaSummary, description="화법 요약"
    )


# ── Visual (영상 축) ──────────────────────────────────────────────────────


class RecipeVisualForm(BaseModel):
    form: VisualForm = Field(description="소구형태")
    method: str = Field(description="세부 방식")
    target: str = Field(description="대상/내용")


class RecipeProduction(BaseModel):
    dominant_shot_type: ShotType = Field(description="지배적 샷 타입")
    dominant_color_tone: ColorTone = Field(description="지배적 색감")
    text_usage: TextUsage = Field(description="텍스트 사용량")


class RecipeScene(BaseModel):
    scene_id: int = Field(description="씬 인덱스")
    time_range: list[float] = Field(description="[시작, 종료]")
    duration: float = Field(description="씬 길이 (초)")
    style: str | None = Field(default=None, description="영상 스타일 (P8)")
    style_sub: str | None = Field(default=None, description="스타일 하위 (P8)")
    role: str | None = Field(default=None, description="씬 역할 (P8)")
    visual_forms: list[RecipeVisualForm] = Field(default_factory=list, description="소구형태 (P8)")
    production: RecipeProduction = Field(description="연출 집계 (P6)")
    description: str | None = Field(default=None, description="씬 설명 (P8)")
    matched_blocks: list[str] = Field(default_factory=list, description="매칭 블록 유형 (P11)")
    dropoff_risk: str | None = Field(default=None, description="이탈 위험 (P12)")


class RecipeAttentionPoint(BaseModel):
    t: float = Field(description="시간 (초)")
    score: int = Field(description="어텐션 점수 (0~100)")


class RecipeAttentionCurve(BaseModel):
    points: list[RecipeAttentionPoint] = Field(description="어텐션 곡선 포인트")
    peak_timestamps: list[float] = Field(default_factory=list, description="피크 타임스탬프")
    avg: int = Field(default=0, description="평균 어텐션 점수")


class RecipeRhythm(BaseModel):
    cut_rhythm: CutRhythm = Field(description="컷 리듬")
    attention_arc: AttentionArc = Field(description="어텐션 아크")
    tempo_level: TempoLevel = Field(description="템포 레벨")
    total_cuts: int = Field(description="총 컷 수")
    avg_cut_duration: float = Field(description="평균 컷 길이 (초)")
    attention_curve: RecipeAttentionCurve = Field(description="어텐션 곡선")


class RecipeVisual(BaseModel):
    scenes: list[RecipeScene] = Field(default_factory=list, description="씬 목록")
    style_distribution: dict[str, float] = Field(
        default_factory=dict, description="스타일 분포 (P11)"
    )
    style_primary: str | None = Field(default=None, description="1위 스타일 (P11)")
    style_secondary: str | None = Field(default=None, description="2위 스타일 (P11)")
    rhythm: RecipeRhythm | None = Field(default=None, description="리듬 정보 (P5)")


# ── Engagement ────────────────────────────────────────────────────────────


class RecipeEngageTrigger(BaseModel):
    time: float = Field(description="시간 (초)")
    trigger: str = Field(description="트리거 설명")


class RecipeHookElement(BaseModel):
    appeal_type: str | None = Field(default=None, description="소구점 유형")
    text_banner: bool = Field(default=False, description="텍스트 배너 유무")
    text_banner_content: str | None = Field(default=None, description="배너 내용")
    person_appear: bool = Field(default=False, description="인물 등장 유무")
    product_appear: bool = Field(default=False, description="제품 직접 노출 유무")
    sound_change: bool = Field(default=False, description="효과음/BGM 변화 유무")
    cut_count: int = Field(default=0, description="화면 전환 횟수")
    dominant_element: str = Field(default="", description="가장 지배적인 요소")


class RecipeHookScan(BaseModel):
    first_3s: RecipeHookElement = Field(description="0~3초 구간 요소 분석")
    first_8s: RecipeHookElement = Field(description="0~8초 구간 요소 분석")
    hook_type: str = Field(description="후킹 유형 분류")
    summary: str = Field(description="후킹 전략 1줄 요약")


class RecipeRetention(BaseModel):
    hook_strength: HookStrength = Field(description="훅 강도")
    hook_reason: str = Field(description="훅 강도 근거")
    hook_scan: RecipeHookScan | None = Field(default=None, description="후킹 구간 2단 분해 (3초+8초)")
    rewatch_triggers: list[RecipeEngageTrigger] = Field(default_factory=list)
    share_triggers: list[RecipeEngageTrigger] = Field(default_factory=list)
    comment_triggers: list[RecipeEngageTrigger] = Field(default_factory=list)


class RecipeRiskZone(BaseModel):
    time_range: list[float] = Field(description="[시작, 종료]")
    risk_level: RiskLevel = Field(description="위험 수준")
    reason: str = Field(description="이탈 위험 사유")


class RecipeSafeZone(BaseModel):
    time_range: list[float] = Field(description="[시작, 종료]")
    reason: str = Field(description="안전 구간 사유")


class RecipeDropoff(BaseModel):
    risk_zones: list[RecipeRiskZone] = Field(default_factory=list)
    safe_zones: list[RecipeSafeZone] = Field(default_factory=list)


class RecipeEngagement(BaseModel):
    retention_analysis: RecipeRetention = Field(description="리텐션 분석 (P9)")
    dropoff_analysis: RecipeDropoff = Field(description="이탈 분석 (P9)")


# ── Meta ──────────────────────────────────────────────────────────────────


class MetaHumanPresence(BaseModel):
    has_face: bool = Field(description="얼굴 노출 여부")
    type: HumanPresenceType = Field(description="출연 유형")
    face_exposure: FaceExposure = Field(description="얼굴 노출 정도")


class MetaMusic(BaseModel):
    present: bool = Field(description="음악 유무")
    genre: str | None = Field(default=None, description="음악 장르")
    energy_profile: EnergyProfile | None = Field(default=None, description="에너지 프로파일")


class MetaVoice(BaseModel):
    type: VoiceType = Field(description="음성 유형")
    tone: str | None = Field(default=None, description="음성 톤")


class MetaSfx(BaseModel):
    used: bool = Field(description="효과음 사용 여부")
    types: list[str] = Field(default_factory=list, description="효과음 종류")


class MetaAudio(BaseModel):
    music: MetaMusic
    voice: MetaVoice
    sfx: MetaSfx


class RecipeMeta(BaseModel):
    platform: Platform = Field(description="플랫폼")
    duration: float = Field(description="영상 길이 (초)")
    aspect_ratio: str = Field(description="화면 비율")
    target_audience: str = Field(description="타겟 오디언스")
    product_exposure_pct: int = Field(description="제품 노출 비율 (%)")
    product_first_appear: float = Field(description="제품 첫 등장 시간 (초)")
    human_presence: MetaHumanPresence = Field(description="출연자 정보")
    audio: MetaAudio = Field(description="오디오 정보")
    output_language: str = Field(default="ko", description="분석 결과 출력 언어")
    video_language: str | None = Field(default=None, description="STT가 감지한 원본 언어")


# ── Token Usage ───────────────────────────────────────────────────────────


class StageUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""


class TokenUsage(BaseModel):
    stages: dict[str, StageUsage] = Field(default_factory=dict)
    total_input: int = 0
    total_output: int = 0
    estimated_cost_usd: float = 0.0


# ── Pipeline Info ─────────────────────────────────────────────────────────


class PipelineInfo(BaseModel):
    schema_version: str = Field(default="2.0", description="스키마 버전")
    analyzed_at: datetime | None = Field(default=None, description="분석 시각")
    model_versions: dict[str, str] = Field(
        default_factory=dict, description="Phase별 모델 버전"
    )
    token_usage: TokenUsage | None = None


# ── Identity (P2 SCAN에서 추출) ───────────────────────────────────────────


class RecipeIdentity(BaseModel):
    """제품/영상 정체성 — P02 SCAN 결과 요약."""

    category: Category = Field(description="대분류")
    category_ko: str = Field(description="대분류 한글명")
    sub_category: str = Field(description="소분류")
    sub_category_ko: str = Field(description="소분류 한글명")
    name: str | None = Field(default=None, description="제품명")
    brand: str | None = Field(default=None, description="브랜드")
    is_marketing_video: bool = Field(default=True, description="마케팅 영상 여부")
    platform: Platform = Field(description="플랫폼")
    target_audience: str = Field(description="타겟 오디언스")


# ── Style (P11 MERGE에서 추출) ────────────────────────────────────────────


class RecipeStyleInfo(BaseModel):
    """영상 스타일 요약 — P11 MERGE 결과."""

    primary: str | None = Field(default=None, description="1위 스타일")
    secondary: str | None = Field(default=None, description="2위 스타일")
    distribution: dict[str, float] = Field(
        default_factory=dict, description="스타일 분포 {style: ratio}"
    )


# ── RecipeJSON (최종) ─────────────────────────────────────────────────────


class RecipeJSON(BaseModel):
    """WakaLab V2 최종 레시피 스키마. 3축(제품·대본·영상) + engagement + meta."""

    schema_version: str = Field(default="2.0", description="스키마 버전")
    summary: RecipeSummary = Field(description="핵심 전략 요약")
    identity: RecipeIdentity = Field(description="제품/영상 정체성 (P2)")
    style: RecipeStyleInfo = Field(description="영상 스타일 요약 (P11)")
    scenes: list[RecipeScene] = Field(default_factory=list, description="씬 목록 (P6 + P11)")
    product: RecipeProduct = Field(description="제품 축 (P2 + P7)")
    script: RecipeScript = Field(description="대본 축 (P10 + P12)")
    visual: RecipeVisual = Field(description="영상 축 (P6 + P8 + P11)")
    engagement: RecipeEngagement = Field(description="인게이지먼트 (P9)")
    meta: RecipeMeta = Field(description="영상 메타 (P2)")
    evaluation: EvaluationOutput | None = Field(
        default=None, description="영상 코칭 평가 (P13)"
    )
    pipeline: PipelineInfo = Field(
        default_factory=PipelineInfo, description="파이프라인 정보"
    )
