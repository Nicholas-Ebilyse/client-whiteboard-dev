-- Make technician_id nullable to support general notes for all technicians
ALTER TABLE public.notes ALTER COLUMN technician_id DROP NOT NULL;