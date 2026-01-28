-- Create waiting_list table for tracking pending user approvals
CREATE TABLE public.waiting_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES public.sessions(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Anyone can read waiting list (for checking own status)
CREATE POLICY "Anyone can read waiting list"
ON public.waiting_list
FOR SELECT
USING (true);

-- Block direct inserts/updates/deletes (handled by edge functions)
CREATE POLICY "Block anon waiting list inserts"
ON public.waiting_list
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block anon waiting list updates"
ON public.waiting_list
FOR UPDATE
USING (false);

CREATE POLICY "Block anon waiting list deletes"
ON public.waiting_list
FOR DELETE
USING (false);

-- Add trigger for updated_at
CREATE TRIGGER update_waiting_list_updated_at
BEFORE UPDATE ON public.waiting_list
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();