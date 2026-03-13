CREATE TABLE IF NOT EXISTS analysis_scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  category_id TEXT,
  scene_order INTEGER NOT NULL,
  time_start DOUBLE PRECISION,
  time_end DOUBLE PRECISION,
  style TEXT,
  style_sub TEXT,
  role TEXT,
  visual_forms JSONB DEFAULT '[]',
  block_refs JSONB DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_scenes_result ON analysis_scenes(result_id);
CREATE INDEX IF NOT EXISTS idx_analysis_scenes_style ON analysis_scenes(style, category_id);
