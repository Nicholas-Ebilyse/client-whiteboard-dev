-- Add address column to chantiers table
-- Date: 2026-03-13

ALTER TABLE public.chantiers 
ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.chantiers.address IS 'Full address of the chantier';
