-- Migration: Add YouTube support to Radar
-- Created: 2026-03-02
-- DO NOT execute directly — apply via Supabase SQL Editor

-- Add platform column to radar_channels
ALTER TABLE radar_channels
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';

-- Update unique constraint to include platform
ALTER TABLE radar_channels
  DROP CONSTRAINT IF EXISTS radar_channels_user_id_ig_username_key;

ALTER TABLE radar_channels
  ADD CONSTRAINT radar_channels_user_platform_username_key
  UNIQUE(user_id, platform, ig_username);

-- YouTube-specific: ig_username stores YouTube channel handle/name,
-- ig_user_id stores YouTube channelId

-- Index on platform
CREATE INDEX IF NOT EXISTS idx_radar_channels_platform
  ON radar_channels(platform);
