-- Pipeline phase-level monitoring logs
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  result_id UUID,
  phase_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  model_used TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd DOUBLE PRECISION DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_job ON pipeline_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_phase ON pipeline_logs(phase_name, status);
