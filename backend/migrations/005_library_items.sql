-- Migration: Library items table
-- Created: 2026-03-02
-- DO NOT execute directly — apply via Supabase SQL Editor

CREATE TABLE library_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  platform TEXT,
  source TEXT, -- radar/hack/manual
  original_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  title TEXT,
  channel_name TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  spike_multiplier REAL,
  job_id UUID REFERENCES jobs(id),
  tags TEXT[] DEFAULT '{}',
  memo TEXT,
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own library" ON library_items
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_library_items_user ON library_items(user_id);
CREATE INDEX idx_library_items_starred ON library_items(user_id, is_starred) WHERE is_starred = true;
CREATE INDEX idx_library_items_created ON library_items(created_at DESC);
