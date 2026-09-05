-- ============================================================
-- 13. INVESTIGATOR PAYOUTS & TDS TAX LEDGER TABLE
-- ============================================================
-- Stores formal monthly settlement records, TDS deductions under Sec 194C/194J,
-- and net disbursements for statutory compliance, Form 26Q preparation, 
-- and net profit analytics.

CREATE TABLE IF NOT EXISTS investigator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_name TEXT NOT NULL,
  month_code TEXT NOT NULL, -- e.g. 'AUG26' or '2026-08'
  month_label TEXT,        -- e.g. 'Aug 2026'
  payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cases NUMERIC(10,1) DEFAULT 0,
  gross_fees NUMERIC(10,2) DEFAULT 0,
  gross_ta NUMERIC(10,2) DEFAULT 0,
  expenses_amount NUMERIC(10,2) DEFAULT 0,
  gross_total NUMERIC(10,2) DEFAULT 0,
  taxable_base NUMERIC(10,2) DEFAULT 0,
  tds_rate NUMERIC(5,2) DEFAULT 0,
  tds_section TEXT DEFAULT '0%', -- '1% — Contractor (194C)', '2% — Professional (194J)', etc.
  tds_amount NUMERIC(10,2) DEFAULT 0,
  net_disbursable NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Paid',   -- 'Paid', 'Pending'
  payment_mode TEXT DEFAULT 'Bank Transfer',
  reference_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT unique_inv_month_payout UNIQUE (investigator_name, month_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_payouts_name ON investigator_payouts(investigator_name);
CREATE INDEX IF NOT EXISTS idx_inv_payouts_month ON investigator_payouts(month_code);
CREATE INDEX IF NOT EXISTS idx_inv_payouts_date ON investigator_payouts(payout_date);

-- View for easy Monthly TDS & Tax Audit Summary
CREATE OR REPLACE VIEW view_monthly_tds_tax_summary AS
SELECT 
  month_code,
  month_label,
  COUNT(DISTINCT investigator_name) AS investigators_count,
  SUM(total_cases) AS total_cases_settled,
  SUM(gross_total) AS total_gross_payout,
  SUM(taxable_base) AS total_taxable_base,
  SUM(tds_amount) AS total_tds_deducted,
  SUM(net_disbursable) AS total_net_disbursed
FROM investigator_payouts
GROUP BY month_code, month_label
ORDER BY month_code DESC;
