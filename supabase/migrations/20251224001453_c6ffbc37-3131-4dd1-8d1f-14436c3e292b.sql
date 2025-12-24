-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create sessions table to track logged-in users
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'user',
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create banned_devices table for persistent bans
CREATE TABLE public.banned_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  banned_by UUID REFERENCES public.sessions(id),
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_devices ENABLE ROW LEVEL SECURITY;

-- Sessions policies - anyone can read their own session
CREATE POLICY "Anyone can read sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert sessions" ON public.sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update their own session" ON public.sessions
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete their own session" ON public.sessions
  FOR DELETE USING (true);

-- Banned devices policies
CREATE POLICY "Anyone can read banned devices" ON public.banned_devices
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert banned devices" ON public.banned_devices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete banned devices" ON public.banned_devices
  FOR DELETE USING (true);