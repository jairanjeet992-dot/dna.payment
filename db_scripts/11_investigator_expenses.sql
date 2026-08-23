-- ============================================================
-- 11. INVESTIGATOR EXPENSES & VOUCHER LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS investigator_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Courier / Hardcopy', 'Bonus / Incentive', 'Travel / Fuel', 'Printing / Stationery', 'Special Allowance', 'Advance / Deduction', 'Other'
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  month_code TEXT, -- e.g. 'AUG26' or '2026-08'
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' or 'Paid'
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_investigator_expenses_name ON investigator_expenses(investigator_name);
CREATE INDEX IF NOT EXISTS idx_investigator_expenses_date ON investigator_expenses(date);
CREATE INDEX IF NOT EXISTS idx_investigator_expenses_month ON investigator_expenses(month_code);
