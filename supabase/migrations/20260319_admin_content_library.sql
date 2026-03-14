-- Admin content library RPC functions
-- Browse all users' analysis results with filtering

-- ─── Content Library: List all results with user info ───
CREATE OR REPLACE FUNCTION admin_content_library(
  filter_category text DEFAULT '',
  filter_platform text DEFAULT '',
  search_user text DEFAULT '',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 50
)
RETURNS TABLE(
  result_id uuid,
  job_id uuid,
  video_name text,
  thumbnail_url text,
  user_email text,
  user_id uuid,
  platform text,
  category text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    r.id as result_id,
    j.id as job_id,
    j.video_name,
    j.thumbnail_url,
    u.email::text as user_email,
    j.user_id,
    COALESCE(cd.platform, NULL) as platform,
    COALESCE(cd.category, NULL) as category,
    j.created_at
  FROM jobs j
  JOIN results r ON r.job_id = j.id
  JOIN auth.users u ON u.id = j.user_id
  LEFT JOIN content_dna cd ON cd.result_id = r.id
  WHERE j.deleted_at IS NULL
    AND j.status = 'completed'
    AND (filter_category = '' OR cd.category = filter_category)
    AND (filter_platform = '' OR cd.platform = filter_platform)
    AND (search_user = '' OR u.email ILIKE '%' || search_user || '%')
  ORDER BY j.created_at DESC
  LIMIT page_limit OFFSET page_offset;
$$;

-- ─── Content Library: Distinct categories ───
CREATE OR REPLACE FUNCTION admin_content_categories()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT DISTINCT category FROM content_dna WHERE category IS NOT NULL ORDER BY category;
$$;

-- ─── Content Library: Distinct platforms ───
CREATE OR REPLACE FUNCTION admin_content_platforms()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT DISTINCT platform FROM content_dna WHERE platform IS NOT NULL ORDER BY platform;
$$;

GRANT EXECUTE ON FUNCTION admin_content_library TO authenticated;
GRANT EXECUTE ON FUNCTION admin_content_categories TO authenticated;
GRANT EXECUTE ON FUNCTION admin_content_platforms TO authenticated;
