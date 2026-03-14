-- R29: radar_reels 확장 — 3탭 구조 (감시/트렌드/검색) 지원
-- source: 'channel' (감시) / 'trending' (트렌드) / 'search' (검색)

-- 1. 신규 컬럼 추가
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS source text DEFAULT 'channel';
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS channel_name text;
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS channel_followers int;
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS search_query text;
ALTER TABLE radar_reels ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT now();

-- 2. channel_id NOT NULL 해제 (트렌드/검색은 채널 등록 없이 저장)
ALTER TABLE radar_reels ALTER COLUMN channel_id DROP NOT NULL;

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_radar_reels_source ON radar_reels(source);
CREATE INDEX IF NOT EXISTS idx_radar_reels_category ON radar_reels(category);
CREATE INDEX IF NOT EXISTS idx_radar_reels_search_query ON radar_reels(search_query);

-- 4. user_profiles에 last_radar_visit 추가 (🆕 뱃지용)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_radar_visit timestamptz;

-- 5. user_quotas에 search 필드 추가 (기본값 업데이트)
-- Free: 월 10회, Pro: 월 50회 — 기존 row의 quotas JSONB에 search 키 추가
UPDATE user_quotas
SET quotas = quotas || '{"search": {"limit": 10, "used": 0}}'::jsonb
WHERE NOT (quotas ? 'search');

-- 6. RLS 확장: 트렌드/검색 데이터는 전체 공유
-- 기존 RLS 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own channel reels" ON radar_reels;
DROP POLICY IF EXISTS "radar_reels_select" ON radar_reels;
DROP POLICY IF EXISTS "Service role full access on radar_reels" ON radar_reels;

-- 감시: 본인 채널 영상만 / 트렌드·검색: 모든 사용자 접근 가능
CREATE POLICY "radar_reels_select" ON radar_reels FOR SELECT
TO authenticated
USING (
  source IN ('trending', 'search')
  OR channel_id IN (SELECT id FROM radar_channels WHERE user_id = auth.uid())
);

-- Service role은 full access 유지
CREATE POLICY "Service role full access on radar_reels" ON radar_reels FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Insert: 인증 사용자 + service role
DROP POLICY IF EXISTS "Users can insert reels" ON radar_reels;
CREATE POLICY "Users can insert reels" ON radar_reels FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update: 본인 채널 영상 또는 service role
DROP POLICY IF EXISTS "Users can update own reels" ON radar_reels;
CREATE POLICY "Users can update own reels" ON radar_reels FOR UPDATE
TO authenticated
USING (
  source IN ('trending', 'search')
  OR channel_id IN (SELECT id FROM radar_channels WHERE user_id = auth.uid())
);
