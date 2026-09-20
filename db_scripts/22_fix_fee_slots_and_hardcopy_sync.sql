-- ============================================================
-- 22_fix_fee_slots_and_hardcopy_sync.sql
-- DNA Professional Investigation Agency
-- Safe, idempotent patch for:
-- 1. Correcting 5 cases where fee2 was erroneously populated instead of fee1
-- 2. Synchronizing hardcopy2_status = 'Received' for same-investigator cases (inv1 = inv2)
-- ============================================================

-- 1. Consolidate and shift orphan fee2 slots into fee1
-- APR26-0187: Consolidate 400 + 200 = 600 into fee1 for Prashant Vyas
UPDATE public.cases 
SET fee1 = 600.00, fee2 = 0.00, inv1_status = 'Paid', inv2_status = '' 
WHERE doc_code = 'APR26-0187';

-- AUG26-0348: Shift 500 into fee1 for Rohit Vishwakarma
UPDATE public.cases 
SET fee1 = 500.00, fee2 = 0.00, inv1_status = 'Pending', inv2 = 'NA', inv2_status = '' 
WHERE doc_code = 'AUG26-0348';

-- JUL26-0282: Shift 400 into fee1 for Akash Tamrakar
UPDATE public.cases 
SET fee1 = 400.00, fee2 = 0.00, inv1_status = 'Paid', inv2_status = '' 
WHERE doc_code = 'JUL26-0282';

-- JUN26-0106: Shift 400 into fee1 for Santosh Sharma
UPDATE public.cases 
SET fee1 = 400.00, fee2 = 0.00, inv1_status = 'Paid', inv2_status = '' 
WHERE doc_code = 'JUN26-0106';

-- MAY26-0569: Shift 300 into fee1 for Santosh Sharma
UPDATE public.cases 
SET fee1 = 300.00, fee2 = 0.00, inv1_status = 'Paid', inv2_status = '' 
WHERE doc_code = 'MAY26-0569';

-- 2. Synchronize hardcopy2_status when inv1 = inv2 and hardcopy1 is Received
UPDATE public.cases 
SET hardcopy2_status = 'Received' 
WHERE inv1 = inv2 
  AND inv1 IS NOT NULL AND btrim(inv1) NOT IN ('', 'NA', 'DNA')
  AND hardcopy1_status = 'Received' 
  AND (hardcopy2_status IS NULL OR hardcopy2_status = '' OR hardcopy2_status = 'Pending');
