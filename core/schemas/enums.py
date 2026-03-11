"""WakaLab V2 Enum 정의 — StrEnum 기반."""

from enum import StrEnum


# ── 카테고리 대분류 (13종) ─────────────────────────────────────────────────


class Category(StrEnum):
    FOOD = "food"                # 식품
    BEAUTY = "beauty"            # 뷰티
    FASHION = "fashion"          # 패션
    ELECTRONICS = "electronics"  # 전자기기
    HOME = "home"                # 홈/리빙
    HEALTH = "health"            # 건강
    KIDS = "kids"                # 유아/키즈
    PET = "pet"                  # 반려동물
    FNB = "fnb"                  # 외식/카페
    TRAVEL = "travel"            # 여행/숙박
    EDUCATION = "education"      # 교육
    FINANCE = "finance"          # 금융
    OTHER = "other"              # 기타


# ── 카테고리 소분류 (66종) ─────────────────────────────────────────────────


class SubCategoryFood(StrEnum):
    PROCESSED = "processed"
    FRESH = "fresh"
    BEVERAGE = "beverage"
    HEALTH_FOOD = "health_food"
    OTHER = "other"


class SubCategoryBeauty(StrEnum):
    SKINCARE = "skincare"
    MAKEUP = "makeup"
    HAIR = "hair"
    BODY = "body"
    DEVICE = "device"
    OTHER = "other"


class SubCategoryFashion(StrEnum):
    CLOTHING = "clothing"
    SHOES = "shoes"
    BAGS = "bags"
    ACCESSORIES = "accessories"
    SPORTSWEAR = "sportswear"
    OTHER = "other"


class SubCategoryElectronics(StrEnum):
    MOBILE = "mobile"
    COMPUTER = "computer"
    AUDIO = "audio"
    CAMERA = "camera"
    APPLIANCE = "appliance"
    GAMING = "gaming"
    OTHER = "other"


class SubCategoryHome(StrEnum):
    FURNITURE = "furniture"
    INTERIOR = "interior"
    KITCHEN = "kitchen"
    CLEANING = "cleaning"
    BEDDING = "bedding"
    OTHER = "other"


class SubCategoryHealth(StrEnum):
    FITNESS = "fitness"
    DIET = "diet"
    SUPPLEMENT = "supplement"
    MEDICAL = "medical"
    MENTAL = "mental"
    OTHER = "other"


class SubCategoryKids(StrEnum):
    BABY = "baby"
    TOY = "toy"
    EDUCATION = "education"
    CLOTHING = "clothing"
    OTHER = "other"


class SubCategoryPet(StrEnum):
    FOOD = "food"
    SUPPLIES = "supplies"
    HEALTH = "health"
    OTHER = "other"


class SubCategoryFnb(StrEnum):
    RESTAURANT = "restaurant"
    CAFE = "cafe"
    DELIVERY = "delivery"
    FRANCHISE = "franchise"
    OTHER = "other"


class SubCategoryTravel(StrEnum):
    HOTEL = "hotel"
    ACTIVITY = "activity"
    FLIGHT = "flight"
    GEAR = "gear"
    OTHER = "other"


class SubCategoryEducation(StrEnum):
    ONLINE = "online"
    LANGUAGE = "language"
    CERTIFICATE = "certificate"
    BOOK = "book"
    OTHER = "other"


class SubCategoryFinance(StrEnum):
    CARD = "card"
    INSURANCE = "insurance"
    INVEST = "invest"
    LOAN = "loan"
    OTHER = "other"


class SubCategoryOther(StrEnum):
    OTHER = "other"


# 대분류 → 소분류 매핑
SUBCATEGORY_MAP: dict[Category, type[StrEnum]] = {
    Category.FOOD: SubCategoryFood,
    Category.BEAUTY: SubCategoryBeauty,
    Category.FASHION: SubCategoryFashion,
    Category.ELECTRONICS: SubCategoryElectronics,
    Category.HOME: SubCategoryHome,
    Category.HEALTH: SubCategoryHealth,
    Category.KIDS: SubCategoryKids,
    Category.PET: SubCategoryPet,
    Category.FNB: SubCategoryFnb,
    Category.TRAVEL: SubCategoryTravel,
    Category.EDUCATION: SubCategoryEducation,
    Category.FINANCE: SubCategoryFinance,
    Category.OTHER: SubCategoryOther,
}

# 대분류 한글 매핑
CATEGORY_KO: dict[Category, str] = {
    Category.FOOD: "식품",
    Category.BEAUTY: "뷰티",
    Category.FASHION: "패션",
    Category.ELECTRONICS: "전자기기",
    Category.HOME: "홈/리빙",
    Category.HEALTH: "건강",
    Category.KIDS: "유아/키즈",
    Category.PET: "반려동물",
    Category.FNB: "외식/카페",
    Category.TRAVEL: "여행/숙박",
    Category.EDUCATION: "교육",
    Category.FINANCE: "금융",
    Category.OTHER: "기타",
}


