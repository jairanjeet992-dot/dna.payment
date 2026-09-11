-- ============================================================
-- 16_security_hardening_rls_payouts_audit.sql
-- DNA Professional Investigation Agency
-- Production Security Hardening, Strict RLS Enforcement,
-- Immutable Audit Trails, and Self-Contained Schema Setup
-- ============================================================

-- ============================================================
-- 0. ENSURE PREREQUISITE TABLES EXIST (USER_ROLES & PAYOUTS)
-- ============================================================

-- 0.1 Create user_roles table if it does not exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'senior', 'junior', 'accounts', 'company')),
  investigator_name text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_bootstrap" ON public.user_roles;

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Auto-bootstrap current admin user from auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'jairanjeet992@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- ============================================================
-- 1. HARDEN SECURITY DEFINER HELPER FUNCTIONS (SEC-03, SEC-04, SEC-05)
-- ============================================================

-- 1.1 Robust is_admin check based on database role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (SELECT auth.uid()) 
      AND role = 'admin'
  );
$$;

-- 1.2 Get caller role helper
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = (SELECT auth.uid()) 
  LIMIT 1;
$$;

-- 1.3 Get caller investigator name helper
CREATE OR REPLACE FUNCTION public.get_my_investigator()
RETURNS text 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
  SELECT investigator_name FROM public.user_roles 
  WHERE user_id = (SELECT auth.uid()) 
  LIMIT 1;
$$;

-- 1.4 Hardened assign_role_to_email with role validation
CREATE OR REPLACE FUNCTION public.assign_role_to_email(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Strict Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign roles';
  END IF;

  -- Validate role against allowed roles
  IF p_role NOT IN ('admin', 'senior', 'junior', 'accounts', 'company') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be one of admin, senior, junior, accounts, company', p_role;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_email));
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, updated_at)
    VALUES (v_user_id, p_role, now())
    ON CONFLICT (user_id) DO UPDATE SET role = p_role, updated_at = now();
  ELSE
    RAISE EXCEPTION 'User with email % not found in Auth system', p_email;
  END IF;
END;
$$;

-- 1.5 Hardened remove_role_from_email
CREATE OR REPLACE FUNCTION public.remove_role_from_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Strict Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can remove roles';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_email));
  
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
  END IF;
END;
$$;

-- 1.6 Revoke public execution on SECURITY DEFINER functions and grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_investigator() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_role_to_email(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_role_from_email(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_investigator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role_to_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_role_from_email(text) TO authenticated;

-- ============================================================
-- 2. HARDEN CASES RLS (SEC-01, PERF-02, PERF-03)
-- ============================================================
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Drop all overlapping / overly permissive policies
DROP POLICY IF EXISTS "Allow logged-in users full access to cases" ON public.cases;
DROP POLICY IF EXISTS "cases_authenticated_all" ON public.cases;
DROP POLICY IF EXISTS "cases_admin_all" ON public.cases;
DROP POLICY IF EXISTS "cases_admin_full_access" ON public.cases;
DROP POLICY IF EXISTS "cases_senior_read" ON public.cases;
DROP POLICY IF EXISTS "cases_senior_modify" ON public.cases;
DROP POLICY IF EXISTS "cases_senior_read_access" ON public.cases;
DROP POLICY IF EXISTS "cases_senior_write_access" ON public.cases;
DROP POLICY IF EXISTS "cases_senior_update_access" ON public.cases;
DROP POLICY IF EXISTS "cases_junior_read" ON public.cases;
DROP POLICY IF EXISTS "cases_junior_modify" ON public.cases;
DROP POLICY IF EXISTS "cases_junior_read_access" ON public.cases;
DROP POLICY IF EXISTS "cases_junior_write_access" ON public.cases;
DROP POLICY IF EXISTS "cases_junior_update_access" ON public.cases;
DROP POLICY IF EXISTS "accounts_read_all" ON public.cases;
DROP POLICY IF EXISTS "accounts_update_all" ON public.cases;
DROP POLICY IF EXISTS "accounts_update_payment" ON public.cases;
DROP POLICY IF EXISTS "cases_accounts_read_access" ON public.cases;
DROP POLICY IF EXISTS "cases_accounts_update_access" ON public.cases;
DROP POLICY IF EXISTS "company_own_cases" ON public.cases;
DROP POLICY IF EXISTS "cases_company_portal_read" ON public.cases;

-- 2.1 Admin: Full access
CREATE POLICY "cases_admin_full_access" ON public.cases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2.2 Senior Investigators / Staff: Read all cases, insert/update own or junior cases
CREATE POLICY "cases_senior_read_access" ON public.cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'senior'
    )
  );

CREATE POLICY "cases_senior_write_access" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'senior'
    )
  );

CREATE POLICY "cases_senior_update_access" ON public.cases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'senior'
        AND (
          inv1 = ur.investigator_name 
          OR inv2 = ur.investigator_name
          OR inv1 IN (SELECT investigator_name FROM public.user_roles WHERE role = 'junior')
          OR inv2 IN (SELECT investigator_name FROM public.user_roles WHERE role = 'junior')
        )
    )
  );

-- 2.3 Junior Investigators: Read all assigned cases, update own cases only
CREATE POLICY "cases_junior_read_access" ON public.cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'junior'
    )
  );

CREATE POLICY "cases_junior_write_access" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'junior'
    )
  );

CREATE POLICY "cases_junior_update_access" ON public.cases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'junior'
        AND (inv1 = ur.investigator_name OR inv2 = ur.investigator_name)
    )
  );

