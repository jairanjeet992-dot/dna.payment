-- ============================================================
-- 20_fix_financial_triggers_and_data_cleanup.sql
-- DNA Professional Investigation Agency
-- Safe, idempotent SQL patch for:
-- 1. Correcting outcome 'Genuie' typo to canonical 'Genuine'
-- 2. Fixing calculate_case_financials() trigger function to compute total_payable & profit correctly
-- 3. Dropping redundant duplicate trigger trg_calculate_case_financials
-- 4. Reconciling 414 total_payable zero cases and 315 stale profit values
-- 5. Normalizing single Withdrawn case fee (JUL26-0912) and single abnormal hardcopy status
-- ============================================================

-- 1. Fix outcome typo 'Genuie' -> 'Genuine'
UPDATE public.cases 
SET outcome = 'Genuine' 
WHERE outcome = 'Genuie';

-- 2. Normalize single abnormal hardcopy status
UPDATE public.cases 
SET hardcopy1_status = 'Pending' 
WHERE hardcopy1_status = 'Not Received';

-- 3. Normalize single Withdrawn case fee
UPDATE public.cases 
SET fee1 = 0, fee2 = 0, ta1 = 0, ta2 = 0, total_payable = 0
WHERE exception_type = 'Withdrawn' AND (fee1 > 0 OR fee2 > 0 OR ta1 > 0 OR ta2 > 0);

-- 4. Update the trigger function calculate_case_financials() with search_path=public
CREATE OR REPLACE FUNCTION public.calculate_case_financials()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  -- Calculate total investigator payable from fees and TA allowances
  IF NEW.exception_type = 'Withdrawn' THEN
    NEW.total_payable := 0;
  ELSE
    NEW.total_payable := COALESCE(NEW.fee1, 0) + COALESCE(NEW.fee2, 0) + COALESCE(NEW.ta1, 0) + COALESCE(NEW.ta2, 0);
  END IF;

  -- Profit = (Bank Received + Client TDS Deducted) - Total Investigator Payable
  NEW.profit := (COALESCE(NEW.received, 0) + COALESCE(NEW.tds_deducted, 0)) - COALESCE(NEW.total_payable, 0);
  
  NEW.last_updated := now();

  -- Auto-populate received_date if received or tds_deducted was added/changed
  IF (COALESCE(NEW.received, 0) > 0 OR COALESCE(NEW.tds_deducted, 0) > 0) AND 
     (TG_OP = 'INSERT' OR COALESCE(OLD.received, 0) <> COALESCE(NEW.received, 0) OR COALESCE(OLD.tds_deducted, 0) <> COALESCE(NEW.tds_deducted, 0)) THEN
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Drop redundant duplicate trigger (keeping trg_calc_case_financials)
DROP TRIGGER IF EXISTS trg_calculate_case_financials ON public.cases;

-- Ensure primary trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'cases' AND trigger_name = 'trg_calc_case_financials'
  ) THEN
    CREATE TRIGGER trg_calc_case_financials
    BEFORE INSERT OR UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION public.calculate_case_financials();
  END IF;
END $$;

-- 6. Synchronize all cases where total_payable or profit is out of sync
UPDATE public.cases
SET 
  total_payable = CASE 
                    WHEN exception_type = 'Withdrawn' THEN 0 
                    ELSE COALESCE(fee1, 0) + COALESCE(fee2, 0) + COALESCE(ta1, 0) + COALESCE(ta2, 0) 
                  END,
  profit = (COALESCE(received, 0) + COALESCE(tds_deducted, 0)) - 
           CASE 
             WHEN exception_type = 'Withdrawn' THEN 0 
             ELSE COALESCE(fee1, 0) + COALESCE(fee2, 0) + COALESCE(ta1, 0) + COALESCE(ta2, 0) 
           END
WHERE total_payable IS DISTINCT FROM (
        CASE 
          WHEN exception_type = 'Withdrawn' THEN 0 
          ELSE COALESCE(fee1, 0) + COALESCE(fee2, 0) + COALESCE(ta1, 0) + COALESCE(ta2, 0) 
        END
      )
   OR profit IS DISTINCT FROM (
        (COALESCE(received, 0) + COALESCE(tds_deducted, 0)) - 
        CASE 
          WHEN exception_type = 'Withdrawn' THEN 0 
          ELSE COALESCE(fee1, 0) + COALESCE(fee2, 0) + COALESCE(ta1, 0) + COALESCE(ta2, 0) 
        END
      );