# ── 영상 스타일 (상위 9종) ─────────────────────────────────────────────────


class VideoStyle(StrEnum):
    DEMO = "demo"                        # 시연형
    REVIEW = "review"                    # 리뷰형
    PROBLEM_SOLUTION = "problem_solution"  # 문제해결형
    BEFORE_AFTER = "before_after"        # 비포애프터
    STORY = "story"                      # 스토리형
    LISTICLE = "listicle"                # 리스트형
    TREND_RIDE = "trend_ride"            # 트렌드형
    PROMOTION = "promotion"              # 프로모션형
    SENSORY = "sensory"                  # 감각형


class VideoStyleSubDemo(StrEnum):
    SPEC_SHOWCASE = "spec_showcase"
    FEATURE_DEMO = "feature_demo"
    TUTORIAL = "tutorial"
    OTHER = "other"


class VideoStyleSubReview(StrEnum):
    UNBOXING = "unboxing"
    COMPARISON = "comparison"
    USER_REVIEW = "user_review"
    EXPERT_REVIEW = "expert_review"
    OTHER = "other"


class VideoStyleSubProblemSolution(StrEnum):
    PAIN_POINT = "pain_point"
    TIP = "tip"
    OTHER = "other"


class VideoStyleSubBeforeAfter(StrEnum):
    TRANSFORMATION = "transformation"
    RESULT_PROOF = "result_proof"
    OTHER = "other"


class VideoStyleSubStory(StrEnum):
    BRAND_FILM = "brand_film"
    VLOG = "vlog"
    MINI_DRAMA = "mini_drama"
    OTHER = "other"


class VideoStyleSubListicle(StrEnum):
    RANKING = "ranking"
    CURATED_PICKS = "curated_picks"
    OTHER = "other"


class VideoStyleSubTrendRide(StrEnum):
    CHALLENGE = "challenge"
    MEME = "meme"
    SOUND_RIDE = "sound_ride"
    OTHER = "other"


class VideoStyleSubPromotion(StrEnum):
    TIME_DEAL = "time_deal"
    GROUP_BUY = "group_buy"
    COUPON = "coupon"
    OTHER = "other"


class VideoStyleSubSensory(StrEnum):
    ASMR = "asmr"
    MUKBANG = "mukbang"
    TEXTURE = "texture"
    TASTING = "tasting"
    OTHER = "other"


# ── 대본 뼈대 블록 (10종) ─────────────────────────────────────────────────


class BlockType(StrEnum):
    HOOK = "hook"                        # 훅
    AUTHORITY = "authority"              # 권위
    BENEFIT = "benefit"                  # 베네핏
    PROOF = "proof"                      # 입증
    DIFFERENTIATION = "differentiation"  # 차별화
    SOCIAL_PROOF = "social_proof"        # 사회적 증거
    CTA = "cta"                          # 행동 유도
    PAIN_POINT = "pain_point"            # 문제/공감 제기
    DEMO = "demo"                        # 시연/사용법
    PROMOTION = "promotion"              # 할인/혜택/한정


class BenefitSub(StrEnum):
    SENSORY = "sensory"
    FUNCTIONAL = "functional"
    EMOTIONAL = "emotional"
    PROCESS = "process"


# ── 화법 α기법 (21종) ─────────────────────────────────────────────────────


class AlphaEmotion(StrEnum):
    EMPATHY = "empathy"            # 공감
    FOMO = "fomo"                  # FOMO
    ANTICIPATION = "anticipation"  # 기대감
    RELIEF = "relief"              # 안심
    CURIOSITY = "curiosity"        # 호기심
    PRIDE = "pride"                # 자부심
    NOSTALGIA = "nostalgia"        # 향수
    FRUSTRATION = "frustration"    # 좌절감


class AlphaStructure(StrEnum):
    REVERSAL = "reversal"              # 반전
    CONTRAST = "contrast"              # 대조
    REPETITION = "repetition"          # 반복
    INFO_DENSITY = "info_density"      # 정보압축
    ESCALATION = "escalation"          # 에스컬레이션
    BEFORE_AFTER = "before_after"      # 비포/애프터
    PROBLEM_SOLUTION = "problem_solution"  # 문제→해결
    STORY_ARC = "story_arc"            # 스토리아크


