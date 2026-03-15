-- Create app_password table for password protection
CREATE TABLE IF NOT EXISTS public.app_password (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_password ENABLE ROW LEVEL SECURITY;

-- Allow public read and update (for password checking and setting)
CREATE POLICY "Allow public read on app_password"
ON public.app_password
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on app_password"
ON public.app_password
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on app_password"
ON public.app_password
FOR UPDATE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_password_updated_at
BEFORE UPDATE ON public.app_password
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();