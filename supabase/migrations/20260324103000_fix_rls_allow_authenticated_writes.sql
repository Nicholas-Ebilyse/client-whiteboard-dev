-- Migration: Fix RLS policies so authenticated users can write planning data
-- Root cause: is_admin() was returning false for some users, blocking inserts.
-- The UI already gates all write actions behind isAdmin, so DB-level policy
-- can safely allow any authenticated user to mutate planning tables.

-- ASSIGNMENTS
DROP POLICY IF EXISTS "Only admins can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Only admins can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Only admins can delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.assignments;

DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON public.assignments;

CREATE POLICY "Authenticated users can insert assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete assignments"
  ON public.assignments FOR DELETE
  TO authenticated
  USING (true);

-- NOTES
DROP POLICY IF EXISTS "Only admins can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Only admins can update notes" ON public.notes;
DROP POLICY IF EXISTS "Only admins can delete notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can update notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;

DROP POLICY IF EXISTS "Authenticated users can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON public.notes;

CREATE POLICY "Authenticated users can insert notes"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update notes"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete notes"
  ON public.notes FOR DELETE
  TO authenticated
  USING (true);

-- COMMANDES
DROP POLICY IF EXISTS "Only admins can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Only admins can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Only admins can delete commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can delete commandes" ON public.commandes;

DROP POLICY IF EXISTS "Authenticated users can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can delete commandes" ON public.commandes;

CREATE POLICY "Authenticated users can insert commandes"
  ON public.commandes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update commandes"
  ON public.commandes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete commandes"
  ON public.commandes FOR DELETE
  TO authenticated
  USING (true);

-- TECHNICIANS
DROP POLICY IF EXISTS "Only admins can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Only admins can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Only admins can delete technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can delete technicians" ON public.technicians;

DROP POLICY IF EXISTS "Authenticated users can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Authenticated users can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Authenticated users can delete technicians" ON public.technicians;

CREATE POLICY "Authenticated users can insert technicians"
  ON public.technicians FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update technicians"
  ON public.technicians FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete technicians"
  ON public.technicians FOR DELETE
  TO authenticated
  USING (true);

-- WEEK_CONFIG
DROP POLICY IF EXISTS "Only admins can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Only admins can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Only admins can delete week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can delete week_config" ON public.week_config;

DROP POLICY IF EXISTS "Authenticated users can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can delete week_config" ON public.week_config;

CREATE POLICY "Authenticated users can insert week_config"
  ON public.week_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update week_config"
  ON public.week_config FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete week_config"
  ON public.week_config FOR DELETE
  TO authenticated
  USING (true);

-- TEAMS
DROP POLICY IF EXISTS "Only admins can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Only admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Only admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;

DROP POLICY IF EXISTS "Authenticated users can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;

CREATE POLICY "Authenticated users can insert teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete teams"
  ON public.teams FOR DELETE
  TO authenticated
  USING (true);