class AlphaConnection(StrEnum):
    BRIDGE_SENTENCE = "bridge_sentence"    # 브릿지
    RHYTHM_SHIFT = "rhythm_shift"          # 리듬전환
    CALLBACK = "callback"                  # 콜백
    QUESTION_ANSWER = "question_answer"    # 질문→응답
    PAUSE_EMPHASIS = "pause_emphasis"      # 멈춤강조


# ── 소구형태 (visual_forms 5종) ───────────────────────────────────────────


class VisualForm(StrEnum):
    PRODUCT_SHOT = "product_shot"    # 제품샷
    IN_USE = "in_use"                # 사용장면
    EVIDENCE = "evidence"            # 시각적 증거
    EXPLANATION = "explanation"      # 설명/시각화
    MOOD = "mood"                    # 분위기/감성


# ── 제품 특징 분류 ────────────────────────────────────────────────────────


class ClaimType(StrEnum):
    COMPOSITION = "composition"  # 뭐가 들었어?
    FUNCTION = "function"        # 뭘 해주는데?
    EXPERIENCE = "experience"    # 써보면 어때?
    TRUST = "trust"              # 믿을 수 있어?
    VALUE = "value"              # 얼마야?


class ClaimLayer(StrEnum):
    FACT = "fact"              # 객관적 사실
    FUNCTION = "function"      # 제품이 하는 것
    EXPERIENCE = "experience"  # 사용자가 느끼는 것


class ClaimSource(StrEnum):
    SCRIPT = "script"
    TEXT_OVERLAY = "text_overlay"
    VISUAL = "visual"
    SCRIPT_VISUAL = "script+visual"


class PersuasionStrategy(StrEnum):
    EXPERIENCE_SHIFT = "experience_shift"    # 경험 전환형: 스펙→일상 경험
    LOSS_AVERSION = "loss_aversion"          # 손실 회피형: 안 사면 손해
    INFO_PREEMPT = "info_preempt"            # 정보 선점형: 정보→신뢰→전환
    SOCIAL_EVIDENCE = "social_evidence"      # 사회적 증거형: 타인 반응
    PRICE_ANCHOR = "price_anchor"            # 가격 앵커링형: 비교 가격


# ── 영상 연출 ─────────────────────────────────────────────────────────────


class ShotType(StrEnum):
    CLOSEUP = "closeup"
    MEDIUM = "medium"
    WIDE = "wide"
    OVERHEAD = "overhead"
    POV = "pov"


class ColorTone(StrEnum):
    WARM = "warm"
    COOL = "cool"
    NEUTRAL = "neutral"
    HIGH_CONTRAST = "high_contrast"
    PASTEL = "pastel"


class TextUsage(StrEnum):
    HEAVY = "heavy"
    MODERATE = "moderate"
    MINIMAL = "minimal"
    NONE = "none"


# ── 기타 분류 ─────────────────────────────────────────────────────────────


class NarrationType(StrEnum):
    VOICE = "voice"
    TTS = "tts"
    NONE = "none"


class HumanPresenceType(StrEnum):
    PRESENTER = "presenter"
    MODEL = "model"
    NARRATOR = "narrator"
    NONE = "none"


class FaceExposure(StrEnum):
    FULL = "full"
    PARTIAL = "partial"
    NONE = "none"


class CutRhythm(StrEnum):
    REGULAR = "regular"
    IRREGULAR = "irregular"
    ACCELERATING = "accelerating"
    DECELERATING = "decelerating"


class AttentionArc(StrEnum):
    BUILDING_PEAK_FADE = "building→peak→fade"
    SUSTAINED_HIGH = "sustained_high"
    SUSTAINED_LOW = "sustained_low"
    FLAT = "flat"
    BUILDING = "building"
    FADING = "fading"


class TempoLevel(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskLevel(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class HookStrength(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"


class Platform(StrEnum):
    TIKTOK = "tiktok"
    REELS = "reels"
    SHORTS = "shorts"
    AD = "ad"


class AspectRatio(StrEnum):
    NINE_SIXTEEN = "9:16"
    ONE_ONE = "1:1"
    SIXTEEN_NINE = "16:9"


class MusicGenre(StrEnum):
    ELECTRONIC = "electronic"
    POP = "pop"
    HIPHOP = "hiphop"
    ACOUSTIC = "acoustic"
    CLASSICAL = "classical"
    LO_FI = "lo_fi"
    DRAMATIC = "dramatic"
    OTHER = "other"


class EnergyProfile(StrEnum):
    STEADY = "steady"
    BUILDING = "building"
    DROP = "drop"
    CALM_TO_HYPE = "calm_to_hype"


class VoiceType(StrEnum):
    NARRATION = "narration"
    DIALOGUE = "dialogue"
    VOICEOVER = "voiceover"
    TTS = "tts"
    NONE = "none"
