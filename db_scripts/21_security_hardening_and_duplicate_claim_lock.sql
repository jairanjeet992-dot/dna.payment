-- ============================================================
-- 21_security_hardening_and_duplicate_claim_lock.sql
-- DNA Professional Investigation Agency
-- Safe, idempotent patch for:
-- 1. Correcting 'Anil rajput kanod' to 'Anil Rajput' in cases table
-- 2. Registering missing investigators (ARUN BARFA, DHEERAJ JAGADHALE, PAVAN PRAJAPATI)
-- 3. Database unique constraint preventing duplicate claims per company
-- 4. Revoking public/anon execution on sensitive SECURITY DEFINER functions
-- 5. Optimizing RLS policies on investigator_expenses with (SELECT auth.uid())
-- ============================================================

-- 1. Normalizing Anil Rajput in cases
UPDATE public.cases 
SET inv1 = 'Anil Rajput' 
WHERE inv1 ILIKE '%anil%rajput%kanod%';

UPDATE public.cases 
SET inv2 = 'Anil Rajput' 
WHERE inv2 ILIKE '%anil%rajput%kanod%';

-- 2. Insert missing investigators into master table
INSERT INTO public.investigators (name, payment_type, is_base, removed)
VALUES 
  ('ARUN BARFA', 'Per Case', false, false),
  ('DHEERAJ JAGADHALE', 'Per Case', false, false),
  ('PAVAN PRAJAPATI', 'Per Case', false, false)
ON CONFLICT (name) DO NOTHING;

-- 3. Prevent duplicate claims within the same company at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_unique_company_claim 
ON public.cases (upper(btrim(company)), upper(btrim(claim_no)))
WHERE claim_no IS NOT NULL AND btrim(claim_no) <> '';

-- 4. Revoke public/anon access on sensitive security definer functions
REVOKE EXECUTE ON FUNCTION public.assign_role_to_email(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assign_role_to_email(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_role_from_email(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.remove_role_from_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, public, authenticated;

REVOKE EXECUTE ON FUNCTION public.log_investigator_change() FROM anon, public, authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_case_mutations() FROM anon, public, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_investigator_case_breakdown(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_investigator_case_breakdown(uuid, integer, integer) TO authenticated;

-- 5. Optimize investigator_expenses RLS policies with (SELECT auth.uid())
DROP POLICY IF EXISTS expenses_admin_all ON public.investigator_expenses;
CREATE POLICY expenses_admin_all ON public.investigator_expenses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = 'admin'));

DROP POLICY IF EXISTS expenses_staff_read ON public.investigator_expenses;
CREATE POLICY expenses_staff_read ON public.investigator_expenses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = ANY (ARRAY['senior', 'junior', 'accounts'])));

DROP POLICY IF EXISTS expenses_staff_insert ON public.investigator_expenses;
CREATE POLICY expenses_staff_insert ON public.investigator_expenses
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = ANY (ARRAY['senior', 'junior', 'accounts'])));

DROP POLICY IF EXISTS expenses_staff_update ON public.investigator_expenses;
CREATE POLICY expenses_staff_update ON public.investigator_expenses
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = ANY (ARRAY['senior', 'junior', 'accounts'])))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = ANY (ARRAY['senior', 'junior', 'accounts'])));

DROP POLICY IF EXISTS expenses_staff_delete ON public.investigator_expenses;
CREATE POLICY expenses_staff_delete ON public.investigator_expenses
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = ANY (ARRAY['senior', 'junior', 'accounts'])));
