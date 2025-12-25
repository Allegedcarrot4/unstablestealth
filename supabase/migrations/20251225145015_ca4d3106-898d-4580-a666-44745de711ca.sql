-- Create profiles table for usernames
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Anyone can insert their own profile
CREATE POLICY "Anyone can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);

-- Anyone can update their own profile
CREATE POLICY "Anyone can update their own profile"
ON public.profiles
FOR UPDATE
USING (true);

-- Add realtime for profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;