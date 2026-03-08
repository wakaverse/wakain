"""WakaLab V2 Pipeline 스키마 — 각 Phase의 입출력 모델."""

from __future__ import annotations

from pydantic import BaseModel, Field

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
    NarrationType,
    Platform,
    RiskLevel,
    ShotType,
    TempoLevel,
    TextUsage,
    VideoStyle,
    VisualForm,
    VoiceType,
)


# ── P1: STT ───────────────────────────────────────────────────────────────


class STTSegment(BaseModel):
    start: float = Field(description="시작 시간 (초)")
    end: float = Field(description="종료 시간 (초)")
    text: str = Field(description="음성 텍스트")


class STTOutput(BaseModel):
    narration_type: NarrationType = Field(description="나레이션 유형")
    segments: list[STTSegment] = Field(description="타임스탬프 세그먼트")
    full_text: str = Field(description="전체 텍스트")
    total_speech_sec: float = Field(description="총 발화 시간 (초)")


# ── P2: SCAN ──────────────────────────────────────────────────────────────


class ProductInfo(BaseModel):
    category: Category = Field(description="대분류")
    category_ko: str = Field(description="대분류 한글명")
    sub_category: str = Field(description="소분류")
    sub_category_ko: str = Field(description="소분류 한글명")
    name: str | None = Field(default=None, description="제품명")
    brand: str | None = Field(default=None, description="브랜드")
    multi_product: bool = Field(default=False, description="복수 제품 여부")


class HumanPresence(BaseModel):
    has_face: bool = Field(description="얼굴 노출 여부")
    type: HumanPresenceType = Field(description="출연 유형")
    face_exposure: FaceExposure = Field(description="얼굴 노출 정도")


class ScanMeta(BaseModel):
    platform: Platform = Field(description="플랫폼")
    duration: float = Field(description="영상 길이 (초)")
    aspect_ratio: str = Field(description="화면 비율")
    target_audience: str = Field(description="타겟 오디언스")
    product_exposure_pct: int = Field(description="제품 노출 비율 (%)")
    product_first_appear: float = Field(description="제품 첫 등장 시간 (초)")
    human_presence: HumanPresence = Field(description="출연자 정보")


class ScanMusic(BaseModel):
    present: bool = Field(description="음악 유무")
    genre: str | None = Field(default=None, description="음악 장르")
    energy_profile: EnergyProfile | None = Field(default=None, description="에너지 프로파일")


class ScanVoice(BaseModel):
    type: VoiceType = Field(description="음성 유형")
    tone: str | None = Field(default=None, description="음성 톤")


class ScanSfx(BaseModel):
    used: bool = Field(description="효과음 사용 여부")
    types: list[str] = Field(default_factory=list, description="효과음 종류")


class ScanAudio(BaseModel):
    music: ScanMusic
    voice: ScanVoice
    sfx: ScanSfx


class ScanOutput(BaseModel):
    product: ProductInfo = Field(description="제품 정보")
    is_marketing_video: bool = Field(description="마케팅 영상 여부")
    category_confidence: float = Field(description="카테고리 신뢰도 (0~1)")
    meta: ScanMeta = Field(description="영상 메타 정보")
    audio: ScanAudio = Field(description="오디오 정보")
    reasoning: str = Field(description="분류 근거 (한글)")


# ── P3: EXTRACT ───────────────────────────────────────────────────────────


class ExtractFrame(BaseModel):
    timestamp: float = Field(description="프레임 시간 (초)")
    brightness: float = Field(description="밝기 (HSV V 채널 평균)")
    saturation: float = Field(description="채도 (HSV S 채널 평균)")
    edge_diff: float = Field(description="에지 차이 (Sobel 16x16)")
    color_diff: float = Field(description="색상 차이 (RGB 히스토그램)")


class ExtractOutput(BaseModel):
    frames: list[ExtractFrame] = Field(description="프레임별 정량 데이터")
    scene_boundaries: list[list[float]] = Field(description="씬 경계 [[start, end], ...]")
    total_frames: int = Field(description="총 프레임 수")
    fps: int = Field(description="초당 프레임 수")


# ── P4: CLASSIFY ──────────────────────────────────────────────────────────


class ClassifyFrame(BaseModel):
    timestamp: float = Field(description="프레임 시간 (초)")
    shot_type: ShotType = Field(description="샷 타입")
    color_tone: ColorTone = Field(description="색감")
    text_usage: TextUsage = Field(description="텍스트 사용")
    has_text: bool = Field(description="텍스트 유무")
    has_product: bool = Field(description="제품 노출 여부")
    has_person: bool = Field(description="인물 노출 여부")


