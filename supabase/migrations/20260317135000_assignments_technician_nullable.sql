-- Drop NOT NULL constraint on technician_id for pure team assignments
ALTER TABLE public.assignments ALTER COLUMN technician_id DROP NOT NULL;
