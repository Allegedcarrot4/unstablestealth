-- Add IP address column to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ip_address text;

-- Add IP address to banned_devices table
ALTER TABLE public.banned_devices ADD COLUMN IF NOT EXISTS ip_address text;

-- Create typing_indicators table for real-time typing status
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on typing_indicators
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read typing indicators
CREATE POLICY "Anyone can read typing indicators" ON public.typing_indicators FOR SELECT USING (true);

-- Block direct modifications (will use edge function)
CREATE POLICY "Block anon typing inserts" ON public.typing_indicators FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon typing updates" ON public.typing_indicators FOR UPDATE USING (false);
CREATE POLICY "Block anon typing deletes" ON public.typing_indicators FOR DELETE USING (false);

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active announcements
CREATE POLICY "Anyone can read announcements" ON public.announcements FOR SELECT USING (true);

-- Block direct modifications (will use edge function)
CREATE POLICY "Block anon announcement inserts" ON public.announcements FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon announcement updates" ON public.announcements FOR UPDATE USING (false);
CREATE POLICY "Block anon announcement deletes" ON public.announcements FOR DELETE USING (false);

-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- Create index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_sessions_ip ON public.sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_banned_devices_ip ON public.banned_devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_typing_session ON public.typing_indicators(session_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, expires_at);