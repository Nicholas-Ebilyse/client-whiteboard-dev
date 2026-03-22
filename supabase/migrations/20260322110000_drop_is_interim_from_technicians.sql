-- Drop the unused is_interim column which was added previously but ignored in types.ts.
-- The application actively uses is_temp.
ALTER TABLE public.technicians DROP COLUMN is_interim;
