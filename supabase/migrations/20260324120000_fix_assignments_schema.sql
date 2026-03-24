-- Fix: drop legacy columns that still exist but are NOT used by the app.
-- The types.ts shows the DB does not have 'name', 'start_date', or 'team_id'
-- in the assignments table. Migration 20260315 added team_id, but the types
-- were regenerated without it or start_date.
-- This migration ensures the schema matches what the app expects.

-- Drop the legacy 'name' column if it still exists (was required in original schema, no longer used)
ALTER TABLE public.assignments DROP COLUMN IF EXISTS name;

-- Ensure start_date exists (was in original schema, should not have been dropped)
-- If it doesn't exist, add it back
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'start_date'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Ensure team_id exists (was added by 20260315190000)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Relax NOT NULL on start_date if it's still set (to allow inserts without it as fallback)
ALTER TABLE public.assignments ALTER COLUMN start_date DROP NOT NULL;
