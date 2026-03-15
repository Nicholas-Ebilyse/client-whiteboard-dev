-- Add is_absent and is_confirmed columns to assignments table
ALTER TABLE public.assignments
ADD COLUMN is_absent boolean DEFAULT false,
ADD COLUMN is_confirmed boolean DEFAULT false;