import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, device_id, model } = await req.json();

    if (!messages || !device_id) {
      console.error('Missing required fields: messages or device_id');
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
      console.error('Session not found for device');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - session not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_banned) {
      console.log('Banned user attempted AI request');
      return new Response(
        JSON.stringify({ error: 'Your account has been banned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdminOrOwner = session.role === 'admin' || session.role === 'owner';
    
    // Determine which model to use
    let modelToUse = DEFAULT_MODEL;
    
    if (model && ALLOWED_MODELS.includes(model)) {
      // Only admins can use non-default models
      if (model !== DEFAULT_MODEL && !isAdminOrOwner) {
        console.log('Non-admin attempted to use premium model');
        modelToUse = DEFAULT_MODEL;
      } else {
        modelToUse = model;
      }
    }

    console.log(`Using model: ${modelToUse} for ${isAdminOrOwner ? 'premium user' : 'user'}`);

    // Get Lovable API key from environment (auto-provisioned)
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
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
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
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
    console.log('AI request successful');

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
    console.error('AI chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
