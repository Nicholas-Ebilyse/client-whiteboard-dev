-- Create audit_logs table for tracking all user actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Create user_activity_summary table for tracking user sessions and activity
CREATE TABLE IF NOT EXISTS public.user_activity_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  last_action TIMESTAMP WITH TIME ZONE,
  total_actions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity_summary ENABLE ROW LEVEL SECURITY;

-- Admins can view all user activity
CREATE POLICY "Admins can view all user activity"
  ON public.user_activity_summary
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Add suspended column to user_roles if it doesn't exist
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_by UUID;

-- Create trigger to update updated_at on user_activity_summary
CREATE TRIGGER update_user_activity_summary_updated_at
  BEFORE UPDATE ON public.user_activity_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();