-- ============================================================
-- Migration: Add Teams, Remove Periods, Remove second_technician_id
-- ============================================================

-- 1. Create the teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#3b82f6',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS: all authenticated users can read teams
CREATE POLICY "Teams are viewable by authenticated users"
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: only admins can modify teams
CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_teams_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_teams_updated_at();

-- 2. Add team_id to technicians (nullable — populated via UI after teams are created)
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. Add team_id to assignments (nullable until data is migrated)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 4. Drop period columns from assignments
ALTER TABLE public.assignments
  DROP COLUMN IF EXISTS start_period,
  DROP COLUMN IF EXISTS end_period;

-- 5. Drop second_technician_id from assignments
ALTER TABLE public.assignments
  DROP COLUMN IF EXISTS second_technician_id;

-- 6. Drop period columns from notes
ALTER TABLE public.notes
  DROP COLUMN IF EXISTS start_period,
  DROP COLUMN IF EXISTS end_period,
  DROP COLUMN IF EXISTS period;

-- 7. Seed a few default teams so the UI is immediately usable
INSERT INTO public.teams (name, color, position) VALUES
  ('E1', '#3b82f6', 0),
  ('E2', '#10b981', 1),
  ('E3', '#f59e0b', 2),
  ('E4', '#8b5cf6', 3)
ON CONFLICT DO NOTHING;
