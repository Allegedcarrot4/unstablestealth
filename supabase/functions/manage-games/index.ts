import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://egjyojbtzxurjpptgruu.supabase.co',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://lovable.dev',
  'https://gptengineer.app'
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.dev') || origin.endsWith('.gptengineer.app') || origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')
  ) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, device_id, game_id, title, source_code, image_base64, image_filename } = await req.json();

    if (!action || !device_id) {
      return new Response(
        JSON.stringify({ error: 'action and device_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is an owner
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
      .eq('device_id', device_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_banned) {
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owners can manage games' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'add': {
        if (!title || !source_code) {
          return new Response(
            JSON.stringify({ error: 'title and source_code required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let imageUrl = null;

        // Handle image upload if provided
        if (image_base64 && image_filename) {
          const base64Data = image_base64.split(',')[1] || image_base64;
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const ext = image_filename.split('.').pop() || 'png';
          const fileName = `${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('game-images')
            .upload(fileName, binaryData, {
              contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
              upsert: false
            });

          if (uploadError) {
            console.error('Image upload failed:', uploadError);
            return new Response(
              JSON.stringify({ error: 'Failed to upload image' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: publicUrl } = supabase.storage
            .from('game-images')
            .getPublicUrl(fileName);

          imageUrl = publicUrl.publicUrl;
        }

        const { data: game, error: insertError } = await supabase
          .from('games')
          .insert({
            title: title.trim(),
            source_code: source_code.trim(),
            image_url: imageUrl,
            created_by: session.id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Game insert failed:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to add game' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Game added successfully:', game.id);
        return new Response(
          JSON.stringify({ success: true, game }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!game_id) {
          return new Response(
            JSON.stringify({ error: 'game_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get game to delete its image
        const { data: existingGame } = await supabase
          .from('games')
          .select('image_url')
          .eq('id', game_id)
          .single();

        // Delete image from storage if exists
        if (existingGame?.image_url) {
          const fileName = existingGame.image_url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('game-images').remove([fileName]);
          }
        }

        const { error: deleteError } = await supabase
          .from('games')
          .delete()
          .eq('id', game_id);

        if (deleteError) {
          console.error('Game delete failed:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to delete game' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Game deleted successfully:', game_id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Manage-games function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
