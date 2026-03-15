-- First, delete all existing chantiers data since it contains incorrect values
DELETE FROM public.chantiers;

-- Add unique constraint on external_id to enable proper upsert behavior
ALTER TABLE public.chantiers 
ADD CONSTRAINT chantiers_external_id_unique UNIQUE (external_id);