-- Add is_confirmed column to notes table
ALTER TABLE public.notes ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false;