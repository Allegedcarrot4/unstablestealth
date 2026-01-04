-- Create site_settings table for global configuration (owner-only access)
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.sessions(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read site settings (needed to check if site is disabled)
CREATE POLICY "Anyone can read site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only service role can modify (via edge functions)
-- No INSERT/UPDATE/DELETE policies for anon users

-- Insert default site settings
INSERT INTO public.site_settings (key, value) VALUES 
  ('site_enabled', '{"enabled": true}'::jsonb);