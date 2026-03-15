-- Add start_period and end_period to notes table
ALTER TABLE public.notes 
ADD COLUMN start_period TEXT NOT NULL DEFAULT 'Matin',
ADD COLUMN end_period TEXT NOT NULL DEFAULT 'Après-midi';

-- Update the period column to be start_period for existing notes
UPDATE public.notes SET start_period = period WHERE period IS NOT NULL;

-- Now we can make period nullable or keep it for backward compatibility
-- Let's keep it for now but it will be deprecated in favor of start_period/end_period