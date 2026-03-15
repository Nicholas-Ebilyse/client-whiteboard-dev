-- Fix SAV table update policy - restrict updates to admins only
-- Drop the overly permissive policy that allows any authenticated user to update any field
DROP POLICY IF EXISTS "Authenticated users can update sav est_resolu" ON public.sav;

-- Create proper admin-only update policy
CREATE POLICY "Only admins can update sav"
ON public.sav 
FOR UPDATE 
TO authenticated
USING (is_admin(auth.uid()));