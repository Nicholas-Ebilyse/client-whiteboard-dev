-- Add address field to chantiers table
ALTER TABLE public.chantiers 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add account activation fields for pending user signups
CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  activated_at TIMESTAMP WITH TIME ZONE,
  activated_by UUID REFERENCES auth.users(id),
  is_approved BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on pending_signups
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Only admins can view pending signups
CREATE POLICY "Admins can view pending signups"
ON public.pending_signups
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can manage pending signups
CREATE POLICY "Admins can manage pending signups"
ON public.pending_signups
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));