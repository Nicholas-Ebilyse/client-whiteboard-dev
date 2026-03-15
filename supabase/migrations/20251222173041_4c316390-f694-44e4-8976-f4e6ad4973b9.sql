-- Add explicit deny policies for write operations on audit_logs table
-- Audit logs should be immutable - only service role (edge functions) can insert
-- No one should be able to update or delete audit records

-- Deny INSERT from authenticated users (only service role via edge functions)
CREATE POLICY "Deny direct insert on audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Deny UPDATE from all authenticated users (audit logs are immutable)
CREATE POLICY "Deny update on audit_logs"
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

-- Deny DELETE from all authenticated users (audit logs must be preserved)
CREATE POLICY "Deny delete on audit_logs"
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- Also deny anonymous access to all operations
CREATE POLICY "Deny anonymous select on audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Deny anonymous insert on audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "Deny anonymous update on audit_logs"
  ON public.audit_logs
  FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Deny anonymous delete on audit_logs"
  ON public.audit_logs
  FOR DELETE
  TO anon
  USING (false);