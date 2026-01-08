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
  const allowedOrigin =
    origin &&
    (allowedOrigins.includes(origin) ||
      origin.endsWith('.lovable.dev') ||
      origin.endsWith('.gptengineer.app') ||
      origin.endsWith('.lovableproject.com'))
      ? origin
      : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, device_id } = await req.json();

    if (!password || !device_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password against environment variables
    const ownerPassword = Deno.env.get('OWNER_PASSWORD');
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');
    const userPassword = Deno.env.get('USER_PASSWORD');

    if (!ownerPassword || !adminPassword || !userPassword) {
      console.error('Server configuration error: passwords not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password - check owner first, then admin, then user
    const isOwner = password === ownerPassword;
    const isAdmin = password === adminPassword;
    const isUser = password === userPassword;

    if (!isOwner && !isAdmin && !isUser) {
      console.log('Auth: invalid password attempt');
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const role = isOwner ? 'owner' : isAdmin ? 'admin' : 'user';

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if device is banned
    const { data: banData } = await supabase
      .from('banned_devices')
      .select('*')
      .eq('device_id', device_id)
      .maybeSingle();

    if (banData) {
      console.log('Auth: banned device attempt');
      return new Response(
        JSON.stringify({ error: 'Your device has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing session
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('device_id', device_id)
      .maybeSingle();

    let sessionData;

    if (existingSession) {
      // Update existing session
      const { data, error } = await supabase
        .from('sessions')
        .update({ role, last_active_at: new Date().toISOString() })
        .eq('id', existingSession.id)
        .select()
        .single();

      if (error) {
        console.error('Session update failed');
        return new Response(
          JSON.stringify({ error: 'Failed to update session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      sessionData = data;
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('sessions')
        .insert({ device_id, role })
        .select()
        .single();

      if (error) {
        console.error('Session creation failed');
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      sessionData = data;
    }

    // Check for existing profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('session_id', sessionData.id)
      .maybeSingle();

    console.log('Auth: successful login', { role });

    return new Response(
      JSON.stringify({
        session: {
          id: sessionData.id,
          device_id: sessionData.device_id,
          role: sessionData.role,
          is_banned: sessionData.is_banned,
          username: profile?.username || null
        },
        needsUsername: !profile?.username
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth function error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
