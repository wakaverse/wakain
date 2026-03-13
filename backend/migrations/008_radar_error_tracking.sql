-- Migration: Add error tracking columns to radar_channels
-- Created: 2026-03-14

ALTER TABLE radar_channels ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE radar_channels ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
