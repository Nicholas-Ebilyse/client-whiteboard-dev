-- Remove address field from commandes table
ALTER TABLE public.commandes DROP COLUMN IF EXISTS address;

-- Remove address field from chantiers table  
ALTER TABLE public.chantiers DROP COLUMN IF EXISTS address;

-- Rename chantiers table to invoices
ALTER TABLE public.chantiers RENAME TO invoices;