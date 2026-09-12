-- ============================================================
-- 19_database_integrity_constraints_and_cleanup.sql
-- DNA Professional Investigation Agency - Integrity & Hygiene
-- ============================================================

-- 1. CLEANUP & NORMALIZATION OF HISTORICAL DATA
-- Trim trailing and leading whitespace across primary text fields
UPDATE public.cases 
SET claim_no = btrim(claim_no) 
WHERE claim_no IS NOT NULL AND claim_no <> btrim(claim_no);

UPDATE public.cases 
SET company = btrim(company) 
WHERE company IS NOT NULL AND company <> btrim(company);

UPDATE public.cases 
SET insured_name = btrim(insured_name) 
WHERE insured_name IS NOT NULL AND insured_name <> btrim(insured_name);

UPDATE public.cases 
SET inv1 = btrim(inv1) 
WHERE inv1 IS NOT NULL AND inv1 <> btrim(inv1);

UPDATE public.cases 
SET inv2 = btrim(inv2) 
WHERE inv2 IS NOT NULL AND inv2 <> btrim(inv2);

UPDATE public.cases 
SET doc_code = btrim(doc_code) 
WHERE doc_code IS NOT NULL AND doc_code <> btrim(doc_code);

-- Normalize negative numbers if any existed accidentally in past entries
UPDATE public.cases SET fee1 = GREATEST(0, COALESCE(fee1, 0)) WHERE fee1 < 0;
UPDATE public.cases SET fee2 = GREATEST(0, COALESCE(fee2, 0)) WHERE fee2 < 0;
UPDATE public.cases SET ta1 = GREATEST(0, COALESCE(ta1, 0)) WHERE ta1 < 0;
UPDATE public.cases SET ta2 = GREATEST(0, COALESCE(ta2, 0)) WHERE ta2 < 0;
UPDATE public.cases SET received = GREATEST(0, COALESCE(received, 0)) WHERE received < 0;
UPDATE public.cases SET invoice_amount = GREATEST(0, COALESCE(invoice_amount, 0)) WHERE invoice_amount < 0;
UPDATE public.cases SET tds_deducted = GREATEST(0, COALESCE(tds_deducted, 0)) WHERE tds_deducted < 0;


-- 2. ADD CHECK CONSTRAINTS (IDEMPOTENT BLOCK)
DO $$
BEGIN
  -- A. Ensure fees and allowances cannot be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_fee1_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_fee1_non_negative CHECK (fee1 IS NULL OR fee1 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_fee2_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_fee2_non_negative CHECK (fee2 IS NULL OR fee2 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_ta1_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_ta1_non_negative CHECK (ta1 IS NULL OR ta1 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_ta2_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_ta2_non_negative CHECK (ta2 IS NULL OR ta2 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_received_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_received_non_negative CHECK (received IS NULL OR received >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_invoice_amount_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_invoice_amount_non_negative CHECK (invoice_amount IS NULL OR invoice_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_tds_non_negative'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_tds_non_negative CHECK (tds_deducted IS NULL OR tds_deducted >= 0);
  END IF;

  -- B. Prevent empty string entries (must be either NULL or contain non-whitespace text)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_claim_no_not_blank'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_claim_no_not_blank CHECK (claim_no IS NULL OR btrim(claim_no) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_company_not_blank'
  ) THEN
    ALTER TABLE public.cases 
    ADD CONSTRAINT chk_cases_company_not_blank CHECK (company IS NULL OR btrim(company) <> '');
  END IF;

  -- C. Expenses table constraint
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investigator_expenses') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_expenses_amount_non_negative') THEN
      ALTER TABLE public.investigator_expenses 
      ADD CONSTRAINT chk_expenses_amount_non_negative CHECK (amount >= 0);
    END IF;
  END IF;

END $$;
