-- Create storage bucket for game images
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-images', 'game-images', true);

-- Allow anyone to read game images
CREATE POLICY "Game images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-images');

-- Allow authenticated uploads via edge function (service role)
CREATE POLICY "Service role can upload game images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game-images');

CREATE POLICY "Service role can delete game images"
ON storage.objects FOR DELETE
USING (bucket_id = 'game-images');

-- Create games table
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_code TEXT NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES public.sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Anyone can read games
CREATE POLICY "Anyone can read games"
ON public.games FOR SELECT
USING (true);

-- Add realtime for games
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;