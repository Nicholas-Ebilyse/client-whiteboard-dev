-- Add address column to chantiers table
-- Date: 2026-03-13

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.invoices.address IS 'Full address of the chantier';
