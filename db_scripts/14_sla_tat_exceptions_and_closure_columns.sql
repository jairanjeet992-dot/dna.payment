-- ============================================================
-- 14_sla_tat_exceptions_and_closure_columns.sql
-- DNA Professional Investigation Agency
-- Safe, idempotent SQL patch for SLA, Case Closure & Exceptions
-- ============================================================

-- 1. SLA, TAT & Case Closure Columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sla_hours integer DEFAULT 24;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS risk_level text;

-- 2. Exception Lifecycle Columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS exception_type text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS exception_reason text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS exception_at timestamptz;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS exception_by text;

-- 3. Indexes for fast dashboard query performance & SLA monitors
CREATE INDEX IF NOT EXISTS idx_cases_due_date ON cases(due_date);
CREATE INDEX IF NOT EXISTS idx_cases_completed_at ON cases(completed_at);
CREATE INDEX IF NOT EXISTS idx_cases_exception_type ON cases(exception_type);
CREATE INDEX IF NOT EXISTS idx_cases_sla_hours ON cases(sla_hours);

-- 4. Automatically populate default due_date for historical cases where date is present but due_date is null
UPDATE cases
SET due_date = (date::timestamp + interval '24 hours')
WHERE due_date IS NULL AND date IS NOT NULL;
