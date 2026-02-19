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
      highlight_method: string;
      brand_colors: string[];
      graphic_style: string;
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
