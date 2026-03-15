-- Fix RLS policies to restrict INSERT, UPDATE, DELETE to admins only
-- Drop old permissive policies and create admin-only ones

-- TECHNICIANS TABLE
DROP POLICY IF EXISTS "Authenticated users can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Authenticated users can update technicians" ON public.technicians;

CREATE POLICY "Only admins can insert technicians"
ON public.technicians FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update technicians"
ON public.technicians FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- INVOICES TABLE
DROP POLICY IF EXISTS "Authenticated users can insert chantiers" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update chantiers" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete chantiers" ON public.invoices;

CREATE POLICY "Only admins can insert invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete invoices"
ON public.invoices FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ASSIGNMENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON public.assignments;

CREATE POLICY "Only admins can insert assignments"
ON public.assignments FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update assignments"
ON public.assignments FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete assignments"
ON public.assignments FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- NOTES TABLE
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON public.notes;

CREATE POLICY "Only admins can insert notes"
ON public.notes FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update notes"
ON public.notes FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete notes"
ON public.notes FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- COMMANDES TABLE
DROP POLICY IF EXISTS "Authenticated users can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can delete commandes" ON public.commandes;

CREATE POLICY "Only admins can insert commandes"
ON public.commandes FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update commandes"
ON public.commandes FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete commandes"
ON public.commandes FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- WEEK_CONFIG TABLE
DROP POLICY IF EXISTS "Authenticated users can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can delete week_config" ON public.week_config;

CREATE POLICY "Only admins can insert week_config"
ON public.week_config FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update week_config"
ON public.week_config FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete week_config"
ON public.week_config FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Create audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb,
  ip_address text
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON public.audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Drop unused app_password table
DROP TABLE IF EXISTS public.app_password;