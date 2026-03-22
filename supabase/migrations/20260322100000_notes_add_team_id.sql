-- Migration: Replace technician_id with team_id on notes
-- Customer requirement: associate notes with a team and not with an individual technician.

-- Step 1: Add team_id column
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Step 2: Backfill team_id from the technician's team where possible
UPDATE notes n
SET team_id = t.team_id
FROM technicians t
WHERE n.technician_id = t.id
  AND t.team_id IS NOT NULL
  AND n.team_id IS NULL;

-- Step 3: Remove foreign key constraint for technician_id
-- Find and drop the foreign key constraint on technician_id
ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_technician_id_fkey;

-- Step 4: Drop legacy technician_id column
ALTER TABLE notes
  DROP COLUMN IF EXISTS technician_id;
