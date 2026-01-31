import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const getFileExtension = (url: string, contentType?: string | null) => {
  const urlExt = url.split("?")[0].split(".").pop();
  if (urlExt && urlExt.length <= 5) {
    return urlExt;
  }
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg")) return "jpg";
  if (contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  return "png";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respondJson(405, { error: "Method Not Allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ingestSecret = Deno.env.get("DISCORD_INGEST_SECRET") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return respondJson(500, { error: "Missing server configuration." });
    }

    if (ingestSecret) {
      const providedSecret = req.headers.get("x-ingest-secret") ?? "";
      if (providedSecret !== ingestSecret) {
        return respondJson(401, { error: "Unauthorized." });
      }
    }

    const body = (await req.json().catch(() => ({}))) as {
      discord_user_id?: string;
      attachment_url?: string;
      message_id?: string;
      channel_id?: string;
    };

    if (!body.discord_user_id || !body.attachment_url) {
      return respondJson(400, { error: "Missing discord_user_id or attachment_url." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id,guild_id")
      .eq("discord_user_id", body.discord_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("discord-ingest: profile error", profileError);
      return respondJson(500, { error: "Unable to load profile." });
    }

    if (!profile?.user_id) {
      return respondJson(404, { error: "Profile not linked to Discord." });
    }

    const imageResponse = await fetch(body.attachment_url);
    if (!imageResponse.ok) {
      return respondJson(400, { error: "Unable to download attachment." });
    }

    const contentType = imageResponse.headers.get("content-type");
    const ext = getFileExtension(body.attachment_url, contentType);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    const imageBase64 = base64Encode(bytes);
    const timestamp = Date.now();
    const path = `discord/${profile.user_id}/${timestamp}-${body.message_id ?? "upload"}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("activity-screenshots")
      .upload(path, bytes, {
        contentType: contentType ?? "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("discord-ingest: upload error", uploadError);
      return respondJson(500, { error: "Unable to store image." });
    }

    const { data: publicData } = supabase.storage
      .from("activity-screenshots")
      .getPublicUrl(path);
    const imageUrl = publicData?.publicUrl ?? null;

    const ocrResponse = await fetch(`${supabaseUrl}/functions/v1/activity-ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: imageBase64,
        user_id: profile.user_id,
        guild_id: profile.guild_id,
        source: "discord",
        image_url: imageUrl,
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text().catch(() => "");
      console.error("discord-ingest: ocr error", errorText);
      return respondJson(502, { error: "OCR failed." });
    }

    const ocrData = (await ocrResponse.json().catch(() => ({}))) as {
      points?: number;
    };

    return respondJson(200, { points: ocrData.points ?? null, image_url: imageUrl });
  } catch (error) {
    console.error("discord-ingest: unexpected error", error);
    return respondJson(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
