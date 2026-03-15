-- Add display_below column to notes table for controlling note position in assignment cells
ALTER TABLE public.notes 
ADD COLUMN display_below BOOLEAN NOT NULL DEFAULT false;