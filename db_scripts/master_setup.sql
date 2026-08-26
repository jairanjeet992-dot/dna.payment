-- ============================================================
-- DNA PAYMENTS — SUPABASE SCHEMA MIGRATION
-- ============================================================
-- Run this first in Supabase SQL Editor (Settings → SQL Editor)
-- This creates all necessary tables with proper structure
-- ============================================================

-- ============================================================
-- 1. AGENCY_SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL DEFAULT 'DNA Professional Investigation Agency',
  agency_address text DEFAULT '',
  logo_url text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. INVESTIGATORS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS investigators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  phone text,
  email text,
  address text,
  payment_type text DEFAULT 'Per Case', -- 'Per Case' or 'Salary'
  salary_amount numeric(12,2) DEFAULT 0,
  payment_type_changed_at timestamptz DEFAULT now(),
  is_base boolean DEFAULT true,  -- true = from base list, false = added later
  removed boolean DEFAULT false, -- soft delete
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigators_name ON investigators(name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_investigators_phone ON investigators(phone) WHERE phone IS NOT NULL AND btrim(phone) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_investigators_email ON investigators(email) WHERE email IS NOT NULL AND btrim(email) <> '';
ALTER TABLE investigators ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. CASES TABLE (Main ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document & Date
  doc_code text UNIQUE,
  date date,

  -- Company & Case Info
  company text,
  case_type text,  -- PA, CASHLESS, REIMBURSEMENT, MB, FVR, SPOT, PROJECT, HOSPICASH, POST FACTO
  claim_no text,
  policy_no text,

  -- Insured & Location
  insured_name text,
  hospital text,
  location text,
  invoice_no text,

  -- Investigators (primary & secondary)
  inv1 text,  -- investigator name
  inv2 text,
  fee1 numeric(12,2),
  fee2 numeric(12,2),
  ta1 numeric(12,2),   -- travel allowance
  ta2 numeric(12,2),

  -- Payment & Status
  total_payable numeric(12,2),
  received numeric(12,2),
  profit numeric(12,2),

  -- Investigation Status
  inv1_status text,    -- pending, in_progress, completed, etc.
  inv2_status text,
  hardcopy1_status text,
  hardcopy2_status text,
  company_hardcopy_status text,
  company_hardcopy_awb text,
  hardcopy_receive_date date,
  company_dispatch_date date,
  outcome text DEFAULT 'Pending',

  -- Metadata
  remarks text,
  owner_id uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_company ON cases(company);
CREATE INDEX IF NOT EXISTS idx_cases_date ON cases(date);
CREATE INDEX IF NOT EXISTS idx_cases_inv1 ON cases(inv1);
CREATE INDEX IF NOT EXISTS idx_cases_inv2 ON cases(inv2);
CREATE INDEX IF NOT EXISTS idx_cases_doc_code ON cases(doc_code);
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. INVESTIGATOR_DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS investigator_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id uuid NOT NULL REFERENCES investigators(id) ON DELETE CASCADE,
  doc_type text,  -- e.g., 'license', 'certificate', 'insurance', etc.
  file_name text NOT NULL,
  file_url text,  -- URL in Supabase Storage
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigator_documents_investigator ON investigator_documents(investigator_id);
ALTER TABLE investigator_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. USER_ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'senior', 'junior', 'accounts', 'company')),
  investigator_name text REFERENCES investigators(name),
  company_name text,  -- for 'company' role
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agency_settings
CREATE TRIGGER update_agency_settings_updated_at BEFORE UPDATE ON agency_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for investigators
CREATE TRIGGER update_investigators_updated_at BEFORE UPDATE ON investigators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for cases
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_roles
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
-- Next: Run 02_rls_policies.sql to set up Row Level Security
-- ============================================================
-- DNA PAYMENTS — SUPABASE RLS POLICIES
-- ============================================================
-- Run this second in Supabase SQL Editor
-- This establishes Row Level Security policies for all user roles
-- ============================================================

