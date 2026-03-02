-- Migration: Radar feature tables
-- Created: 2026-03-02
-- DO NOT execute directly — apply via Supabase SQL Editor

-- 등록 채널
CREATE TABLE radar_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ig_username TEXT NOT NULL,
  ig_user_id TEXT,
  display_name TEXT,
  profile_pic_url TEXT,
  follower_count INTEGER,
  category TEXT,
  avg_views_30d REAL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ig_username)
);

-- 수집된 릴스
CREATE TABLE radar_reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES radar_channels(id) ON DELETE CASCADE,
  ig_media_id TEXT UNIQUE,
  shortcode TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  caption TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  spike_multiplier REAL DEFAULT 1.0,
  engagement_rate REAL DEFAULT 0,
  comment_ratio REAL DEFAULT 0,
  platform TEXT DEFAULT 'instagram',
  posted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  job_id UUID REFERENCES jobs(id),
  is_analyzed BOOLEAN DEFAULT false
);

-- RLS
ALTER TABLE radar_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own channels" ON radar_channels
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view reels from own channels" ON radar_reels
  FOR SELECT USING (
    channel_id IN (SELECT id FROM radar_channels WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_radar_reels_spike ON radar_reels(spike_multiplier DESC);
CREATE INDEX idx_radar_reels_posted ON radar_reels(posted_at DESC);
CREATE INDEX idx_radar_reels_engagement ON radar_reels(engagement_rate DESC);
CREATE INDEX idx_radar_reels_channel ON radar_reels(channel_id);
