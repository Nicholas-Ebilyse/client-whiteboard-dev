-- Update RLS policies to allow authenticated users to modify data
-- Only admins can manage users, but all authenticated users can modify planning data

-- Technicians: Allow all authenticated users to insert/update
DROP POLICY IF EXISTS "Admins can insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins can update technicians" ON public.technicians;

CREATE POLICY "Authenticated users can insert technicians" 
ON public.technicians 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update technicians" 
ON public.technicians 
FOR UPDATE 
TO authenticated 
USING (true);

-- Keep delete as admin-only
-- (Admins can delete technicians policy already exists)

-- Assignments: Allow all authenticated users to insert/update/delete
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.assignments;

CREATE POLICY "Authenticated users can insert assignments" 
ON public.assignments 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments" 
ON public.assignments 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete assignments" 
ON public.assignments 
FOR DELETE 
TO authenticated 
USING (true);

-- Notes: Allow all authenticated users to insert/update/delete
DROP POLICY IF EXISTS "Admins can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can update notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;

CREATE POLICY "Authenticated users can insert notes" 
ON public.notes 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update notes" 
ON public.notes 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete notes" 
ON public.notes 
FOR DELETE 
TO authenticated 
USING (true);

-- Chantiers: Allow all authenticated users to insert/update/delete
DROP POLICY IF EXISTS "Admins can insert chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Admins can update chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Admins can delete chantiers" ON public.chantiers;

CREATE POLICY "Authenticated users can insert chantiers" 
ON public.chantiers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update chantiers" 
ON public.chantiers 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete chantiers" 
ON public.chantiers 
FOR DELETE 
TO authenticated 
USING (true);

-- Week config: Allow all authenticated users to insert/update/delete
DROP POLICY IF EXISTS "Admins can insert week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can update week_config" ON public.week_config;
DROP POLICY IF EXISTS "Admins can delete week_config" ON public.week_config;

CREATE POLICY "Authenticated users can insert week_config" 
ON public.week_config 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update week_config" 
ON public.week_config 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete week_config" 
ON public.week_config 
FOR DELETE 
TO authenticated 
USING (true);

-- Commandes: Keep as view-only for all, but allow authenticated users to modify
DROP POLICY IF EXISTS "Admins can insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can update commandes" ON public.commandes;
DROP POLICY IF EXISTS "Admins can delete commandes" ON public.commandes;

CREATE POLICY "Authenticated users can insert commandes" 
ON public.commandes 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update commandes" 
ON public.commandes 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete commandes" 
ON public.commandes 
FOR DELETE 
TO authenticated 
USING (true);

-- User roles table remains admin-only
-- (These policies already exist and are correct)