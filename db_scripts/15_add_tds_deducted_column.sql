-- ============================================================
-- 15_add_tds_deducted_column.sql
-- DNA Professional Investigation Agency
-- Safe, idempotent SQL patch for client TDS deduction on invoices
-- ============================================================

-- 1. Add tds_deducted column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tds_deducted NUMERIC(12,2) DEFAULT 0;

-- 2. Performance index for financial queries & tax reconciliations
CREATE INDEX IF NOT EXISTS idx_cases_tds_deducted ON cases(tds_deducted);

-- 3. Update financial trigger to calculate profit = (received + tds_deducted) - total_payable
CREATE OR REPLACE FUNCTION public.calculate_case_financials()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.total_payable := COALESCE(NEW.fee1,0)+COALESCE(NEW.fee2,0)+COALESCE(NEW.ta1,0)+COALESCE(NEW.ta2,0);
  NEW.profit := (COALESCE(NEW.received,0) + COALESCE(NEW.tds_deducted,0)) - NEW.total_payable;
  NEW.last_updated := now();
  IF (COALESCE(NEW.received,0) > 0 OR COALESCE(NEW.tds_deducted,0) > 0) AND (TG_OP='INSERT' OR COALESCE(OLD.received,0) <> COALESCE(NEW.received,0) OR COALESCE(OLD.tds_deducted,0) <> COALESCE(NEW.tds_deducted,0)) THEN
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;
