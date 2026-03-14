-- 011: Enable RLS on all tables missing it
-- jobs, results, content_dna, brands, channels, analysis_scenes, analysis_blocks, analysis_claims, pipeline_logs

-- ── jobs ──
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access jobs" ON jobs
  FOR ALL USING (auth.role() = 'service_role');

-- ── results ──
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own results" ON results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = results.job_id AND jobs.user_id = auth.uid())
  );

CREATE POLICY "Service role full access results" ON results
  FOR ALL USING (auth.role() = 'service_role');

-- ── content_dna ──
ALTER TABLE content_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content_dna" ON content_dna
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM results r JOIN jobs j ON j.id = r.job_id WHERE r.id = content_dna.result_id AND j.user_id = auth.uid())
  );

CREATE POLICY "Service role full access content_dna" ON content_dna
  FOR ALL USING (auth.role() = 'service_role');

-- ── brands (공용 데이터 — 누구나 읽기, 쓰기는 service_role만) ──
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brands" ON brands
  FOR SELECT USING (true);

CREATE POLICY "Service role full access brands" ON brands
  FOR ALL USING (auth.role() = 'service_role');

-- ── channels (공용 데이터 — 누구나 읽기, 쓰기는 service_role만) ──
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channels" ON channels
  FOR SELECT USING (true);

CREATE POLICY "Service role full access channels" ON channels
  FOR ALL USING (auth.role() = 'service_role');

-- ── analysis_scenes ──
ALTER TABLE analysis_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scenes" ON analysis_scenes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM results r JOIN jobs j ON j.id = r.job_id WHERE r.id = analysis_scenes.result_id AND j.user_id = auth.uid())
  );

CREATE POLICY "Service role full access scenes" ON analysis_scenes
  FOR ALL USING (auth.role() = 'service_role');

-- ── analysis_blocks ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysis_blocks') THEN
    ALTER TABLE analysis_blocks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

CREATE POLICY "Users can view own blocks" ON analysis_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM results r JOIN jobs j ON j.id = r.job_id WHERE r.id = analysis_blocks.result_id AND j.user_id = auth.uid())
  );

CREATE POLICY "Service role full access blocks" ON analysis_blocks
  FOR ALL USING (auth.role() = 'service_role');

-- ── analysis_claims ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysis_claims') THEN
    ALTER TABLE analysis_claims ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

CREATE POLICY "Users can view own claims" ON analysis_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM results r JOIN jobs j ON j.id = r.job_id WHERE r.id = analysis_claims.result_id AND j.user_id = auth.uid())
  );

CREATE POLICY "Service role full access claims" ON analysis_claims
  FOR ALL USING (auth.role() = 'service_role');

-- ── pipeline_logs ──
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON pipeline_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = pipeline_logs.job_id AND jobs.user_id = auth.uid())
  );

CREATE POLICY "Service role full access logs" ON pipeline_logs
  FOR ALL USING (auth.role() = 'service_role');
