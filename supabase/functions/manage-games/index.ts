import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://egjyojbtzxurjpptgruu.supabase.co',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://lovable.dev',
  'https://gptengineer.app',
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin =
    origin &&
    allowedOrigins.some(
      (allowed) =>
        origin === allowed ||
        origin.endsWith('.lovable.dev') ||
        origin.endsWith('.gptengineer.app') ||
        origin.endsWith('.lovableproject.com') ||
        origin.endsWith('.lovable.app')
    )
      ? origin
      : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};

function extractBase64(dataUrlOrBase64: string) {
  const idx = dataUrlOrBase64.indexOf(',');
  return idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function getExt(filename: string) {
  return (filename.split('.').pop() || '').toLowerCase();
}

function getFileNameFromPublicUrl(publicUrl: string) {
  try {
    const u = new URL(publicUrl);
    const last = u.pathname.split('/').pop();
    return last || null;
  } catch {
    const last = publicUrl.split('/').pop();
    return last ? last.split('?')[0] : null;
  }
}

function buildIframeEmbed(src: string) {
  // Keeps games isolated; works for hosted HTML files too.
  return `<iframe src="${src}" width="100%" height="600" style="border:none;" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" title="Game"></iframe>`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      device_id,
      game_id,
      title,
      source_code,
      image_base64,
      image_filename,
      html_base64,
      html_filename,
    } = await req.json();

    if (!action || !device_id) {
      return new Response(JSON.stringify({ error: 'action and device_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is an owner
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, role, is_banned')
      .eq('device_id', device_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found. Please log in again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.is_banned) {
      return new Response(JSON.stringify({ error: 'Your account has been banned' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can manage games' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadImageIfProvided = async (): Promise<string | null> => {
      if (!image_base64 || !image_filename) return null;

      const b64 = extractBase64(String(image_base64));
      const bytes = base64ToBytes(b64);

      const ext = getExt(String(image_filename)) || 'png';
      const safeExt = ext === 'jpg' ? 'jpeg' : ext;
      const fileName = `images/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('game-images').upload(fileName, bytes, {
        contentType: `image/${safeExt}`,
        upsert: false,
      });

      if (uploadError) {
        console.error('Image upload failed:', uploadError);
        throw new Error('Failed to upload image');
      }

      const { data: publicUrl } = supabase.storage.from('game-images').getPublicUrl(fileName);
      return publicUrl.publicUrl;
    };

    const uploadHtmlIfProvided = async (): Promise<string | null> => {
      if (!html_base64 || !html_filename) return null;

      const b64 = extractBase64(String(html_base64));
      const bytes = base64ToBytes(b64);

      const ext = getExt(String(html_filename));
      if (ext !== 'html' && ext !== 'htm') {
        throw new Error('Only .html files are supported');
      }

      const fileName = `html/${crypto.randomUUID()}.html`;
      const { error: uploadError } = await supabase.storage.from('game-images').upload(fileName, bytes, {
        contentType: 'text/html',
        upsert: false,
      });

      if (uploadError) {
        console.error('HTML upload failed:', uploadError);
        throw new Error('Failed to upload HTML file');
      }

      const { data: publicUrl } = supabase.storage.from('game-images').getPublicUrl(fileName);
      return publicUrl.publicUrl;
    };

    switch (action) {
      case 'add': {
        if (!title) {
          return new Response(JSON.stringify({ error: 'title required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const trimmedTitle = String(title).trim();
        if (!trimmedTitle) {
          return new Response(JSON.stringify({ error: 'title cannot be empty' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Either paste code OR upload an html file.
        const htmlUrl = await uploadHtmlIfProvided();
        const finalSourceCode = htmlUrl
          ? buildIframeEmbed(htmlUrl)
          : String(source_code || '').trim();

        if (!finalSourceCode) {
          return new Response(JSON.stringify({ error: 'source_code or html file required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const imageUrl = await uploadImageIfProvided();

        const { data: game, error: insertError } = await supabase
          .from('games')
          .insert({
            title: trimmedTitle,
            source_code: finalSourceCode,
            image_url: imageUrl,
            created_by: session.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Game insert failed:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to add game' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Game added successfully:', game.id);
        return new Response(JSON.stringify({ success: true, game }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        if (!game_id) {
          return new Response(JSON.stringify({ error: 'game_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: existingGame, error: existingError } = await supabase
          .from('games')
          .select('id, image_url')
          .eq('id', game_id)
          .single();

        if (existingError || !existingGame) {
          return new Response(JSON.stringify({ error: 'Game not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData: Record<string, unknown> = {};

        if (typeof title === 'string') {
          const t = title.trim();
          if (!t) {
            return new Response(JSON.stringify({ error: 'title cannot be empty' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          updateData.title = t;
        }

        // If HTML provided, host it and replace embed.
        const htmlUrl = await uploadHtmlIfProvided();
        if (htmlUrl) {
          updateData.source_code = buildIframeEmbed(htmlUrl);
        } else if (typeof source_code === 'string' && source_code.trim()) {
          updateData.source_code = source_code.trim();
        }

        // If image provided, upload new and remove old.
        const newImageUrl = await uploadImageIfProvided();
        if (newImageUrl) {
          updateData.image_url = newImageUrl;

          if (existingGame.image_url) {
            const oldFileName = getFileNameFromPublicUrl(existingGame.image_url);
            if (oldFileName) {
              await supabase.storage.from('game-images').remove([oldFileName]);
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return new Response(JSON.stringify({ error: 'No changes provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: updated, error: updateError } = await supabase
          .from('games')
          .update(updateData)
          .eq('id', game_id)
          .select()
          .single();

        if (updateError) {
          console.error('Game update failed:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update game' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, game: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        if (!game_id) {
          return new Response(JSON.stringify({ error: 'game_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: existingGame } = await supabase
          .from('games')
          .select('image_url')
          .eq('id', game_id)
          .single();

        if (existingGame?.image_url) {
          const fileName = getFileNameFromPublicUrl(existingGame.image_url);
          if (fileName) {
            await supabase.storage.from('game-images').remove([fileName]);
          }
        }

        const { error: deleteError } = await supabase.from('games').delete().eq('id', game_id);

        if (deleteError) {
          console.error('Game delete failed:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to delete game' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Manage-games function error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
