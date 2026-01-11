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
    const { action, device_id, message, announcement_id, expires_hours } = await req.json();

    if (!action || !device_id) {
      return new Response(
        JSON.stringify({ error: 'action and device_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin or owner
    const { data: callerSession, error: callerError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
      .eq('device_id', device_id)
      .single();

    if (callerError || !callerSession) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.is_banned) {
      return new Response(
        JSON.stringify({ error: 'You are banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = callerSession.role === 'admin' || callerSession.role === 'owner';
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'create': {
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Message is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const expiresAt = expires_hours 
          ? new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString()
          : null;

        const { data: announcement, error: insertError } = await supabase
          .from('announcements')
          .insert({
            message: message.trim(),
            created_by: callerSession.id,
            expires_at: expiresAt,
            is_active: true
          })
          .select()
          .single();

        if (insertError) {
          console.error('Announcement insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create announcement' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Announcement created');
        return new Response(
          JSON.stringify({ success: true, announcement }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!announcement_id) {
          return new Response(
            JSON.stringify({ error: 'announcement_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabase
          .from('announcements')
          .delete()
          .eq('id', announcement_id);

        if (deleteError) {
          console.error('Announcement delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to delete announcement' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Announcement deleted');
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle': {
        if (!announcement_id) {
          return new Response(
            JSON.stringify({ error: 'announcement_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current state
        const { data: current } = await supabase
          .from('announcements')
          .select('is_active')
          .eq('id', announcement_id)
          .single();

        if (!current) {
          return new Response(
            JSON.stringify({ error: 'Announcement not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('announcements')
          .update({ is_active: !current.is_active })
          .eq('id', announcement_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to toggle announcement' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Announcement toggled');
        return new Response(
          JSON.stringify({ success: true, is_active: !current.is_active }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Announcements error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
