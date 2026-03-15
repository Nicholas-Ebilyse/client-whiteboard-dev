-- Create app_settings table for configurable application settings
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete settings"
ON public.app_settings FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Insert default max assignments setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('max_assignments_per_period', '3', 'Maximum number of assignments allowed per technician per period');