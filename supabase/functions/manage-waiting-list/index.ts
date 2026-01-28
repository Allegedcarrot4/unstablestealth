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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, device_id, waiting_id } = await req.json();

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'Missing device_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is an owner
    const { data: callerSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('device_id', device_id)
      .maybeSingle();

    if (!callerSession || callerSession.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owners can manage the waiting list' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'list') {
      // Get all waiting list entries
      const { data: waitingList, error } = await supabase
        .from('waiting_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch waiting list:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch waiting list' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ waiting_list: waitingList }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve' || action === 'deny') {
      if (!waiting_id) {
        return new Response(
          JSON.stringify({ error: 'Missing waiting_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newStatus = action === 'approve' ? 'approved' : 'denied';

      const { data, error } = await supabase
        .from('waiting_list')
        .update({
          status: newStatus,
          reviewed_by: callerSession.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', waiting_id)
        .select()
        .single();

      if (error) {
        console.error(`Failed to ${action} waiting list entry:`, error);
        return new Response(
          JSON.stringify({ error: `Failed to ${action} request` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Waiting list: ${action}d entry`, { waiting_id });

      return new Response(
        JSON.stringify({ success: true, entry: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!waiting_id) {
        return new Response(
          JSON.stringify({ error: 'Missing waiting_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('waiting_list')
        .delete()
        .eq('id', waiting_id);

      if (error) {
        console.error('Failed to delete waiting list entry:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to delete entry' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Waiting list: deleted entry', { waiting_id });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Manage waiting list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
