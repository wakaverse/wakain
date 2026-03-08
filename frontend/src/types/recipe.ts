// ─── V2 Recipe JSON types ───

export interface ProductClaim {
  claim: string;
  type: string;
  layer: string;
  verifiable: boolean;
  time_range: [number, number];
  source: string;
}

export interface ScriptBlock {
  block: string;
  text: string;
  time_range: [number, number];
  benefit_sub?: string;
  alpha: {
    emotion?: string;
    structure?: string;
    connection?: string;
  };
  utterances?: string[];
  matched_scenes?: number[];
  dropoff_risk?: string;
  product_claim_ref?: string;
}

export interface VisualForm {
  form: string;
  method: string;
}

export interface VisualSceneProduction {
  dominant_shot_type: string;
  dominant_color_tone: string;
  text_usage: string;
}

export interface VisualScene {
  scene_id: number;
  time_range: [number, number];
  style?: string;
  role?: string;
  visual_forms: VisualForm[];
  description?: string;
  caption_overlay?: string;
  production: VisualSceneProduction;
}

export interface AttentionPoint {
  t: number;
  score: number;
}

export interface AttentionCurve {
  points: AttentionPoint[];
  avg: number;
  peak_timestamps: number[];
}

export interface VisualRhythm {
  cut_rhythm: string;
  tempo_level: string;
  attention_arc: string;
  total_cuts: number;
  avg_cut_duration: number;
  attention_curve: AttentionCurve;
}

export interface TriggerItem {
  time: number;
  trigger: string;
}

export interface RiskZone {
  time_range: [number, number];
  risk_level: 'high' | 'medium' | 'low';
  reason: string;
}

export interface SafeZone {
  time_range: [number, number];
  reason: string;
}

export interface RecipeJSON {
  schema_version: string;
  summary: {
    strategy: string;
  };
  identity: {
    category: string;
    category_ko: string;
    sub_category: string;
    sub_category_ko: string;
    name: string;
    brand: string;
    is_marketing_video: boolean;
    platform: string;
    target_audience: string;
  };
  style: {
    primary: string;
    secondary: string;
    distribution: Record<string, number>;
  };
  scenes: Array<{
    scene_id: number;
    time_range: [number, number];
    dominant_appeal: string;
    visual_forms: VisualForm[];
    caption_overlay?: string;
  }>;
  product: {
    category: string;
    category_ko?: string;
    name: string;
    brand: string;
    multi_product: boolean;
    is_marketing_video: boolean;
    claims: ProductClaim[];
  };
  script: {
    blocks: ScriptBlock[];
    flow_order: string[];
    alpha_summary: {
      emotion: Record<string, number>;
      structure: Record<string, number>;
      connection: Record<string, number>;
    };
  };
  visual: {
    scenes: VisualScene[];
    transition_pattern: string;
    rhythm_bpm?: number;
    style_primary: string;
    style_secondary: string;
    style_distribution: Record<string, number>;
    rhythm: VisualRhythm;
  };
  engagement: {
    retention_analysis: {
      hook_strength: string;
      hook_reason: string;
      rewatch_triggers: TriggerItem[];
      share_triggers: TriggerItem[];
      comment_triggers: TriggerItem[];
    };
    dropoff_analysis: {
      risk_zones: RiskZone[];
      safe_zones: SafeZone[];
    };
    emotional_arc?: string;
  };
  meta: {
    platform: string;
    duration: number;
    aspect_ratio: string;
    target_audience: string;
    product_exposure_pct: number;
    product_first_appear: number;
    human_presence: boolean;
    audio: {
      voice_type: string;
      music_present: boolean;
      narration_type?: string;
    };
  };
  pipeline: {
    schema_version: string;
    analyzed_at: string;
    model_versions: Record<string, string>;
  };
}
