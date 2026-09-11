-- ============================================================
-- 18_fix_activity_log_details.sql
-- Fixes BUG-06: Add missing details column to activity_log
-- ============================================================

ALTER TABLE public.activity_log 
ADD COLUMN IF NOT EXISTS details text;
