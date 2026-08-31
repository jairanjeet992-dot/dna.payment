-- ============================================================
-- 12_smart_merge_and_missing_case_columns.sql
-- Safe, idempotent patch to ensure all enriched case fields exist
-- ============================================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS custom_data jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS invoice_amount numeric(12,2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS drive_folder_id text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS outcome text DEFAULT 'Pending';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS fraud_reason text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS company_hardcopy_status text DEFAULT 'Pending';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS company_hardcopy_awb text;

-- Indexes for lightning fast claim lookup during bulk paste and merge
CREATE INDEX IF NOT EXISTS idx_cases_claim_no ON cases(claim_no);
CREATE INDEX IF NOT EXISTS idx_cases_company_claim ON cases(company, claim_no);
CREATE INDEX IF NOT EXISTS idx_cases_outcome ON cases(outcome);
