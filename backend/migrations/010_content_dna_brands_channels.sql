-- R23: brands, channels, content_dna 테이블 생성
-- 참조: docs/WAKALAB_DATA_ARCHITECTURE_v2.md

-- ── brands ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  category_id TEXT,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);

-- ── channels ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  platform TEXT NOT NULL,
  channel_url TEXT UNIQUE,
  channel_name TEXT,
  follower_count INT,
  is_tracked BOOLEAN DEFAULT false,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channels_platform ON channels(platform);
CREATE INDEX IF NOT EXISTS idx_channels_brand ON channels(brand_id);

-- ── content_dna ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID UNIQUE REFERENCES results(id),
  job_id UUID REFERENCES jobs(id),
  organization_id UUID,
  user_id UUID,
  brand_id UUID REFERENCES brands(id),
  channel_id UUID REFERENCES channels(id),
  -- 분류 축
  category TEXT,
  subcategory TEXT,
  platform TEXT,
  duration FLOAT,
  -- 구조 DNA
  block_sequence TEXT[],
  block_count INT,
  appeal_distribution JSONB,
  style_distribution JSONB,
  -- 훅 DNA
  hook_type TEXT,
  hook_strength TEXT,
  first_3s_dynamics FLOAT,
  product_first_appear FLOAT,
  -- 리듬 DNA
  cut_count INT,
  cut_avg_duration FLOAT,
  cut_rhythm TEXT,
  dynamics_avg FLOAT,
  dynamics_std FLOAT,
  -- 혼동 변수
  has_person BOOLEAN,
  person_role TEXT,
  face_visible BOOLEAN,
  voice_type TEXT,
  bgm_genre TEXT,
  has_text_overlay BOOLEAN,
  channel_followers INT,
  trend_tag TEXT,
  -- 성과 (nullable)
  views BIGINT,
  likes INT,
  comments_count INT,
  roas FLOAT,
  ctr FLOAT,
  performance_source TEXT,
  performance_updated_at TIMESTAMPTZ,
  -- 메타
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_dna_category_platform ON content_dna(category, platform);
CREATE INDEX IF NOT EXISTS idx_content_dna_brand ON content_dna(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_dna_channel ON content_dna(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_dna_hook ON content_dna(hook_type, hook_strength);
