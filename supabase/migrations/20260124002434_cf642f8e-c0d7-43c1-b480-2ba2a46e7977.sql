-- Create function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create apps table (mirrors games table structure)
CREATE TABLE public.apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_code TEXT NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES public.sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- Create policies for apps (same as games)
CREATE POLICY "Anyone can view apps" 
ON public.apps 
FOR SELECT 
USING (true);

CREATE POLICY "Owners can insert apps" 
ON public.apps 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = created_by 
    AND role = 'owner' 
    AND is_banned = false
  )
);

CREATE POLICY "Owners can update apps" 
ON public.apps 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = apps.created_by 
    AND role = 'owner' 
    AND is_banned = false
  )
);

CREATE POLICY "Owners can delete apps" 
ON public.apps 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = apps.created_by 
    AND role = 'owner' 
    AND is_banned = false
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_apps_updated_at
BEFORE UPDATE ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for apps table
ALTER PUBLICATION supabase_realtime ADD TABLE public.apps;

-- Create storage bucket for app images
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-images', 'app-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for app-images bucket
CREATE POLICY "App images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'app-images');

CREATE POLICY "Owners can upload app images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'app-images');

CREATE POLICY "Owners can update app images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'app-images');

CREATE POLICY "Owners can delete app images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'app-images');