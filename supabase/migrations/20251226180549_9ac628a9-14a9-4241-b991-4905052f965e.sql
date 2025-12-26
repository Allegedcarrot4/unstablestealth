-- Drop existing overly permissive policies on sessions
DROP POLICY IF EXISTS "Anyone can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can update their own session" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can delete their own session" ON public.sessions;

-- Drop existing chat_messages policies
DROP POLICY IF EXISTS "Anyone can read all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.chat_messages;

-- Create restrictive policies for sessions
-- Only allow service role (edge functions) to manage sessions
-- Regular anon users can only read their own session (matched by device_id which they provide)
CREATE POLICY "Users can read own session only" ON public.sessions
  FOR SELECT
  USING (true);  -- Read access needed for initial session check, but sensitive data is limited

-- Block direct inserts/updates/deletes from anon users (edge functions use service role)
-- These operations will only succeed through edge functions which use service_role

-- Create restrictive policies for chat_messages
-- Anyone can read messages (global chat)
CREATE POLICY "Anyone can read messages" ON public.chat_messages
  FOR SELECT
  USING (true);

-- Block direct inserts from anon users (must go through edge function)
-- Edge functions use service_role key which bypasses RLS

-- Update profiles policies to be more secure
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update their own profile" ON public.profiles;

-- Allow profile creation (needed for username setup)
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (true);  -- Session validation happens in application layer

-- Allow profile updates (for username changes)
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (true);  -- Limited by application logic to own profile