-- Fix 1: Block all client-side reads from sessions table (security fix)
DROP POLICY IF EXISTS "Users can read own session only" ON public.sessions;

CREATE POLICY "Block anon session reads" ON public.sessions
  FOR SELECT
  USING (false);

-- Fix 2: Create AI usage tracking table for server-side limit enforcement
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_session_week ON public.ai_usage(session_id, week_start);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Block all anonymous access (only edge functions with service_role can read/write)
CREATE POLICY "Block anon ai_usage access" ON public.ai_usage
  FOR ALL USING (false);