-- 2.4 Accounts: Read all cases, update payment & billing fields
CREATE POLICY "cases_accounts_read_access" ON public.cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'accounts'
    )
  );

CREATE POLICY "cases_accounts_update_access" ON public.cases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'accounts'
    )
  );

-- 2.5 Insurance Company Client Portal: Read-only access to own company cases
CREATE POLICY "cases_company_portal_read" ON public.cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) 
        AND ur.role = 'company'
        AND ur.company_name = company
    )
  );

-- ============================================================
-- 3. HARDEN INVESTIGATORS TABLE RLS (SEC-02)
-- ============================================================
ALTER TABLE public.investigators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow logged-in users full access to investigators" ON public.investigators;
DROP POLICY IF EXISTS "investigators_authenticated_all" ON public.investigators;
DROP POLICY IF EXISTS "investigators_admin_all" ON public.investigators;
DROP POLICY IF EXISTS "investigators_staff_read" ON public.investigators;
DROP POLICY IF EXISTS "investigators_update_own" ON public.investigators;

-- 3.1 Admin: Full management
CREATE POLICY "investigators_admin_all" ON public.investigators
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.2 Staff (senior, junior, accounts): Read access
CREATE POLICY "investigators_staff_read" ON public.investigators
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) 
        AND role IN ('admin', 'senior', 'junior', 'accounts')
    )
  );

-- 3.3 Investigator self-service update (profile, contact info)
CREATE POLICY "investigators_update_own" ON public.investigators
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) 
        AND ur.role IN ('senior', 'junior')
        AND name = ur.investigator_name
    )
  );

-- ============================================================
-- 4. HARDEN AGENCY SETTINGS TABLE RLS (SEC-02)
-- ============================================================
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow logged-in users full access to agency_settings" ON public.agency_settings;
DROP POLICY IF EXISTS "settings_admin_all" ON public.agency_settings;
DROP POLICY IF EXISTS "settings_read_all" ON public.agency_settings;
DROP POLICY IF EXISTS "agency_settings_admin_all" ON public.agency_settings;
DROP POLICY IF EXISTS "agency_settings_authenticated_read" ON public.agency_settings;

-- 4.1 Admin: Full control
CREATE POLICY "agency_settings_admin_all" ON public.agency_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.2 Authenticated Users: Read-only access to agency info/letterhead
CREATE POLICY "agency_settings_authenticated_read" ON public.agency_settings
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- 5. IMMUTABLE AUDIT TRAIL PROTECTION (SEC-06, SEC-07)
-- ============================================================
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow logged-in users full access to activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_all" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_read" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;

-- 5.1 Activity log: Read by staff/admins
CREATE POLICY "activity_log_read" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) 
        AND role IN ('admin', 'senior', 'junior', 'accounts')
    )
  );

-- 5.2 Activity log: INSERT only (Append-only immutable audit trail)
CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5.3 Investigator Audit Log: Restrict to Admin & Senior managers
ALTER TABLE public.investigator_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_all" ON public.investigator_audit_log;
DROP POLICY IF EXISTS "audit_authenticated_read" ON public.investigator_audit_log;
DROP POLICY IF EXISTS "investigator_audit_admin_all" ON public.investigator_audit_log;
DROP POLICY IF EXISTS "investigator_audit_manager_read" ON public.investigator_audit_log;

CREATE POLICY "investigator_audit_admin_all" ON public.investigator_audit_log
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "investigator_audit_manager_read" ON public.investigator_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) 
        AND role IN ('admin', 'senior')
    )
  );

-- ============================================================
-- 6. SET UP INVESTIGATOR PAYOUTS & TDS RLS (SEC-09)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investigator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_name TEXT NOT NULL,
  month_code TEXT NOT NULL,
  month_label TEXT,
  payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cases NUMERIC(10,1) DEFAULT 0,
  gross_fees NUMERIC(10,2) DEFAULT 0,
  gross_ta NUMERIC(10,2) DEFAULT 0,
  expenses_amount NUMERIC(10,2) DEFAULT 0,
  gross_total NUMERIC(10,2) DEFAULT 0,
  taxable_base NUMERIC(10,2) DEFAULT 0,
  tds_rate NUMERIC(5,2) DEFAULT 0,
  tds_section TEXT DEFAULT '0%',
  tds_amount NUMERIC(10,2) DEFAULT 0,
  net_disbursable NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Paid',
  payment_mode TEXT DEFAULT 'Bank Transfer',
  reference_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT unique_inv_month_payout UNIQUE (investigator_name, month_code)
);

ALTER TABLE public.investigator_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts_admin_all" ON public.investigator_payouts;
DROP POLICY IF EXISTS "payouts_accounts_all" ON public.investigator_payouts;
DROP POLICY IF EXISTS "payouts_investigator_read_own" ON public.investigator_payouts;

-- 6.1 Admin: Full access
CREATE POLICY "payouts_admin_all" ON public.investigator_payouts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6.2 Accounts: Full management of payout slips & TDS records
CREATE POLICY "payouts_accounts_all" ON public.investigator_payouts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'accounts'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (SELECT auth.uid()) AND role = 'accounts'
    )
  );

-- 6.3 Investigator: Read own settlement slips
CREATE POLICY "payouts_investigator_read_own" ON public.investigator_payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) 
        AND ur.role IN ('senior', 'junior')
        AND ur.investigator_name = investigator_name
    )
  );

-- ============================================================
-- 7. PERFORMANCE COVERING INDEX (PERF-01)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_inv_name ON public.user_roles(investigator_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);
