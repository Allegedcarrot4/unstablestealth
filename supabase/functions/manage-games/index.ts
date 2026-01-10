/* redeploy-bust: 2026-01-10T19:20:00Z */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://egjyojbtzxurjpptgruu.supabase.co",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://lovable.dev",
  "https://gptengineer.app",
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin =
    origin &&
    allowedOrigins.some(
      (allowed) =>
        origin === allowed ||
        origin.endsWith(".lovable.dev") ||
        origin.endsWith(".gptengineer.app") ||
        origin.endsWith(".lovableproject.com") ||
        origin.endsWith(".lovable.app"),
    )
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

function extractBase64(dataUrlOrBase64: string) {
  const idx = dataUrlOrBase64.indexOf(",");
  return idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function getExt(filename: string) {
  return (filename.split(".").pop() || "").toLowerCase();
}

function getFileNameFromPublicUrl(publicUrl: string) {
  try {
    const u = new URL(publicUrl);
    const last = u.pathname.split("/").pop();
    return last || null;
  } catch {
    const last = publicUrl.split("/").pop();
    return last ? last.split("?")[0] : null;
  }
}

function buildIframeEmbed(src: string) {
  // Keeps games isolated; works for hosted HTML files too.
  return `<iframe src="${src}" width="100%" height="600" style="border:none;" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" title="Game"></iframe>`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const log = (level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) => {
    // Structured logs for easier diagnosis in backend logs
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        event,
        requestId,
        ...data,
      }),
    );
  };

  const respond = (status: number, body: Record<string, unknown>) => {
    const duration_ms = Date.now() - startedAt;
    log(status >= 500 ? "error" : status >= 400 ? "warn" : "info", "response", {
      status,
      duration_ms,
    });

    return new Response(JSON.stringify({ ...body, requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  // Always answer preflight with CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch (e) {
      log("warn", "invalid_json", { error: String(e) });
      return respond(400, { error: "Invalid JSON body" });
    }

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
    } = payload ?? {};

    log("info", "request_received", {
      method: req.method,
      action: typeof action === "string" ? action : null,
      has_device_id: typeof device_id === "string" && device_id.length > 0,
      has_game_id: typeof game_id === "string" && game_id.length > 0,
      has_title: typeof title === "string" && title.trim().length > 0,
      has_source_code: typeof source_code === "string" && source_code.trim().length > 0,
      has_image: !!image_base64,
      has_html: !!html_base64,
      origin,
    });

    if (!action || !device_id) {
      return respond(400, { error: "action and device_id required" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Defensive env validation: if these are missing, we want an explicit error + log.
    if (!supabaseUrl || !supabaseServiceKey) {
      log("error", "missing_env", {
        has_SUPABASE_URL: !!supabaseUrl,
        has_SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
      });
      return respond(500, { error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is an owner
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, role, is_banned")
      .eq("device_id", device_id)
      .single();

    if (sessionError || !session) {
      log("warn", "session_lookup_failed", {
        error: sessionError?.message ?? "no_session",
      });
      return respond(401, { error: "Session not found. Please log in again." });
    }

    if (session.is_banned) {
      return respond(403, { error: "Your account has been banned" });
    }

    if (session.role !== "owner") {
      return respond(403, { error: "Only owners can manage games" });
    }

    const uploadImageIfProvided = async (): Promise<string | null> => {
      if (!image_base64 || !image_filename) return null;

      const b64 = extractBase64(String(image_base64));
      const bytes = base64ToBytes(b64);

      const ext = getExt(String(image_filename)) || "png";
      const safeExt = ext === "jpg" ? "jpeg" : ext;
      const fileName = `images/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("game-images").upload(fileName, bytes, {
        contentType: `image/${safeExt}`,
        upsert: false,
      });

      if (uploadError) {
        log("error", "image_upload_failed", { message: uploadError.message });
        throw new Error("Failed to upload image");
      }

      const { data: publicUrl } = supabase.storage.from("game-images").getPublicUrl(fileName);
      return publicUrl.publicUrl;
    };

    const uploadHtmlIfProvided = async (): Promise<string | null> => {
      if (!html_base64 || !html_filename) return null;

      const b64 = extractBase64(String(html_base64));
      const bytes = base64ToBytes(b64);

      const ext = getExt(String(html_filename));
      if (ext !== "html" && ext !== "htm") {
        throw new Error("Only .html files are supported");
      }

      const fileName = `html/${crypto.randomUUID()}.html`;
      const { error: uploadError } = await supabase.storage.from("game-images").upload(fileName, bytes, {
        contentType: "text/html",
        upsert: false,
      });

      if (uploadError) {
        log("error", "html_upload_failed", { message: uploadError.message });
        throw new Error("Failed to upload HTML file");
      }

      const { data: publicUrl } = supabase.storage.from("game-images").getPublicUrl(fileName);
      return publicUrl.publicUrl;
    };

    switch (action) {
      case "add": {
        if (!title) return respond(400, { error: "title required" });

        const trimmedTitle = String(title).trim();
        if (!trimmedTitle) return respond(400, { error: "title cannot be empty" });

        // Either paste code OR upload an html file.
        const htmlUrl = await uploadHtmlIfProvided();
        const finalSourceCode = htmlUrl ? buildIframeEmbed(htmlUrl) : String(source_code || "").trim();

        if (!finalSourceCode) {
          return respond(400, { error: "source_code or html file required" });
        }

        const imageUrl = await uploadImageIfProvided();

        const { data: game, error: insertError } = await supabase
          .from("games")
          .insert({
            title: trimmedTitle,
            source_code: finalSourceCode,
            image_url: imageUrl,
            created_by: session.id,
          })
          .select()
          .single();

        if (insertError) {
          log("error", "game_insert_failed", { message: insertError.message });
          return respond(500, { error: "Failed to add game" });
        }

        log("info", "game_added", { game_id: game.id });
        return respond(200, { success: true, game });
      }

      case "update": {
        if (!game_id) return respond(400, { error: "game_id required" });

        const { data: existingGame, error: existingError } = await supabase
          .from("games")
          .select("id, image_url")
          .eq("id", game_id)
          .single();

        if (existingError || !existingGame) {
          return respond(404, { error: "Game not found" });
        }

        const updateData: Record<string, unknown> = {};

        if (typeof title === "string") {
          const t = title.trim();
          if (!t) return respond(400, { error: "title cannot be empty" });
          updateData.title = t;
        }

        // If HTML provided, host it and replace embed.
        const htmlUrl = await uploadHtmlIfProvided();
        if (htmlUrl) {
          updateData.source_code = buildIframeEmbed(htmlUrl);
        } else if (typeof source_code === "string" && source_code.trim()) {
          updateData.source_code = source_code.trim();
        }

        // If image provided, upload new and remove old.
        const newImageUrl = await uploadImageIfProvided();
        if (newImageUrl) {
          updateData.image_url = newImageUrl;

          if (existingGame.image_url) {
            const oldFileName = getFileNameFromPublicUrl(existingGame.image_url);
            if (oldFileName) {
              await supabase.storage.from("game-images").remove([oldFileName]);
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return respond(400, { error: "No changes provided" });
        }

        const { data: updated, error: updateError } = await supabase
          .from("games")
          .update(updateData)
          .eq("id", game_id)
          .select()
          .single();

        if (updateError) {
          log("error", "game_update_failed", { message: updateError.message, game_id });
          return respond(500, { error: "Failed to update game" });
        }

        return respond(200, { success: true, game: updated });
      }

      case "delete": {
        if (!game_id) return respond(400, { error: "game_id required" });

        const { data: existingGame } = await supabase
          .from("games")
          .select("image_url")
          .eq("id", game_id)
          .single();

        if (existingGame?.image_url) {
          const fileName = getFileNameFromPublicUrl(existingGame.image_url);
          if (fileName) {
            await supabase.storage.from("game-images").remove([fileName]);
          }
        }

        const { error: deleteError } = await supabase.from("games").delete().eq("id", game_id);

        if (deleteError) {
          log("error", "game_delete_failed", { message: deleteError.message, game_id });
          return respond(500, { error: "Failed to delete game" });
        }

        return respond(200, { success: true });
      }

      default:
        return respond(400, { error: "Unknown action" });
    }
  } catch (error) {
    const err = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };

    log("error", "unhandled_exception", err);

    // Keep response generic; requestId ties it back to logs.
    return respond(500, { error: "Internal server error" });
  }
});

