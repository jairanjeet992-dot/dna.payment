-- ============================================================
-- 10. EXCEPTION CASES UPDATE
-- ============================================================
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS exception_type TEXT,
ADD COLUMN IF NOT EXISTS exception_reason TEXT,
ADD COLUMN IF NOT EXISTS exception_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exception_by TEXT;

-- Index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_cases_exception_type ON cases(exception_type);
