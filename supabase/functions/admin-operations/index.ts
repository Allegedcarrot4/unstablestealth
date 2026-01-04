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
    const { action, device_id, target_device_id, target_session_id, new_role, enabled } = await req.json();

    if (!action || !device_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin or owner
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
      console.log('Admin-ops: banned user attempt');
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRole = callerSession.role;
    const isOwner = callerRole === 'owner';
    const isAdmin = callerRole === 'admin' || isOwner;

    if (!isAdmin) {
      console.log('Admin-ops: non-admin attempt');
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

        // Role hierarchy: owner > admin > user
        // Owners can ban anyone (admins and users)
        // Admins can only ban users (not other admins or owners)
        if (targetRole === 'owner') {
          return new Response(
            JSON.stringify({ error: 'Cannot ban an owner' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (targetRole === 'admin' && !isOwner) {
          return new Response(
            JSON.stringify({ error: 'Only owners can ban admins' }),
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
          console.error('Admin-ops: ban operation failed');
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

        console.log('Admin-ops: device banned successfully');
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

        console.log('Admin-ops: device unbanned successfully');
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

        console.log('Admin-ops: session deleted successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Session deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_site': {
        // Only owners can toggle site
        if (!isOwner) {
          return new Response(
            JSON.stringify({ error: 'Only owners can toggle site status' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (typeof enabled !== 'boolean') {
          return new Response(
            JSON.stringify({ error: 'enabled (boolean) required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('site_settings')
          .update({ 
            value: { enabled },
            updated_at: new Date().toISOString(),
            updated_by: callerSession.id
          })
          .eq('key', 'site_enabled');

        if (updateError) {
          console.error('Admin-ops: toggle site failed');
          return new Response(
            JSON.stringify({ error: 'Failed to toggle site status' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Admin-ops: site ${enabled ? 'enabled' : 'disabled'} successfully`);
        return new Response(
          JSON.stringify({ success: true, message: `Site ${enabled ? 'enabled' : 'disabled'}`, enabled }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'change_role': {
        // Only owners can change roles
        if (!isOwner) {
          return new Response(
            JSON.stringify({ error: 'Only owners can change user roles' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!target_device_id || !new_role) {
          return new Response(
            JSON.stringify({ error: 'target_device_id and new_role required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cannot change own role
        if (target_device_id === device_id) {
          return new Response(
            JSON.stringify({ error: 'Cannot change your own role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate role value
        const validRoles = ['user', 'admin'];
        if (!validRoles.includes(new_role)) {
          return new Response(
            JSON.stringify({ error: 'Invalid role. Must be "user" or "admin"' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get target session to ensure they exist and aren't an owner
        const { data: targetSessionData } = await supabase
          .from('sessions')
          .select('role')
          .eq('device_id', target_device_id)
          .single();

        if (!targetSessionData) {
          return new Response(
            JSON.stringify({ error: 'Target session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cannot change owner roles
        if (targetSessionData.role === 'owner') {
          return new Response(
            JSON.stringify({ error: 'Cannot change owner role' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: roleError } = await supabase
          .from('sessions')
          .update({ role: new_role })
          .eq('device_id', target_device_id);

        if (roleError) {
          console.error('Admin-ops: change role failed');
          return new Response(
            JSON.stringify({ error: 'Failed to change role' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Admin-ops: role changed to ${new_role} successfully`);
        return new Response(
          JSON.stringify({ success: true, message: `Role changed to ${new_role}` }),
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
    console.error('Admin-ops function error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
