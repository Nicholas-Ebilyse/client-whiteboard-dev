-- Add skills column to technicians
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS skills VARCHAR(255);
