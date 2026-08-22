-- ============================================================
-- 05. OWNERSHIP TRANSFER TABLE
-- ============================================================
-- Tracks when a case is reassigned from one investigator to another
-- ============================================================

CREATE TABLE IF NOT EXISTS case_ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  previous_owner text,
  new_owner text NOT NULL,
  reason text,
  transferred_by uuid REFERENCES auth.users(id),
  transfer_date timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_ownership_transfers_case_id ON case_ownership_transfers(case_id);

-- Enable Row Level Security (RLS)
ALTER TABLE case_ownership_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Admins can view and insert all transfers
CREATE POLICY "Admins can manage ownership transfers"
  ON case_ownership_transfers
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- 2. Staff can read transfers
CREATE POLICY "Staff can view ownership transfers"
  ON case_ownership_transfers
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- 3. Staff can insert transfers (during reassignment)
CREATE POLICY "Staff can insert ownership transfers"
  ON case_ownership_transfers
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );
