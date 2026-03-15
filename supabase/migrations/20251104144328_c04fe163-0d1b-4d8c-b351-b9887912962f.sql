-- Add new fields to assignments table
ALTER TABLE public.assignments 
ADD COLUMN absence_reason TEXT,
ADD COLUMN second_technician_id UUID REFERENCES public.technicians(id),
ADD COLUMN assignment_group_id UUID;

-- Add new fields to notes table
ALTER TABLE public.notes 
ADD COLUMN end_date DATE,
ADD COLUMN is_sav BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing notes: set end_date to match date
UPDATE public.notes SET end_date = date WHERE end_date IS NULL;

-- Rename date column to start_date for clarity
ALTER TABLE public.notes RENAME COLUMN date TO start_date;

-- Add archived status to technicians table
ALTER TABLE public.technicians 
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;