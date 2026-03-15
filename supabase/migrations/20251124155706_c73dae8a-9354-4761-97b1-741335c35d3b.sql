-- Create sync status table to track synchronization attempts
CREATE TABLE IF NOT EXISTS public.sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running',
  records_synced integer DEFAULT 0,
  error_message text,
  error_details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Admins can view sync status
CREATE POLICY "Admins can view sync status"
  ON public.sync_status
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Only the system can insert sync status (no RLS policy for insert, will be done via service role)

-- Create index for faster queries
CREATE INDEX idx_sync_status_started_at ON public.sync_status(started_at DESC);
CREATE INDEX idx_sync_status_status ON public.sync_status(status);