class ClassifyOutput(BaseModel):
    frames: list[ClassifyFrame] = Field(description="프레임별 정성 분류 결과")


# ── P5: TEMPORAL ──────────────────────────────────────────────────────────


class AttentionPoint(BaseModel):
    t: float = Field(description="시간 (초)")
    score: int = Field(description="어텐션 점수 (0~100)")


class AttentionCurve(BaseModel):
    points: list[AttentionPoint] = Field(description="어텐션 곡선 포인트")
    peak_timestamps: list[float] = Field(description="피크 타임스탬프")
    avg: int = Field(description="평균 어텐션 점수")


class CutRhythmDetail(BaseModel):
    intervals: list[float] = Field(description="컷 간격 (초)")
    pattern: CutRhythm = Field(description="컷 리듬 패턴")
    density_timeline: list[float] = Field(default_factory=list, description="3초 슬라이딩 윈도우 밀도")


class TemporalOutput(BaseModel):
    attention_curve: AttentionCurve = Field(description="어텐션 곡선")
    attention_arc: AttentionArc = Field(description="어텐션 아크")
    cut_rhythm: CutRhythmDetail = Field(description="컷 리듬 상세")
    total_cuts: int = Field(description="총 컷 수")
    avg_cut_duration: float = Field(description="평균 컷 길이 (초)")
    tempo_level: TempoLevel = Field(description="템포 레벨")


# ── P6: SCENE ─────────────────────────────────────────────────────────────


class SceneProduction(BaseModel):
    dominant_shot_type: ShotType = Field(description="지배적 샷 타입")
    dominant_color_tone: ColorTone = Field(description="지배적 색감")
    text_usage: TextUsage = Field(description="텍스트 사용량")


class SceneOutput(BaseModel):
    """P6 씬 집계 출력. style/role/visual_forms/description은 P8에서 채워지며 초기 null."""

    scene_id: int = Field(description="씬 인덱스")
    time_range: list[float] = Field(description="[시작, 종료]")
    duration: float = Field(description="씬 길이 (초)")
    frame_count: int = Field(description="씬 내 프레임 수")
    production: SceneProduction = Field(description="연출 집계")
    style: str | None = Field(default=None, description="영상 스타일 (P8에서 채움)")
    style_sub: str | None = Field(default=None, description="스타일 하위 (P8에서 채움)")
    role: str | None = Field(default=None, description="씬 역할 (P8에서 채움)")
    visual_forms: list[dict] = Field(default_factory=list, description="소구형태 (P8에서 채움)")
    description: str | None = Field(default=None, description="씬 설명 (P8에서 채움)")


class P6Output(BaseModel):
    scenes: list[SceneOutput] = Field(description="씬별 집계 결과")


# ── P7: PRODUCT ───────────────────────────────────────────────────────────


class ProductClaim(BaseModel):
    claim: str = Field(description="제품 특징/주장")
    type: ClaimType = Field(description="소비자 질문 분류")
    layer: ClaimLayer = Field(description="객관성 층위")
    verifiable: bool = Field(description="검증 가능 여부")
    time_range: list[float] = Field(description="[시작, 종료]")
    source: ClaimSource = Field(description="소스 (대본/텍스트/영상)")


class ProductOutput(BaseModel):
    claims: list[ProductClaim] = Field(description="제품 특징 목록")


# ── P8: VISUAL ────────────────────────────────────────────────────────────


class VisualFormItem(BaseModel):
    form: VisualForm = Field(description="소구형태")
    method: str = Field(description="세부 방식")
    target: str = Field(description="대상/내용")


class VisualSceneAnalysis(BaseModel):
    scene_index: int = Field(description="씬 인덱스")
    time_range: list[float] = Field(description="[시작, 종료]")
    style: VideoStyle = Field(description="영상 스타일")
    style_sub: str | None = Field(default=None, description="스타일 하위")
    role: str = Field(description="씬 역할")
    visual_forms: list[VisualFormItem] = Field(description="소구형태 목록")
    description: str = Field(description="씬 설명 (한글)")


class VisualOutput(BaseModel):
    scenes: list[VisualSceneAnalysis] = Field(description="씬별 영상 분석 결과")


# ── P9: ENGAGE ────────────────────────────────────────────────────────────


class EngageTrigger(BaseModel):
    time: float = Field(description="시간 (초)")
    trigger: str = Field(description="트리거 설명")


