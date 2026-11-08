-- Migration: Security & Performance Hardening
-- 1. Create missing presentation_tokens table
-- 2. Restore strict RLS enforcement for administrative mutations
-- 3. Add high-performance indexes for weekly planning queries

-- ── 1. PRESENTATION TOKENS TABLE ──
CREATE TABLE IF NOT EXISTS public.presentation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.presentation_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can validate active presentation tokens" ON public.presentation_tokens;
CREATE POLICY "Anyone can validate active presentation tokens"
  ON public.presentation_tokens FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "Admins can manage presentation tokens" ON public.presentation_tokens;
CREATE POLICY "Admins can manage presentation tokens"
  ON public.presentation_tokens FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 2. ROBUST IS_ADMIN FUNCTION ──
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND (is_suspended IS NULL OR is_suspended = false)
  )
$$;

-- ── 3. RESTORE STRICT RLS POLICIES ──

-- ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.assignments;

CREATE POLICY "Admins can insert assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update assignments"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete assignments"
  ON public.assignments FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- NOTES
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can update notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;

CREATE POLICY "Admins can insert notes"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update notes"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete notes"
  ON public.notes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- COMMANDES
DROP POLICY IF EXISTS "Authenticated users can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Authenticated users can delete commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can delete commandes" ON public.commandes;

CREATE POLICY "Admins can insert commandes"
  ON public.commandes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update commandes"
  ON public.commandes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete commandes"
  ON public.commandes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- TECHNICIANS
DROP POLICY IF EXISTS "Authenticated users can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Authenticated users can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Authenticated users can delete technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can delete technicians" ON public.technicians;

CREATE POLICY "Admins can insert technicians"
  ON public.technicians FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update technicians"
  ON public.technicians FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete technicians"
  ON public.technicians FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- TEAMS
DROP POLICY IF EXISTS "Authenticated users can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;

CREATE POLICY "Admins can insert teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete teams"
  ON public.teams FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- WEEK CONFIG
DROP POLICY IF EXISTS "Authenticated users can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Authenticated users can delete week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can delete week_config" ON public.week_config;

CREATE POLICY "Admins can insert week_config"
  ON public.week_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update week_config"
  ON public.week_config FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete week_config"
  ON public.week_config FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ── 4. PERFORMANCE INDEXES ──
CREATE INDEX IF NOT EXISTS idx_assignments_dates_active 
  ON public.assignments(start_date, end_date) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_assignments_team_id 
  ON public.assignments(team_id);

CREATE INDEX IF NOT EXISTS idx_assignments_commande_id 
  ON public.assignments(commande_id);

CREATE INDEX IF NOT EXISTS idx_assignments_group_id 
  ON public.assignments(assignment_group_id) 
  WHERE assignment_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_dates 
  ON public.notes(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_notes_team_id 
  ON public.notes(team_id);

CREATE INDEX IF NOT EXISTS idx_commandes_display_name 
  ON public.commandes(display_name);

CREATE INDEX IF NOT EXISTS idx_commandes_client 
  ON public.commandes(client);

CREATE INDEX IF NOT EXISTS idx_daily_rosters_lookup 
  ON public.daily_team_rosters(date, team_name);

