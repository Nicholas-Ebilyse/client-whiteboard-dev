-- Migration to add new fields requested for bidirectional sync
-- Date: 2026-03-13

-- Add is_interim to technicians
ALTER TABLE public.technicians 
ADD COLUMN is_interim BOOLEAN DEFAULT false;

-- Add flags to notes
ALTER TABLE public.notes
ADD COLUMN is_sav BOOLEAN DEFAULT false,
ADD COLUMN is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN is_billed BOOLEAN DEFAULT false;

-- Comment on columns for clarity
COMMENT ON COLUMN public.technicians.is_interim IS 'Indicates if the technician is an interim worker';
COMMENT ON COLUMN public.notes.is_sav IS 'Flag indicating if this note is related to SAV';
COMMENT ON COLUMN public.notes.is_confirmed IS 'Flag indicating if this note/event is confirmed';
COMMENT ON COLUMN public.notes.is_billed IS 'Flag indicating if this note/event is billed';
