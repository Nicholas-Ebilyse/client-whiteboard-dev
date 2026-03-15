-- Fix audit log security: Remove permissive insert policy and restrict to admin read-only
-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.audit_logs;

-- Drop the existing insert policy if it exists with different name
DROP POLICY IF EXISTS "Service can manage user activity" ON public.audit_logs;

-- Only admins can read audit logs (policy already exists, but ensuring it's correct)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- No direct insert/update/delete policies - must go through edge function