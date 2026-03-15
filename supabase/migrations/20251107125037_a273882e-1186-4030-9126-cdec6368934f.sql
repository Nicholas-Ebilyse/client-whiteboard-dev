-- Fix RLS policies for new tables

-- Allow service to insert audit logs (system level)
CREATE POLICY "Service can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Allow service to insert/update user activity summary
CREATE POLICY "Service can manage user activity"
  ON public.user_activity_summary
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admins can update user activity summary
CREATE POLICY "Admins can update user activity"
  ON public.user_activity_summary
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Admins can insert user activity summary
CREATE POLICY "Admins can insert user activity"
  ON public.user_activity_summary
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));