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
    const { device_id, is_typing } = await req.json();

    if (!device_id || typeof is_typing !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'device_id and is_typing (boolean) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session for this device
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, is_banned')
      .eq('device_id', device_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_banned) {
      return new Response(
        JSON.stringify({ error: 'You are banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert typing indicator
    const { error: upsertError } = await supabase
      .from('typing_indicators')
      .upsert({
        session_id: session.id,
        is_typing,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      });

    if (upsertError) {
      // If upsert fails due to no conflict column, try insert then update
      const { data: existing } = await supabase
        .from('typing_indicators')
        .select('id')
        .eq('session_id', session.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('typing_indicators')
          .update({ is_typing, updated_at: new Date().toISOString() })
          .eq('session_id', session.id);
      } else {
        await supabase
          .from('typing_indicators')
          .insert({ session_id: session.id, is_typing });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Typing indicator error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
