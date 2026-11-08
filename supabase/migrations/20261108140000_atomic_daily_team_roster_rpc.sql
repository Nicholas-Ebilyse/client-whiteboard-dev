-- ============================================================================
-- Migration: Atomic Daily Team Roster RPC & Concurrency Hardening
-- ============================================================================

-- 1. Create missing indexes for fast concurrency locking and lookups
CREATE INDEX IF NOT EXISTS idx_daily_rosters_date_tech
  ON public.daily_team_rosters(date, technician_id);

CREATE INDEX IF NOT EXISTS idx_technicians_team_id
  ON public.technicians(team_id)
  WHERE team_id IS NOT NULL;

-- 2. Transactional RPC for atomic daily team roster updates
CREATE OR REPLACE FUNCTION public.set_daily_team_roster(
  p_date DATE,
  p_team_name TEXT,
  p_rosters JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_tech_id UUID;
  v_is_leader BOOLEAN;
  v_tech_name TEXT;
  v_conflicting_team TEXT;
  v_count INT := 0;
BEGIN
  IF p_date IS NULL OR p_team_name IS NULL OR trim(p_team_name) = '' THEN
    RAISE EXCEPTION 'Date et nom d''équipe obligatoires';
  END IF;

  -- Concurrency Lock: Lock existing records for this date to serialize concurrent updates
  PERFORM 1 
  FROM public.daily_team_rosters 
  WHERE date = p_date 
  FOR UPDATE;

  -- Validate technician conflicts across other teams
  IF p_rosters IS NOT NULL AND jsonb_array_length(p_rosters) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_rosters) LOOP
      v_tech_id := (v_item->>'technician_id')::uuid;

      IF v_tech_id IS NOT NULL THEN
        -- Check if technician is assigned to a different team on this date
        SELECT r.team_name, COALESCE(t.name, 'Inconnu')
        INTO v_conflicting_team, v_tech_name
        FROM public.daily_team_rosters r
        LEFT JOIN public.technicians t ON t.id = r.technician_id
        WHERE r.date = p_date 
          AND r.team_name <> p_team_name 
          AND r.technician_id = v_tech_id
        LIMIT 1;

        IF v_conflicting_team IS NOT NULL THEN
          RAISE EXCEPTION 'Le technicien "%" est déjà affecté à l''équipe "%" le %.', 
            v_tech_name, v_conflicting_team, p_date;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Atomically clear current roster for this team and date
  DELETE FROM public.daily_team_rosters
  WHERE date = p_date AND team_name = p_team_name;

  -- Atomically insert new members
  IF p_rosters IS NOT NULL AND jsonb_array_length(p_rosters) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_rosters) LOOP
      v_tech_id := (v_item->>'technician_id')::uuid;
      v_is_leader := COALESCE((v_item->>'is_team_leader')::boolean, false);

      IF v_tech_id IS NOT NULL THEN
        INSERT INTO public.daily_team_rosters (
          date,
          team_name,
          technician_id,
          is_team_leader
        ) VALUES (
          p_date,
          p_team_name,
          v_tech_id,
          v_is_leader
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'date', p_date,
    'team_name', p_team_name,
    'inserted', v_count
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.set_daily_team_roster(DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_daily_team_roster(DATE, TEXT, JSONB) TO service_role;

