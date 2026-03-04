export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  user_id?: string;
  status: JobStatus;
  video_url?: string;
  video_name: string;
  video_size_mb: number;
  duration_sec?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  product_name?: string;
  product_category?: string;
  source_url?: string;
  original_filename?: string;
  thumbnail_url?: string;
  title?: string;
  channel_name?: string;
  posted_at?: string;
}

export interface AppealPoint {
  type: string;
  claim: string;
  visual_proof: {
    technique: string;
    description: string;
    timestamp: number;
  };
  audio_sync: string;
  strength: 'strong' | 'moderate' | 'weak';
  source?: 'visual' | 'script' | 'both';
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
}

export interface SceneCard {
  scene_id: number;
  role: string;
  time_range: [number, number];
  duration: number;
  description?: string;
  attention: {
    attention_score: number;
    attention_peak: number;
    peak_timestamp: number;
    attention_level: string;
    is_climax: boolean;
  };
  appeal_points: AppealPoint[];
  visual_summary: {
    dominant_shot: string;
    color_mood: string;
    motion_level: string;
    color_palette: string[];
  };
  content_summary: {
    subject_type: string;
    product_visibility: string;
    text_overlays: Array<{ content: string; purpose: string }>;
    attention_elements?: string[];
    key_action?: string;
  };
  effectiveness_signals: {
    hook_strength: string;
    information_density: string;
    emotional_trigger: string;
  };
}

export interface RiskZone {
  time_range: [number, number];
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  risk_factors: string[];
  suggestion: string;
}

export interface DropoffAnalysis {
  risk_zones: RiskZone[];
  safe_zones: [number, number][];
  overall_retention_score: number;
  worst_zone: RiskZone;
  improvement_priority: string[];
}

export interface PerformanceMetrics {
  brand_exposure_sec: number;
  product_focus_ratio: number;
  text_readability_score: number;
  time_to_first_appeal: number;
  time_to_cta: number;
  info_density: number;
  appeal_count: number;
  appeal_diversity: number;
  cut_density: number;
  attention_avg: number;
  attention_valley_count: number;
}

export interface VideoRecipe {
  video_recipe: {
    meta: {
      platform: string;
      duration: number;
      aspect_ratio: string;
      category: string;
      sub_category: string;
      target_audience: string;
    };
    structure: {
      type: string;
      scene_sequence: Array<{ role: string; duration: number; technique: string }>;
      hook_time: number;
      product_first_appear: number;
      cta_start: number;
    };
    visual_style: {
      overall_mood: string;
      color_palette: string[];
      avg_cut_interval: number;
      total_cuts: number;
      transition_style: string;
      human_screen_time_ratio: number;
      product_screen_time_ratio: number;
    };
    audio: {
      music: {
        present: boolean;
        genre: string;
        energy_profile: string;
        bpm_range: string;
      };
      voice: {
        type: string;
        tone: string;
        language: string;
        script_summary: string;
        hook_line: string;
        cta_line: string;
        transcript: TranscriptSegment[];
      };
    };
    persuasion_analysis: {
      presenter: {
        type: string;
        face_shown: boolean;
        credibility_factor: string;
      };
      appeal_points: AppealPoint[];
      primary_appeal: string;
      appeal_layering: string;
      persuasion_summary: string;
    };
    art_direction: {
      tone_and_manner: string;
      heading_font?: string;
      body_font?: string;
      font_color_system?: string[];
      highlight_method: string;
      brand_colors: string[];
      background_style?: string;
      color_temperature?: string;
      graphic_style: string;
      recurring_elements?: string[];
      text_position_pattern?: string;
      frame_composition_rule?: string;
      visual_consistency?: string;
      style_reference: string;
    };
    effectiveness_assessment: {
      hook_rating: string;
      flow_rating: string;
      message_clarity: string;
      cta_strength: string;
      replay_factor: string;
      standout_elements: string[];
      weak_points: string[];
    };
    scenes: SceneCard[];
    dropoff_analysis: DropoffAnalysis;
    performance_metrics: PerformanceMetrics;
  };
}

// ─── New analysis data types ───

export interface DiagnosisDimension {
  name: string;
  name_ko: string;
  value: number;
  weight: number;
  weighted: number;
  evidence: string;
}

export interface DiagnosisEntry {
  time_range: string;
  severity: 'ok' | 'warning' | 'danger';
  finding: string;
  prescription: string;
  dimension: string;
  style_context: string;
}

