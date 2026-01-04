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

// Available AI models for owners
const AVAILABLE_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-3-pro-preview',
  'openai/gpt-5-nano',
  'openai/gpt-5-mini',
  'openai/gpt-5',
];

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { device_id, command, model = 'google/gemini-2.5-flash' } = await req.json();

    if (!device_id || !command) {
      return new Response(
        JSON.stringify({ error: 'device_id and command required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate model
    if (!AVAILABLE_MODELS.includes(model)) {
      return new Response(
        JSON.stringify({ error: 'Invalid model selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is an owner
    const { data: callerSession, error: callerError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
      .eq('device_id', device_id)
      .single();

    if (callerError || !callerSession || callerSession.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerSession.is_banned) {
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current system state for context
    const { data: sessions } = await supabase.from('sessions').select('id, device_id, role, is_banned, last_active_at');
    const { data: profiles } = await supabase.from('profiles').select('session_id, username');
    const { data: bannedDevices } = await supabase.from('banned_devices').select('device_id, banned_at');
    const { data: siteSettings } = await supabase.from('site_settings').select('key, value').eq('key', 'site_enabled').single();

    // Build profile map
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.session_id] = p.username;
    });

    // Build user list with names
    const userList = (sessions || []).map((s: any) => ({
      username: profileMap[s.id] || 'Unknown',
      device_id: s.device_id,
      role: s.role,
      is_banned: s.is_banned,
      last_active: s.last_active_at
    }));

    const siteEnabled = siteSettings?.value?.enabled ?? true;

    // System prompt for the AI agent
    const systemPrompt = `You are an administrative AI agent for the UNSTABLE STEALTH website. You have FULL control over the site and can execute commands on behalf of the owner.

CURRENT SYSTEM STATE:
- Site Enabled: ${siteEnabled}
- Total Users: ${userList.length}
- Banned Devices: ${bannedDevices?.length || 0}

ACTIVE USERS:
${userList.map((u: any) => `- ${u.username} (${u.role}${u.is_banned ? ', BANNED' : ''}) - Device: ${u.device_id.slice(0, 8)}...`).join('\n')}

AVAILABLE COMMANDS (respond with JSON action when owner wants to execute):
1. BAN_USER - Ban a user by username or partial device ID
   Response: {"action": "ban_device", "target_device_id": "full_device_id"}

2. UNBAN_USER - Unban a user by device ID
   Response: {"action": "unban_device", "target_device_id": "full_device_id"}

3. CHANGE_ROLE - Change a user's role (user/admin)
   Response: {"action": "change_role", "target_device_id": "full_device_id", "new_role": "user|admin"}

4. TOGGLE_SITE - Enable or disable the entire site
   Response: {"action": "toggle_site", "enabled": true|false}

5. LIST_USERS - Just provide information (no action needed)

6. GET_STATUS - Provide site status information (no action needed)

RULES:
- When the owner asks to perform an action, respond with a clear confirmation message AND include the JSON action block.
- Format actions as: [ACTION_JSON]{"action": "...", ...}[/ACTION_JSON]
- If the request is ambiguous, ask for clarification.
- If a username is mentioned, find the matching user from the list above.
- You CANNOT change owner roles or ban owners.
- Be concise but helpful.
- If just asked for information, provide it without an action block.`;

    // Call AI via Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || 'No response from AI';

    // Check if AI wants to execute an action
    const actionMatch = aiMessage.match(/\[ACTION_JSON\](.*?)\[\/ACTION_JSON\]/s);
    let actionResult = null;

    if (actionMatch) {
      try {
        const actionData = JSON.parse(actionMatch[1]);
        
        // Execute the action via admin-operations
        const { data: opResult, error: opError } = await supabase.functions.invoke('admin-operations', {
          body: {
            action: actionData.action,
            device_id,
            target_device_id: actionData.target_device_id,
            new_role: actionData.new_role,
            enabled: actionData.enabled,
          }
        });

        if (opError) {
          actionResult = { success: false, error: opError.message };
        } else if (opResult?.error) {
          actionResult = { success: false, error: opResult.error };
        } else {
          actionResult = { success: true, message: opResult?.message };
        }
      } catch (parseError) {
        console.error('Failed to parse action JSON:', parseError);
        actionResult = { success: false, error: 'Failed to parse action' };
      }
    }

    // Clean the message for display (remove action JSON)
    const cleanMessage = aiMessage.replace(/\[ACTION_JSON\].*?\[\/ACTION_JSON\]/s, '').trim();

    return new Response(
      JSON.stringify({ 
        message: cleanMessage,
        action_executed: actionResult,
        model_used: model
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Owner-agent function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});