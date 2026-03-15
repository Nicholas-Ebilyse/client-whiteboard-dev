-- Add employees table to store individual team members
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text UNIQUE,
  first_name text NOT NULL,
  is_temp boolean DEFAULT false,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create policies for employees
CREATE POLICY "Allow public read on employees" 
ON public.employees 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on employees" 
ON public.employees 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on employees" 
ON public.employees 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on employees" 
ON public.employees 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add external_id to existing tables for Google Sheets sync
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS members text;
ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS external_id text UNIQUE;