class RetentionAnalysis(BaseModel):
    hook_strength: HookStrength = Field(description="훅 강도")
    hook_reason: str = Field(description="훅 강도 근거")
    rewatch_triggers: list[EngageTrigger] = Field(default_factory=list, description="재시청 트리거")
    share_triggers: list[EngageTrigger] = Field(default_factory=list, description="공유 트리거")
    comment_triggers: list[EngageTrigger] = Field(default_factory=list, description="댓글 트리거")


class RiskZone(BaseModel):
    time_range: list[float] = Field(description="[시작, 종료]")
    risk_level: RiskLevel = Field(description="위험 수준")
    reason: str = Field(description="이탈 위험 사유")


class SafeZone(BaseModel):
    time_range: list[float] = Field(description="[시작, 종료]")
    reason: str = Field(description="안전 구간 사유")


class DropoffAnalysis(BaseModel):
    risk_zones: list[RiskZone] = Field(default_factory=list, description="이탈 위험 구간")
    safe_zones: list[SafeZone] = Field(default_factory=list, description="안전 구간")


class EngageOutput(BaseModel):
    retention_analysis: RetentionAnalysis = Field(description="리텐션 분석")
    dropoff_analysis: DropoffAnalysis = Field(description="이탈 분석")


# ── P10: SCRIPT ───────────────────────────────────────────────────────────


class AlphaTechnique(BaseModel):
    emotion: str | None = Field(default=None, description="감정 기법")
    structure: str | None = Field(default=None, description="구조 기법")
    connection: str | None = Field(default=None, description="연결 기법")


class ScriptUtterance(BaseModel):
    text: str = Field(description="발화 텍스트")
    time_range: list[float] = Field(description="[시작, 종료]")
    alpha: AlphaTechnique = Field(description="화법 기법")


class ScriptBlock(BaseModel):
    block: BlockType = Field(description="블록 유형")
    text: str = Field(description="블록 전체 텍스트")
    time_range: list[float] = Field(description="[시작, 종료]")
    benefit_sub: BenefitSub | None = Field(default=None, description="베네핏 하위 (benefit일 때만)")
    product_claim_ref: str | None = Field(default=None, description="연결된 제품 특징")
    alpha: AlphaTechnique = Field(description="대표 화법 기법")
    utterances: list[ScriptUtterance] = Field(default_factory=list, description="발화 단위 기법")


class AlphaSummary(BaseModel):
    emotion: dict[str, int] = Field(default_factory=dict, description="감정 기법 빈도")
    structure: dict[str, int] = Field(default_factory=dict, description="구조 기법 빈도")
    connection: dict[str, int] = Field(default_factory=dict, description="연결 기법 빈도")


class ScriptOutput(BaseModel):
    blocks: list[ScriptBlock] = Field(description="대본 블록 목록")
    flow_order: list[BlockType] = Field(description="블록 배치 순서")
    alpha_summary: AlphaSummary = Field(description="화법 요약 (발화 단위 합산)")


# ── P11: MERGE ────────────────────────────────────────────────────────────


class MergedScene(BaseModel):
    scene_id: int = Field(description="씬 인덱스")
    time_range: list[float] = Field(description="[시작, 종료]")
    duration: float = Field(description="씬 길이 (초)")
    frame_count: int = Field(description="프레임 수")
    production: SceneProduction = Field(description="연출 집계")
    style: str | None = Field(default=None, description="영상 스타일")
    style_sub: str | None = Field(default=None, description="스타일 하위")
    role: str | None = Field(default=None, description="씬 역할")
    visual_forms: list[VisualFormItem] = Field(default_factory=list, description="소구형태")
    description: str | None = Field(default=None, description="씬 설명")
    matched_blocks: list[str] = Field(default_factory=list, description="매칭된 블록 유형")


class BlockSceneMapping(BaseModel):
    block_index: int = Field(description="블록 인덱스")
    block_type: BlockType = Field(description="블록 유형")
    matched_scenes: list[int] = Field(description="매칭된 씬 ID 목록")


class MergeOutput(BaseModel):
    scenes: list[MergedScene] = Field(description="병합된 씬 목록")
    style_distribution: dict[str, float] = Field(description="스타일 분포 {style: ratio}")
    style_primary: str | None = Field(default=None, description="1위 스타일")
    style_secondary: str | None = Field(default=None, description="2위 스타일")
    block_scene_mapping: list[BlockSceneMapping] = Field(
        default_factory=list, description="블록-씬 매핑"
    )
