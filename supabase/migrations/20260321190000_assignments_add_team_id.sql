-- Migration: Replace technician_id with team_id on assignments
-- Assignments belong to a team, not an individual technician.
-- Individual technician absence is tracked in the 'absences' table instead.

-- Step 1: Add team_id column
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Step 2: Backfill team_id from the technician's team where possible
UPDATE assignments a
SET team_id = t.team_id
FROM technicians t
WHERE a.technician_id = t.id
  AND t.team_id IS NOT NULL
  AND a.team_id IS NULL;

-- Step 3: Drop legacy technician_id column
ALTER TABLE assignments
  DROP COLUMN IF EXISTS technician_id;

-- Step 4: Drop stale legacy columns that are no longer used
ALTER TABLE assignments
  DROP COLUMN IF EXISTS absence_reason,
  DROP COLUMN IF EXISTS is_absent,
  DROP COLUMN IF EXISTS second_technician_id,
  DROP COLUMN IF EXISTS start_period,
  DROP COLUMN IF EXISTS end_period;

-- Step 5: Make team_id NOT NULL now that backfill is done
-- (rows with no resolvable team_id will have been deleted or left null — 
--  if you want to enforce NOT NULL, uncomment the next line after verifying no nulls remain)
-- ALTER TABLE assignments ALTER COLUMN team_id SET NOT NULL;
