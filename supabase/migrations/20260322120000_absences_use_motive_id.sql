-- Migration: Refactor absences to use motive_id Instead of text reason.

-- 1. Insert any custom text reasons from the absences table into the absence_motives table
--    This ensures no data is lost during the migration
INSERT INTO public.absence_motives (name)
SELECT DISTINCT TRIM(reason) 
FROM public.absences 
WHERE reason IS NOT NULL 
  AND TRIM(reason) != ''
  AND TRIM(reason) NOT IN (SELECT name FROM public.absence_motives);

-- 2. Add the motive_id column as a foreign key to absence_motives
ALTER TABLE public.absences 
ADD COLUMN motive_id UUID REFERENCES public.absence_motives(id) ON DELETE SET NULL;

-- 3. Backfill the motive_id by matching the trimmed text reason with the motive name
UPDATE public.absences a
SET motive_id = m.id
FROM public.absence_motives m
WHERE TRIM(a.reason) = m.name;

-- 4. Drop the original text column
ALTER TABLE public.absences 
DROP COLUMN reason;
