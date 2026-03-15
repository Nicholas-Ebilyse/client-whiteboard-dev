-- Make chantier_id nullable to allow absent assignments without a chantier
ALTER TABLE public.assignments 
ALTER COLUMN chantier_id DROP NOT NULL;