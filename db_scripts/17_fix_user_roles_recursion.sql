-- ============================================================
-- 17_fix_user_roles_recursion.sql
-- Fixes: ERROR 42P17 (infinite recursion detected in policy for relation "user_roles")
-- ============================================================

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON public.user_roles;

-- 2. Clean, Non-recursive SELECT policy:
-- Authenticated users can read user_roles (0 subqueries, 0% recursion risk)
CREATE POLICY "user_roles_read_all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

-- 3. Only Admin can INSERT / UPDATE / DELETE user_roles (strictly separated from SELECT)
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. Ensure admin record is present for your login
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'jairanjeet992@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
