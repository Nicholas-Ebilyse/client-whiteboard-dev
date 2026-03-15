-- Add explicit deny policies for write operations on sync_status table
-- Edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely
-- These policies prevent authenticated users from directly manipulating sync records

-- Deny INSERT from authenticated users (only service role via edge functions)
CREATE POLICY "Deny direct insert on sync_status"
  ON public.sync_status
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Deny UPDATE from authenticated users (only service role via edge functions)
CREATE POLICY "Deny direct update on sync_status"
  ON public.sync_status
  FOR UPDATE
  TO authenticated
  USING (false);

-- Deny DELETE from authenticated users (records should be kept for audit)
CREATE POLICY "Deny delete on sync_status"
  ON public.sync_status
  FOR DELETE
  TO authenticated
  USING (false);

-- Also deny anonymous access to write operations
CREATE POLICY "Deny anonymous insert on sync_status"
  ON public.sync_status
  FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "Deny anonymous update on sync_status"
  ON public.sync_status
  FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Deny anonymous delete on sync_status"
  ON public.sync_status
  FOR DELETE
  TO anon
  USING (false);