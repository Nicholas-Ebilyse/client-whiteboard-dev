-- Add is_invoiced boolean column to commandes table
ALTER TABLE public.commandes 
ADD COLUMN IF NOT EXISTS is_invoiced boolean NOT NULL DEFAULT false;