export interface Diagnosis {
  classification: {
    format: string;
    format_ko: string;
    intent: string;
    intent_ko: string;
    secondary_format: string;
    narration_type: string;
  };
  dimensions: DiagnosisDimension[];
  engagement_score: number;
  diagnoses: DiagnosisEntry[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Prescription {
  category: string;
  severity: 'info' | 'warning' | 'danger';
  symptom: string;
  recommendation: string;
  impact: string;
  time_range?: string;
  priority: number;
}

export interface Prescriptions {
  video_name: string;
  style_label: string;
  total_prescriptions: number;
  danger_count: number;
  warning_count: number;
  top_3_actions: string[];
  prescriptions: Prescription[];
}

export interface SttSegment {
  text: string;
  start: number;
  end: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface Stt {
  narration_type: string;
  total_speech_sec: number;
  full_transcript: string;
  segment_count: number;
  segments: SttSegment[];
}

export interface Style {
  primary_format: string;
  primary_format_ko: string;
  secondary_format: string;
  secondary_format_ko: string;
  primary_intent: string;
  primary_intent_ko: string;
  format_confidence: number;
  intent_confidence: number;
  auto_classified: boolean;
  reasoning: string;
}

export interface CaptionEvent {
  start: number;
  end: number;
  duration: number;
  text: string;
  full_text: string;
  purpose: string;
  font_style: string;
  narrative_role: string;
}

export interface CaptionMap {
  caption_count: number;
  total_caption_time: number;
  narrative_flow: string[];
  events: CaptionEvent[];
}

// Appeal Structure (Phase 5.5 output)
export interface AppealScene {
  scene_id: number;
  time_range: [number, number];
  cuts: Array<{ cut_id: number; time_range: [number, number] }>;
  appeals: AppealPoint[];
  stt_text: string;
  caption_text: string;
  persuasion_intent?: string;
}

export interface AppealGroup {
  group_id: number;
  name: string;
  description: string;
  scene_ids: number[];
  color: string;
}

export interface AppealStructure {
  scenes: AppealScene[];
  groups: AppealGroup[];
}

// ─── 3-axis Diagnosis (Phase 7 v2) ───

export interface DiagnosisAxisEntry {
  severity: 'ok' | 'warning' | 'danger';
  finding: string;
  recommendation: string;
}

export interface DiagnosisAxis {
  id: string;
  name: string;
  score: number;
  facts: Record<string, unknown>;
  diagnoses: DiagnosisAxisEntry[];
}

export interface DiagnosisResult {
  axes: DiagnosisAxis[];
  overall_score: number;
  top_3_actions: string[];
}

export interface MarketingVerdict {
  verdict: string;            // "집행 권장" | "조건부 집행" | "집행 불가"
  verdict_summary: string;
  evidence: string;
  action_plan: string;
  hook_analysis: string;
  keyword_analysis: string;
  full_markdown: string;
  product_name: string;
  product_category: string;
}

export interface ProductInfo {
  product_name?: string;
  brand?: string;
  category?: string;
  sub_category?: string;
}

export interface AnalysisResult {
  video_recipe: VideoRecipe;
  diagnosis: Diagnosis | null;
  prescriptions: Prescriptions | null;
  stt: Stt | null;
  style: Style | null;
  caption_map: CaptionMap | null;
  verdict: MarketingVerdict | null;
  video_url: string | null;
  appeal_structure: AppealStructure | null;
  thumbnails?: Record<string, string>;
  product: ProductInfo | null;
  persuasion_lens?: PersuasionLens | null;
  temporal?: TemporalData | null;
}

// ─── Temporal Analysis ───

export interface AttentionPoint {
  timestamp: number;
  score: number;
  section: '클라이막스' | '강' | '중' | '정적';
}

export interface AttentionCurve {
  points: AttentionPoint[];
  peak_timestamps: number[];
  attention_avg: number;
  attention_arc: string;
}

export interface CutRhythm {
  cut_timestamps: number[];
  intervals: number[];
  pattern: 'accelerating' | 'decelerating' | 'constant' | 'irregular';
  avg_interval: number;
  min_interval: number;
  max_interval: number;
  total_cuts: number;
}

export interface TemporalData {
  attention_curve: AttentionCurve;
  cut_rhythm: CutRhythm;
}

// ─── Persuasion Lens (Phase 4d) ───

export interface PersuasionStep {
  step: number;
  name_ko: string;
  name_en: string;
  present: boolean;
  sub_type: string | null;
  sub_type_ko: string | null;
  time_range: [number, number] | null;
  evidence: string;
  extensions: string[];
  quality_checks?: Record<string, boolean>;
}

export interface FrameworkMapping {
  phase: string;
  phase_ko: string;
  time_range: [number, number];
  description: string;
}

export interface FrameworkMatch {
  primary_framework: string;
  primary_framework_ko: string;
  confidence: number;
  mapping: FrameworkMapping[];
  secondary_framework: string | null;
  secondary_confidence: number;
}

export interface PersuasionLens {
  lens_7step: PersuasionStep[];
  lens_framework: FrameworkMatch;
}

// ─── Radar Types ───

export interface RadarChannel {
  id: string;
  ig_username: string;
  display_name: string;
  profile_pic_url: string;
  follower_count: number;
  category: string;
  avg_views_30d: number;
}

export interface RadarReel {
  id: string;
  channel: RadarChannel;
  ig_media_id: string;
  shortcode: string;
  thumbnail_url: string;
  video_url: string;
  caption: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  spike_multiplier: number;
  engagement_rate: number;
  comment_ratio: number;
  platform: 'instagram' | 'youtube' | 'tiktok';
  posted_at: string;
  is_analyzed: boolean;
  job_id?: string;
}

export interface RadarFilters {
  channel_id?: string;
  platform?: string;
  period?: '24h' | '7d' | '30d' | '90d';
  min_spike?: number;
  min_views?: number;
  min_engagement?: number;
  keyword?: string;
  sort?: 'spike' | 'engagement' | 'views' | 'recent';
  page?: number;
  limit?: number;
}

// ─── Library Types ───

export interface LibraryItem {
  id: string;
  platform: string;
  source: string;
  original_url: string;
  video_url: string;
  thumbnail_url: string;
  title: string;
  channel_name: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  spike_multiplier: number;
  job_id?: string;
  tags: string[];
  memo: string;
  is_starred: boolean;
  created_at: string;
}

export interface LibraryFilters {
  source?: string;
  platform?: string;
  tag?: string;
  keyword?: string;
  starred?: boolean;
  sort?: 'recent' | 'starred' | 'views' | 'spike';
  page?: number;
  limit?: number;
}
