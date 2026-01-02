-- Drop overly permissive policies on profiles table
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Block all direct client writes to profiles (now handled by edge function)
CREATE POLICY "Block anon profile inserts" ON public.profiles
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anon profile updates" ON public.profiles
  FOR UPDATE
  USING (false);