import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, device_id, action } = await req.json();
    // action: 'undo' (delete for everyone, own message only, last 3), 
    //         'hide' (hide for self only), 
    //         'delete' (admin only, delete for everyone)

    if (!message_id || !device_id || !action) {
      return new Response(
        JSON.stringify({ error: 'message_id, device_id, and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the session for this device
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
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

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', message_id)
      .maybeSingle();

    if (msgError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = session.role === 'admin';
    const isOwner = message.session_id === session.id;

    if (action === 'undo') {
      // User can undo their own messages (last 3 only)
      if (!isOwner) {
        return new Response(
          JSON.stringify({ error: 'You can only undo your own messages' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this is within the last 3 messages of this user
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', session.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(3);

      const recentIds = recentMessages?.map(m => m.id) || [];
      if (!recentIds.includes(message_id)) {
        return new Response(
          JSON.stringify({ error: 'You can only undo your last 3 messages' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Soft delete for everyone
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: session.id
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('Failed to undo message:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to undo message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'undo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'hide') {
      // Hide message for self only (any user can do this for any message)
      const currentHidden = message.hidden_for_session_ids || [];
      if (currentHidden.includes(session.id)) {
        return new Response(
          JSON.stringify({ success: true, action: 'already_hidden' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ 
          hidden_for_session_ids: [...currentHidden, session.id]
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('Failed to hide message:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to hide message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'hide' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      // Admin-only: delete for everyone
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can delete messages for everyone' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: session.id
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('Failed to delete message:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'delete' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-message function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
