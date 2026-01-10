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

// Cheapest model for regular users
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

// All allowed models (admins can use any)
const ALLOWED_MODELS = [
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

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, device_id, model } = await req.json();

    if (!messages || !device_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session exists and is not banned
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, is_banned, role')
      .eq('device_id', device_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - session not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_banned) {
      console.log('AI-chat: banned user attempt');
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdminOrOwner = session.role === 'admin' || session.role === 'owner';
    const isOwner = session.role === 'owner';
    
    // Weekly limits: owners unlimited, admins 10, users 5
    const weeklyLimit = isOwner ? Infinity : isAdminOrOwner ? 10 : 5;
    
    // SERVER-SIDE USAGE LIMIT ENFORCEMENT
    if (!isOwner) {
      // Calculate week start (Sunday)
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const diff = now.getUTCDate() - dayOfWeek;
      const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      // Get or create usage record
      let { data: usageData } = await supabase
        .from('ai_usage')
        .select('request_count')
        .eq('session_id', session.id)
        .eq('week_start', weekStartStr)
        .maybeSingle();
      
      if (!usageData) {
        // Create new usage record for this week
        const { data: newUsage, error: insertError } = await supabase
          .from('ai_usage')
          .insert({ session_id: session.id, week_start: weekStartStr, request_count: 0 })
          .select('request_count')
          .single();
        
        if (insertError) {
          console.error('AI-chat: failed to create usage record', { error: insertError.message });
          return new Response(
            JSON.stringify({ error: 'Failed to track usage' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        usageData = newUsage;
      }
      
      // Check if limit exceeded
      if (usageData.request_count >= weeklyLimit) {
        console.log('AI-chat: weekly limit exceeded', { session_id: session.id, count: usageData.request_count, limit: weeklyLimit });
        return new Response(
          JSON.stringify({ 
            error: `Weekly limit of ${weeklyLimit} questions reached. Resets Sunday.`,
            limit_reached: true
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Increment usage BEFORE API call (prevents race conditions)
      const { error: updateError } = await supabase
        .from('ai_usage')
        .update({ 
          request_count: usageData.request_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', session.id)
        .eq('week_start', weekStartStr);
      
      if (updateError) {
        console.error('AI-chat: failed to update usage', { error: updateError.message });
      }
    }
    
    // Determine which model to use
    let modelToUse = DEFAULT_MODEL;
    
    if (model && ALLOWED_MODELS.includes(model)) {
      // Only admins can use non-default models
      if (model !== DEFAULT_MODEL && !isAdminOrOwner) {
        modelToUse = DEFAULT_MODEL;
      } else {
        modelToUse = model;
      }
    }

    console.log('AI-chat: processing request', { role: session.role, model: modelToUse });

    // Get Lovable API key from environment (auto-provisioned)
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('AI-chat: API key not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert messages to OpenAI format for Lovable AI gateway
    const formattedMessages = messages.map((msg: { role: string; parts: { text: string }[] }) => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.parts.map((p: { text: string }) => p.text).join('')
    }));

    // Call Lovable AI Gateway
    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant. Keep answers clear and concise.' },
            ...formattedMessages
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI-chat: gateway error', { status: response.status });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI-chat: request successful');

    // Convert response back to Gemini format for frontend compatibility
    const geminiResponse = {
      candidates: [{
        content: {
          parts: [{ text: data.choices?.[0]?.message?.content || '' }],
          role: 'model'
        }
      }]
    };

    return new Response(
      JSON.stringify(geminiResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI-chat function error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
