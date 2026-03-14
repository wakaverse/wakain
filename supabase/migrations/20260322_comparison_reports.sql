-- comparison_reports: 비교 분석 결과 저장
CREATE TABLE IF NOT EXISTS comparison_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  scenario TEXT NOT NULL CHECK (scenario IN ('A', 'B')),
  base_result_id UUID,  -- 시나리오 A일 때 기준 영상 result job_id
  result_ids UUID[] NOT NULL,
  claim_matching JSONB,
  coaching JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_comparison_reports_user ON comparison_reports(user_id);
CREATE INDEX idx_comparison_reports_created ON comparison_reports(created_at DESC);

-- RLS
ALTER TABLE comparison_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own comparison_reports"
  ON comparison_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparison_reports"
  ON comparison_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on comparison_reports"
  ON comparison_reports FOR ALL
  USING (auth.role() = 'service_role');
