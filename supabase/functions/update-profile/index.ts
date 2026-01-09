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
      origin.endsWith('.lovableproject.com') ||
      origin.endsWith('.lovable.app'))
      ? origin
      : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

// Reserved words that cannot be used in usernames
const RESERVED_WORDS = ['admin', 'system', 'bot', 'moderator', 'mod', 'support', 'official', 'owner'];

// Username validation: alphanumeric, spaces, underscores, hyphens only
const isValidUsername = (username: string): { valid: boolean; error?: string } => {
  const trimmed = username.trim();
  
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { valid: false, error: 'Username must be 2-20 characters' };
  }
  
  // Only allow alphanumeric, space, underscore, hyphen
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, spaces, _ and -' };
  }
  
  // No multiple consecutive spaces
  if (/\s{2,}/.test(trimmed)) {
    return { valid: false, error: 'No multiple consecutive spaces allowed' };
  }
  
  // Check reserved words
  const lowerUsername = trimmed.toLowerCase();
  if (RESERVED_WORDS.some(word => lowerUsername.includes(word))) {
    return { valid: false, error: 'Username contains reserved words' };
  }
  
  return { valid: true };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, device_id } = await req.json();

    if (!username || !device_id) {
      return new Response(
        JSON.stringify({ error: 'Username and device_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate username server-side
    const validation = isValidUsername(username);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedUsername = username.trim();

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate device_id owns the session (server-side ownership check)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, is_banned')
      .eq('device_id', device_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_banned) {
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if profile exists for THIS session
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('session_id', session.id)
      .maybeSingle();

    if (existingProfile) {
      // Update profile for THIS session only (server controls session_id)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername })
        .eq('session_id', session.id);

      if (updateError) {
        console.error('Profile update failed');
        return new Response(
          JSON.stringify({ error: 'Failed to update username' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create profile for THIS session (server controls session_id)
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ 
          session_id: session.id,
          username: trimmedUsername 
        });

      if (insertError) {
        console.error('Profile creation failed');
        return new Response(
          JSON.stringify({ error: 'Failed to save username' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Profile updated successfully');

    return new Response(
      JSON.stringify({ success: true, username: trimmedUsername }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Profile update error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