-- ============================================================
-- DNA PAYMENTS — ROLE MANAGEMENT HELPER FUNCTIONS
-- ============================================================
-- These allow an admin to assign roles by email without needing user_ids
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_role_to_email(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify the caller is an admin
  IF NOT (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')) THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id) DO UPDATE SET role = p_role, updated_at = now();
  ELSE
    RAISE EXCEPTION 'User with email % not found in Auth system', p_email;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_role_from_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify the caller is an admin
  IF NOT (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')) THEN
    RAISE EXCEPTION 'Only admins can remove roles';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_role_to_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_role_from_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- CASES TABLE POLICIES (UPDATED FOR STAFF VISIBILITY)
DROP POLICY IF EXISTS "cases_admin_all" ON cases;
DROP POLICY IF EXISTS "cases_senior_own_juniors" ON cases;
DROP POLICY IF EXISTS "cases_junior_own" ON cases;
DROP POLICY IF EXISTS "accounts_read_all" ON cases;
DROP POLICY IF EXISTS "accounts_update_payment" ON cases;
DROP POLICY IF EXISTS "company_own_cases" ON cases;

-- 1. ADMIN: All access
CREATE POLICY "cases_admin_all" ON cases FOR ALL TO authenticated 
USING (is_admin());

-- 2. SENIOR: Read ALL, but can only MODIFY own cases + junior cases
CREATE POLICY "cases_senior_read" ON cases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'senior'));

CREATE POLICY "cases_senior_modify" ON cases FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'senior'
    AND (
      cases.inv1 = ur.investigator_name OR cases.inv2 = ur.investigator_name
      OR cases.inv1 IN (SELECT investigator_name FROM user_roles WHERE role = 'junior')
      OR cases.inv2 IN (SELECT investigator_name FROM user_roles WHERE role = 'junior')
    )
  )
);

-- 3. JUNIOR: Read ALL, but can only MODIFY own cases
CREATE POLICY "cases_junior_read" ON cases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'junior'));

CREATE POLICY "cases_junior_modify" ON cases FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'junior'
    AND (cases.inv1 = ur.investigator_name OR cases.inv2 = ur.investigator_name)
  )
);

-- 4. ACCOUNTS: Read all, update all (restricted by app layer or trigger if needed)
CREATE POLICY "accounts_read_all" ON cases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accounts'));

CREATE POLICY "accounts_update_all" ON cases FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accounts'));

-- 5. COMPANY: Only their own company cases
CREATE POLICY "company_own_cases" ON cases FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'company'
    AND ur.company_name = cases.company
  )
);

-- INVESTIGATORS TABLE POLICIES (UPDATED)
DROP POLICY IF EXISTS "investigators_admin_all" ON investigators;
DROP POLICY IF EXISTS "senior_read_investigators" ON investigators;
DROP POLICY IF EXISTS "senior_update_own" ON investigators;
DROP POLICY IF EXISTS "junior_read_investigators" ON investigators;
DROP POLICY IF EXISTS "junior_update_own" ON investigators;
DROP POLICY IF EXISTS "accounts_read_investigators" ON investigators;

CREATE POLICY "investigators_admin_all" ON investigators FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "investigators_staff_read" ON investigators FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('senior', 'junior', 'accounts')));

CREATE POLICY "investigators_update_own" ON investigators FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('senior', 'junior')
    AND investigators.name = ur.investigator_name
  )
);

-- INVESTIGATOR_DOCUMENTS TABLE POLICIES
DROP POLICY IF EXISTS "docs_admin_all" ON investigator_documents;
DROP POLICY IF EXISTS "investigator_own_docs" ON investigator_documents;
DROP POLICY IF EXISTS "accounts_read_docs" ON investigator_documents;

CREATE POLICY "docs_admin_all" ON investigator_documents FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "investigator_own_docs" ON investigator_documents FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN investigators i ON i.name = ur.investigator_name
    WHERE ur.user_id = auth.uid() AND ur.role IN ('senior', 'junior')
    AND investigator_documents.investigator_id = i.id
  )
);

CREATE POLICY "accounts_read_docs" ON investigator_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accounts'));

-- USER_ROLES TABLE POLICIES
DROP POLICY IF EXISTS "user_roles_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin" ON user_roles;

CREATE POLICY "user_roles_own" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_admin" ON user_roles FOR ALL TO authenticated USING (is_admin());

-- AGENCY_SETTINGS TABLE POLICIES
DROP POLICY IF EXISTS "settings_admin_all" ON agency_settings;
DROP POLICY IF EXISTS "settings_read_all" ON agency_settings;

CREATE POLICY "settings_admin_all" ON agency_settings FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "settings_read_all" ON agency_settings FOR SELECT TO authenticated USING (true);
-- ============================================================
-- DNA PAYMENTS — SUPABASE SEED DATA
-- ============================================================
-- Run this third in Supabase SQL Editor
-- Seeds only default agency settings. Investigators are NOT pre-seeded.
-- Add investigators from the live application as needed.
-- ============================================================

