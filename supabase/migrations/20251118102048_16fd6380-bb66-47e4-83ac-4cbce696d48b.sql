-- Allow authenticated users to update week_config (change current week)
-- but keep INSERT and DELETE restricted to admins

DROP POLICY IF EXISTS "Only admins can update week_config" ON public.week_config;

CREATE POLICY "Authenticated users can update week_config"
ON public.week_config FOR UPDATE
TO authenticated
USING (true);