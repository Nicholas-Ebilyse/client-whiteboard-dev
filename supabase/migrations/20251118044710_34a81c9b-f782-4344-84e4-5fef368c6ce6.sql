-- Fix RLS policy for pending_signups to allow anonymous inserts for signup
CREATE POLICY "Allow public to insert pending signups" 
ON public.pending_signups 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Ensure user_roles table has proper RLS for suspension checks
-- This allows authenticated users to read their own suspension status
CREATE POLICY "Users can view their own suspension status"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()));