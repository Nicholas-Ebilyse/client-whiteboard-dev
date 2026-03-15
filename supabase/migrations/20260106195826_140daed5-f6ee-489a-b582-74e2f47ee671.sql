-- Add is_invoiced column to notes table
ALTER TABLE public.notes ADD COLUMN is_invoiced BOOLEAN NOT NULL DEFAULT false;