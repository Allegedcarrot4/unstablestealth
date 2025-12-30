import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, device_id, target_device_id, target_session_id } = await req.json();

    if (!action || !device_id) {
      console.error('Missing required fields: action or device_id');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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
      console.error('Caller session not found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - session not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.is_banned) {
      console.log('Banned user attempted admin operation');
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.role !== 'admin') {
      console.log('Non-admin attempted admin operation');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different admin actions
    switch (action) {
      case 'ban_device': {
        if (!target_device_id) {
          return new Response(
            JSON.stringify({ error: 'target_device_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent self-ban
        if (target_device_id === device_id) {
          return new Response(
            JSON.stringify({ error: 'Cannot ban yourself' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get target's role to check ban permissions
        const { data: targetSession } = await supabase
          .from('sessions')
          .select('role')
          .eq('device_id', target_device_id)
          .single();

        const targetRole = targetSession?.role || 'user';
        const callerRole = callerSession.role;

        // Admins can only ban users, not other admins or owners
        if (callerRole === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
          return new Response(
            JSON.stringify({ error: 'Admins can only ban users' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // No one can ban owners except owners themselves (already prevented by self-ban check)
        if (targetRole === 'owner' && callerRole !== 'owner') {
          return new Response(
            JSON.stringify({ error: 'Only owners can ban other owners' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Insert into banned_devices
        const { error: banError } = await supabase
          .from('banned_devices')
          .insert({
            device_id: target_device_id,
            banned_by: callerSession.id
          });

        if (banError) {
          console.error('Ban insert error:', banError);
          return new Response(
            JSON.stringify({ error: 'Failed to ban device' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update session to mark as banned
        await supabase
          .from('sessions')
          .update({ is_banned: true })
          .eq('device_id', target_device_id);

        console.log('Device banned successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Device banned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unban_device': {
        if (!target_device_id) {
          return new Response(
            JSON.stringify({ error: 'target_device_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete from banned_devices
        await supabase
          .from('banned_devices')
          .delete()
          .eq('device_id', target_device_id);

        // Update session to mark as not banned
        await supabase
          .from('sessions')
          .update({ is_banned: false })
          .eq('device_id', target_device_id);

        console.log('Device unbanned successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Device unbanned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_session': {
        if (!target_session_id || !target_device_id) {
          return new Response(
            JSON.stringify({ error: 'target_session_id and target_device_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent self-delete
        if (target_device_id === device_id) {
          return new Response(
            JSON.stringify({ error: 'Cannot delete your own session' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('sessions')
          .delete()
          .eq('id', target_session_id);

        console.log('Session deleted successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Session deleted' }),
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
    console.error('Admin operations error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