-- 1. INITIAL AGENCY SETTINGS
INSERT INTO agency_settings (agency_name, agency_address)
VALUES (
  'DNA Professional Investigation Agency',
  'Head Office, Financial District'
)
ON CONFLICT DO NOTHING;

-- 2. INITIAL INVESTIGATORS
-- Intentionally empty. Investigator records are created/managed by an admin
-- from the application so the database never invents placeholder names.

-- ============================================================
-- 3. BOOTSTRAP ADMIN USER (MANUAL STEP)
-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > Authentication > Users > Add User
--    Example: email: admin@dnapayments.local, password: (strong password)
-- 2. Copy the generated User UUID from the Users table
-- 3. Replace 'YOUR_USER_UUID_HERE' below and run this query:
--
-- INSERT INTO user_roles (user_id, role)
-- VALUES ('YOUR_USER_UUID_HERE', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
-- ============================================================
-- ============================================================
-- DNA PAYMENTS — STORAGE SETUP & POLICIES
-- ============================================================
-- Run this fourth in Supabase SQL Editor
-- Sets up private Supabase Storage bucket and role-aware access
-- ============================================================

-- 1. CREATE / HARDEN STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'investigator-docs',
  'investigator-docs',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. STORAGE POLICIES
DROP POLICY IF EXISTS "Public access to investigator docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload investigator docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users read investigator docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage investigator docs" ON storage.objects;

CREATE POLICY "Authenticated users read investigator docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'investigator-docs'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin','senior','junior','accounts')
    )
  );

CREATE POLICY "Authenticated users upload investigator docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'investigator-docs'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin','senior','junior','accounts')
    )
  );

CREATE POLICY "Admins manage investigator docs" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'investigator-docs'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'investigator-docs'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
-- ============================================================
-- DNA PAYMENTS — APP / DATABASE COMPATIBILITY PATCH
-- ============================================================
-- Apply after 01_schema.sql through 04_storage_setup.sql.
-- Keeps the Supabase schema aligned with the current app.js.
-- ============================================================

ALTER TABLE investigators ADD COLUMN city text;
ALTER TABLE investigators ADD COLUMN state text;
ALTER TABLE investigators ADD COLUMN "designation" text;
ALTER TABLE investigators ADD COLUMN availability text DEFAULT 'available';

ALTER TABLE cases ADD COLUMN received_date date;
ALTER TABLE cases ADD COLUMN last_updated timestamptz;

CREATE OR REPLACE FUNCTION next_doc_code(p_month_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  SELECT COALESCE(MAX((regexp_match(doc_code, '-([0-9]+)$'))[1]::integer), 0) + 1
  INTO n
  FROM cases
  WHERE doc_code LIKE p_month_code || '-%';

  RETURN p_month_code || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION next_doc_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_doc_code(text) TO authenticated;
-- ============================================================
-- 6. CASE_OWNERSHIP_TRANSFERS TABLE (History)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  previous_owner text,
  new_owner text,
  transfer_date timestamptz DEFAULT now(),
  reason text,
  transferred_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE case_ownership_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read transfer history
CREATE POLICY "transfers_select" ON case_ownership_transfers FOR SELECT TO authenticated USING (true);

-- Policy: Only admin/senior/junior/accounts can insert (same as case edits)
CREATE POLICY "transfers_insert" ON case_ownership_transfers FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'senior', 'junior', 'accounts')
  )
);
-- DNA PAYMENTS — SETTINGS LEGACY COMPATIBILITY
-- Keeps the existing frontend's agency_settings id=1 contract while
-- preserving the original UUID in legacy_uuid.

ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS logo text;
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS legacy_uuid uuid;
UPDATE public.agency_settings SET legacy_uuid = id WHERE legacy_uuid IS NULL;
ALTER TABLE public.agency_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.agency_settings ALTER COLUMN id TYPE text USING id::text;
UPDATE public.agency_settings SET id = '1' WHERE id <> '1';
ALTER TABLE public.agency_settings ALTER COLUMN id SET DEFAULT '1';
ALTER TABLE public.agency_settings ADD CONSTRAINT agency_settings_single_row_id CHECK (id = '1');
UPDATE public.agency_settings SET logo = logo_url WHERE logo IS NULL AND logo_url IS NOT NULL;
-- DNA PAYMENTS — FULL APP / DATABASE COMPATIBILITY
-- Apply after 06_settings_legacy_compat.sql.
-- Mirrors the live production compatibility changes used by the frontend.

ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS alternate_phone text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS office_branch text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS joining_date date;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS experience_years numeric;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS max_active_cases integer DEFAULT 10;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS payment_rate numeric;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS payment_rate_type text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Per Case';
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS salary_amount numeric DEFAULT 0;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS payment_type_changed_at timestamptz DEFAULT now();
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.investigators ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

