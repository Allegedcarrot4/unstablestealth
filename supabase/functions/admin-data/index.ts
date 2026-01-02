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
    origin === allowed || origin.endsWith('.lovable.dev') || origin.endsWith('.gptengineer.app')
  ) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { device_id } = await req.json();

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: device_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin
    const { data: callerSession, error: callerError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
      .eq('device_id', device_id)
      .single();

    if (callerError || !callerSession) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - session not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.is_banned) {
      console.log('Admin-data: banned user attempt');
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.role !== 'admin' && callerSession.role !== 'owner') {
      console.log('Admin-data: non-admin attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all admin data using service role
    const [sessionsRes, bannedRes, messagesRes, profilesRes] = await Promise.all([
      supabase.from('sessions').select('*').order('last_active_at', { ascending: false }),
      supabase.from('banned_devices').select('*').order('banned_at', { ascending: false }),
      supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('session_id, username')
    ]);

    console.log('Admin-data: fetched successfully');

    return new Response(
      JSON.stringify({
        sessions: sessionsRes.data || [],
        bannedDevices: bannedRes.data || [],
        chatMessages: messagesRes.data || [],
        profiles: profilesRes.data || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin-data function error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
