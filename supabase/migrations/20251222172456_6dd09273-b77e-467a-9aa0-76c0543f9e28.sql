-- Fix conflicting RLS policies on user_roles table
-- The issue: Multiple RESTRICTIVE policies requiring ALL to pass creates conflicts
-- The "Deny anonymous access" policy with USING: false blocks everyone

-- Drop the conflicting SELECT policies
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own suspension status" ON public.user_roles;

-- Create a single, clear PERMISSIVE SELECT policy
-- Users can view their own role, admins can view all roles
CREATE POLICY "Users can view own role and admins can view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- Explicitly deny anonymous access with a policy that targets anon role
CREATE POLICY "Deny anonymous access"
ON public.user_roles
FOR SELECT
TO anon
USING (false);