ALTER TABLE public.investigator_documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.investigator_documents ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE public.investigator_documents ADD COLUMN IF NOT EXISTS document_url text;
UPDATE public.investigator_documents SET document_type=doc_type WHERE document_type IS NULL;
UPDATE public.investigator_documents SET document_name=file_name WHERE document_name IS NULL;
UPDATE public.investigator_documents SET document_url=file_url WHERE document_url IS NULL;

CREATE TABLE IF NOT EXISTS public.investigator_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id uuid NOT NULL REFERENCES public.investigators(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigator_audit_log_inv ON public.investigator_audit_log(investigator_id, created_at DESC);
ALTER TABLE public.investigator_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_all" ON public.investigator_audit_log;
DROP POLICY IF EXISTS "audit_authenticated_read" ON public.investigator_audit_log;
CREATE POLICY "audit_admin_all" ON public.investigator_audit_log FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "audit_authenticated_read" ON public.investigator_audit_log FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.log_investigator_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.investigator_audit_log(investigator_id, action, details, created_by)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,
    CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('old_name',OLD.name,'new_name',NEW.name,'old_phone',OLD.phone,'new_phone',NEW.phone) ELSE jsonb_build_object('name',NEW.name) END,
    auth.uid()
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_investigator_audit ON public.investigators;
CREATE TRIGGER trg_investigator_audit AFTER INSERT OR UPDATE ON public.investigators FOR EACH ROW EXECUTE FUNCTION public.log_investigator_change();
REVOKE EXECUTE ON FUNCTION public.log_investigator_change() FROM PUBLIC;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cases_company_claim ON public.cases(company, claim_no) WHERE claim_no IS NOT NULL AND btrim(claim_no) <> '';

CREATE OR REPLACE FUNCTION public.calculate_case_financials()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.total_payable := COALESCE(NEW.fee1,0)+COALESCE(NEW.fee2,0)+COALESCE(NEW.ta1,0)+COALESCE(NEW.ta2,0);
  NEW.profit := COALESCE(NEW.received,0)-NEW.total_payable;
  NEW.last_updated := now();
  IF COALESCE(NEW.received,0) > 0 AND (TG_OP='INSERT' OR COALESCE(OLD.received,0) <> COALESCE(NEW.received,0)) THEN
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_calculate_case_financials ON public.cases;
CREATE TRIGGER trg_calculate_case_financials BEFORE INSERT OR UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.calculate_case_financials();

-- Keep document-code generation safe when two users save at the same time.
CREATE OR REPLACE FUNCTION public.next_doc_code(p_month_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dna-doc-code:' || p_month_code));
  SELECT COALESCE(MAX((regexp_match(doc_code, '-([0-9]+)$'))[1]::integer),0)+1
  INTO n FROM public.cases WHERE doc_code LIKE p_month_code || '-%';
  RETURN p_month_code || '-' || lpad(n::text,4,'0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_doc_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_doc_code(text) TO authenticated;

-- Investigator 360° case breakdown used by frontend/investigator-360/investigator-case-breakdown.js.
CREATE OR REPLACE FUNCTION public.get_investigator_case_breakdown(
  p_investigator_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  doc_code text,
  company text,
  case_type text,
  case_date date,
  investigator_outstanding numeric,
  investigator_status text,
  company_received numeric,
  investigator_cost numeric,
  investigator_paid numeric,
  agency_profit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    c.id,
    c.doc_code,
    c.company,
    c.case_type,
    c.date AS case_date,
    GREATEST(0, calc.investigator_cost - calc.investigator_paid) AS investigator_outstanding,
    calc.investigator_status,
    COALESCE(c.received,0) AS company_received,
    calc.investigator_cost,
    calc.investigator_paid,
    COALESCE(c.profit,0) AS agency_profit
  FROM public.cases c
  JOIN public.investigators i ON i.id = p_investigator_id AND i.removed = false
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(CASE WHEN c.inv1 = i.name AND (COALESCE(i.payment_type,'Per Case') <> 'Salary' OR c.date < i.payment_type_changed_at::date) THEN c.fee1 + c.ta1 ELSE 0 END,0)
      + COALESCE(CASE WHEN c.inv2 = i.name AND (COALESCE(i.payment_type,'Per Case') <> 'Salary' OR c.date < i.payment_type_changed_at::date) THEN c.fee2 + c.ta2 ELSE 0 END,0) AS investigator_cost,
      COALESCE(CASE WHEN c.inv1 = i.name AND (COALESCE(i.payment_type,'Per Case') <> 'Salary' OR c.date < i.payment_type_changed_at::date) AND c.inv1_status = 'Paid' THEN c.fee1 + c.ta1 ELSE 0 END,0)
      + COALESCE(CASE WHEN c.inv2 = i.name AND (COALESCE(i.payment_type,'Per Case') <> 'Salary' OR c.date < i.payment_type_changed_at::date) AND c.inv2_status = 'Paid' THEN c.fee2 + c.ta2 ELSE 0 END,0) AS investigator_paid,
      CASE
        WHEN c.inv1 = i.name AND c.inv2 = i.name THEN
          CASE
            WHEN COALESCE(c.inv1_status,'') = 'Paid' AND COALESCE(c.inv2_status,'') = 'Paid' THEN 'Paid'
            WHEN COALESCE(c.inv1_status,'') = 'Paid' OR COALESCE(c.inv2_status,'') = 'Paid' THEN 'Partial'
            WHEN (COALESCE(c.inv1_status,'') = '' AND COALESCE(c.inv2_status,'') = '') THEN 'Not Set'
            ELSE 'Pending'
          END
        WHEN c.inv1 = i.name THEN
          CASE
            WHEN COALESCE(c.inv1_status,'') = 'Paid' THEN 'Paid'
            WHEN COALESCE(c.inv1_status,'') = '' THEN 'Not Set'
            ELSE 'Pending'
          END
        WHEN c.inv2 = i.name THEN
          CASE
            WHEN COALESCE(c.inv2_status,'') = 'Paid' THEN 'Paid'
            WHEN COALESCE(c.inv2_status,'') = '' THEN 'Not Set'
            ELSE 'Pending'
          END
        ELSE 'Pending'
      END AS investigator_status
  ) calc
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','senior','junior','accounts')
    )
    AND (c.inv1 = i.name OR c.inv2 = i.name)
  ORDER BY c.date DESC NULLS LAST, c.doc_code DESC
  LIMIT GREATEST(COALESCE(p_limit,20),0)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
$$;
REVOKE EXECUTE ON FUNCTION public.get_investigator_case_breakdown(uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_investigator_case_breakdown(uuid,integer,integer) TO authenticated;

-- Enforce role limits at the database layer as a second line of defense.
CREATE OR REPLACE FUNCTION public.guard_case_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  r := get_my_role();
  IF TG_OP='DELETE' AND COALESCE(r,'') <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete cases';
  END IF;
  IF TG_OP='UPDATE' AND r='accounts' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.doc_code IS DISTINCT FROM OLD.doc_code
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.company IS DISTINCT FROM OLD.company
       OR NEW.case_type IS DISTINCT FROM OLD.case_type
       OR NEW.claim_no IS DISTINCT FROM OLD.claim_no
       OR NEW.policy_no IS DISTINCT FROM OLD.policy_no
       OR NEW.insured_name IS DISTINCT FROM OLD.insured_name
       OR NEW.hospital IS DISTINCT FROM OLD.hospital
       OR NEW.location IS DISTINCT FROM OLD.location
       OR NEW.invoice_no IS DISTINCT FROM OLD.invoice_no
       OR NEW.inv1 IS DISTINCT FROM OLD.inv1
       OR NEW.inv2 IS DISTINCT FROM OLD.inv2
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Accounts role can update payment fields only';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_case_mutations ON public.cases;
CREATE TRIGGER trg_guard_case_mutations BEFORE UPDATE OR DELETE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.guard_case_mutations();
REVOKE EXECUTE ON FUNCTION public.guard_case_mutations() FROM PUBLIC;

-- Atomic admin-only case restore. The delete and insert happen in one
-- function statement, so a failed insert rolls the delete back automatically.
CREATE OR REPLACE FUNCTION public.restore_cases_backup(p_cases jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE inserted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can restore case backups';
  END IF;
  IF jsonb_typeof(p_cases) <> 'array' THEN
    RAISE EXCEPTION 'Backup cases payload must be a JSON array';
  END IF;

  DELETE FROM public.cases;

  INSERT INTO public.cases(
    id,doc_code,date,company,case_type,claim_no,policy_no,insured_name,hospital,location,invoice_no,
    inv1,inv2,fee1,fee2,ta1,ta2,received,inv1_status,inv2_status,hardcopy1_status,hardcopy2_status,
    remarks,owner_id,created_by,created_at,updated_at
  )
  SELECT id,doc_code,date,company,case_type,claim_no,policy_no,insured_name,hospital,location,invoice_no,
    inv1,inv2,fee1,fee2,ta1,ta2,received,inv1_status,inv2_status,hardcopy1_status,hardcopy2_status,
    remarks,owner_id,created_by,created_at,updated_at
  FROM jsonb_to_recordset(p_cases) AS x(
    id uuid,doc_code text,date date,company text,case_type text,claim_no text,policy_no text,insured_name text,
    hospital text,location text,invoice_no text,inv1 text,inv2 text,fee1 numeric,fee2 numeric,ta1 numeric,ta2 numeric,
    received numeric,inv1_status text,inv2_status text,hardcopy1_status text,hardcopy2_status text,remarks text,
    owner_id uuid,created_by uuid,created_at timestamptz,updated_at timestamptz
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_cases_backup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_cases_backup(jsonb) TO authenticated;
-- DNA PAYMENTS — DYNAMIC COMPANIES
-- Moves the hardcoded COMPANIES array to the agency_settings table.

ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS companies jsonb DEFAULT '["ADITYA BIRLA","BRAINBIRD","CARE","CHOLA","IFFCO TOKIO","KOTAK","MAGMA","RELIANCE","SBI","STAR HEALTH","TATA AIA","TATA AIG","VIDAL HEALTH"]'::jsonb;
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS case_types jsonb DEFAULT '["PA","CASHLESS","REIMBURSEMENT","MB","FVR","SPOT","PROJECT","HOSPICASH","POST FACTO"]'::jsonb;
-- PHASE 2: SLA ENGINE
-- Adds SLA tracking columns to the cases table.

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS risk_level TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  module text,
  action text,
  reference_id text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
-- ============================================================
-- 10. EXCEPTION CASES UPDATE
-- ============================================================
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS exception_type TEXT,
ADD COLUMN IF NOT EXISTS exception_reason TEXT,
ADD COLUMN IF NOT EXISTS exception_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exception_by TEXT;

-- Index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_cases_exception_type ON cases(exception_type);
-- ============================================================
-- 5. CASE_OWNERSHIP_TRANSFERS TABLE (History)
-- ============================================================

-- ============================================================
-- USER_ROLES TABLE
-- ============================================================

-- Users can read their own role
CREATE POLICY "user_roles_own" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ADMIN: full access
CREATE POLICY "user_roles_admin" ON user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- AGENCY_SETTINGS TABLE
-- ============================================================

-- ADMIN: full access
CREATE POLICY "settings_admin_all" ON agency_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- OTHERS: read only
CREATE POLICY "settings_read_all" ON agency_settings
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- COMPANY VIEW (for company portal)
-- ============================================================
-- Create a view that companies see through their portal
CREATE OR REPLACE VIEW company_cases_view AS
SELECT
  c.doc_code, c.date, c.case_type, c.claim_no, c.policy_no,
  c.insured_name, c.hospital, c.location, c.invoice_no,
  c.inv1, c.inv2, c.fee1, c.fee2, c.ta1, c.ta2,
  c.total_payable, c.received, c.profit,
  c.inv1_status, c.inv2_status,
  c.hardcopy1_status, c.hardcopy2_status,
  c.remarks, c.created_at
FROM cases c
JOIN user_roles ur ON ur.company_name = c.company
WHERE ur.user_id = auth.uid() AND ur.role = 'company';

GRANT SELECT ON company_cases_view TO authenticated;

-- ============================================================
-- HELPER FUNCTION: Get current user's role
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_investigator()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT investigator_name FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- NOTES:
-- 1. After running this, test each role by logging in as that user
-- 2. The app's role-permissions.js already handles UI hiding
--    but RLS enforces security at the database level
-- 3. For "company" role, add `company_name` column to user_roles
--    or use a separate company_users table
-- ============================================================-- ============================================================
-- 11. FRAUD HEATMAP & INTELLIGENCE OUTCOME UPDATE
-- ============================================================

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS outcome TEXT DEFAULT 'Pending';

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_cases_outcome ON cases(outcome);
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
