-- Admin dashboard RPC functions
-- These functions bypass RLS by using SECURITY DEFINER.
-- Only called from the client with admin-verified session.

-- ─── Dashboard: Count signups ───
CREATE OR REPLACE FUNCTION admin_count_signups(start_date timestamptz)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COUNT(*) FROM auth.users WHERE created_at >= start_date;
$$;

-- ─── Dashboard: Count active users (distinct in activity logs) ───
CREATE OR REPLACE FUNCTION admin_count_active_users(start_date timestamptz)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at >= start_date;
$$;

-- ─── Dashboard: Daily signups ───
CREATE OR REPLACE FUNCTION admin_daily_signups(start_date timestamptz)
RETURNS TABLE(day timestamptz, count bigint)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT date_trunc('day', created_at) as day, COUNT(*)
  FROM auth.users
  WHERE created_at >= start_date
  GROUP BY day ORDER BY day;
$$;

-- ─── Dashboard: Daily completed jobs ───
CREATE OR REPLACE FUNCTION admin_daily_completed_jobs(start_date timestamptz)
RETURNS TABLE(day timestamptz, count bigint)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT date_trunc('day', completed_at) as day, COUNT(*)
  FROM jobs
  WHERE status = 'completed' AND completed_at >= start_date AND deleted_at IS NULL
  GROUP BY day ORDER BY day;
$$;

-- ─── Dashboard: Daily active users ───
CREATE OR REPLACE FUNCTION admin_daily_active_users(start_date timestamptz)
RETURNS TABLE(day timestamptz, dau bigint)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT date_trunc('day', created_at) as day, COUNT(DISTINCT user_id) as dau
  FROM user_activity_logs
  WHERE created_at >= start_date
  GROUP BY day ORDER BY day;
$$;

-- ─── Pipeline: Cost sum ───
CREATE OR REPLACE FUNCTION admin_pipeline_cost_sum(start_date timestamptz)
RETURNS numeric
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM pipeline_logs
  WHERE status = 'success' AND created_at >= start_date;
$$;

-- ─── Pipeline: Cost avg per result ───
CREATE OR REPLACE FUNCTION admin_pipeline_cost_avg()
RETURNS numeric
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT SUM(cost_usd) FROM pipeline_logs WHERE status = 'success') /
    NULLIF((SELECT COUNT(DISTINCT result_id) FROM pipeline_logs WHERE status = 'success'), 0),
    0
  );
$$;

-- ─── Pipeline: Phase success rates ───
CREATE OR REPLACE FUNCTION admin_phase_success_rates(start_date timestamptz)
RETURNS TABLE(phase_name text, total bigint, success bigint, fail bigint, retry bigint, success_rate numeric)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    phase_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'success') as success,
    COUNT(*) FILTER (WHERE status = 'fail') as fail,
    COUNT(*) FILTER (WHERE status = 'retry') as retry,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0), 1) as success_rate
  FROM pipeline_logs
  WHERE created_at >= start_date
  GROUP BY phase_name
  ORDER BY phase_name;
$$;

-- ─── Pipeline: Average analysis time ───
CREATE OR REPLACE FUNCTION admin_avg_analysis_time(start_date timestamptz)
RETURNS TABLE(day timestamptz, avg_seconds numeric)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT date_trunc('day', j.completed_at) as day,
         AVG(EXTRACT(EPOCH FROM (j.completed_at - j.created_at))) as avg_seconds
  FROM jobs j
  WHERE j.status = 'completed' AND j.completed_at >= start_date AND j.deleted_at IS NULL
  GROUP BY day ORDER BY day;
$$;

-- ─── Users: List users with activity summary ───
CREATE OR REPLACE FUNCTION admin_list_users(
  search_email text DEFAULT '',
  filter_plan text DEFAULT '',
  filter_pro_interest boolean DEFAULT false,
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 50
)
RETURNS TABLE(
  user_id uuid,
  email text,
  signup_date timestamptz,
  last_active timestamptz,
  analyze_count bigint,
  compare_count bigint,
  plan text,
  pro_interest boolean
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    u.id as user_id,
    u.email::text,
    u.created_at as signup_date,
    MAX(al.created_at) as last_active,
    COUNT(*) FILTER (WHERE al.action = 'analyze_complete') as analyze_count,
    COUNT(*) FILTER (WHERE al.action = 'compare_start') as compare_count,
    COALESCE(uq.plan, 'free') as plan,
    BOOL_OR(al.action = 'pro_interest') as pro_interest
  FROM auth.users u
  LEFT JOIN user_activity_logs al ON u.id = al.user_id
  LEFT JOIN user_quotas uq ON u.id = uq.user_id
  WHERE
    (search_email = '' OR u.email ILIKE '%' || search_email || '%')
    AND (filter_plan = '' OR COALESCE(uq.plan, 'free') = filter_plan)
  GROUP BY u.id, u.email, u.created_at, uq.plan
  HAVING
    (NOT filter_pro_interest OR BOOL_OR(al.action = 'pro_interest'))
  ORDER BY u.created_at DESC
  LIMIT page_limit OFFSET page_offset;
$$;

-- ─── Users: User's analysis results with thumbnails ───
CREATE OR REPLACE FUNCTION admin_user_results(target_user_id uuid)
RETURNS TABLE(
  result_id uuid,
  job_id uuid,
  video_name text,
  thumbnail_url text,
  platform text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    r.id as result_id,
    j.id as job_id,
    j.video_name,
    j.thumbnail_url,
    NULL::text as platform,
    j.created_at
  FROM jobs j
  JOIN results r ON r.job_id = j.id
  WHERE j.user_id = target_user_id AND j.deleted_at IS NULL
  ORDER BY j.created_at DESC
  LIMIT 20;
$$;

-- Grant execute to authenticated and anon (RLS bypass is handled by SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION admin_count_signups TO authenticated;
GRANT EXECUTE ON FUNCTION admin_count_active_users TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_signups TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_completed_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_active_users TO authenticated;
GRANT EXECUTE ON FUNCTION admin_pipeline_cost_sum TO authenticated;
GRANT EXECUTE ON FUNCTION admin_pipeline_cost_avg TO authenticated;
GRANT EXECUTE ON FUNCTION admin_phase_success_rates TO authenticated;
GRANT EXECUTE ON FUNCTION admin_avg_analysis_time TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users TO authenticated;
GRANT EXECUTE ON FUNCTION admin_user_results TO authenticated;
