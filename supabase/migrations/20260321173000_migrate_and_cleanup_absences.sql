-- 1. Migrate existing team-level or technician absences that have a distinct technician_id into the strict absences table.
-- Any assignment marked as an absence WITH a known technician_id will be preserved in the proper table.
INSERT INTO public.absences (technician_id, start_date, end_date, reason)
SELECT technician_id, start_date, end_date, COALESCE(absence_reason, name)
FROM public.assignments
WHERE is_absent = true AND technician_id IS NOT NULL;

-- 2. Delete all assignments that are flagged as absences. This cleans out any pure team-level
-- absences that lacked a specific technician, and cleans out the migrated records.
DELETE FROM public.assignments
WHERE is_absent = true;

-- 3. Drop the temporary/legacy columns used for tracking absences on jobs
ALTER TABLE public.assignments
DROP COLUMN IF EXISTS is_absent,
DROP COLUMN IF EXISTS absence_reason;
