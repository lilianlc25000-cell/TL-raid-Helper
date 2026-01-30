import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const parsePoints = (value: string) => {
  const match = value.match(/\\d{1,6}/);
  return match ? Number(match[0]) : null;
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
    const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !openAiKey) {
      return respondJson(500, { error: "Missing server configuration." });
    }

    const body = (await req.json().catch(() => ({}))) as {
      image_base64?: string;
      user_id?: string;
      guild_id?: string;
      source?: string;
    };

    if (!body.image_base64) {
      return respondJson(400, { error: "Missing image_base64." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Lis le nombre de points d'activité sur l'image. Réponds uniquement par un nombre.",
              },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${body.image_base64}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("activity-ocr: openai error", errorText);
      return respondJson(502, { error: "OpenAI OCR failed." });
    }

    const result = await response.json();
    const outputText =
      result?.output?.[0]?.content?.[0]?.text ??
      result?.output_text ??
      "";
    const points = parsePoints(String(outputText));
    if (points === null) {
      return respondJson(422, { error: "No points detected." });
    }

    let resolvedUserId = body.user_id ?? null;
    let resolvedGuildId = body.guild_id ?? null;

    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData.user?.id ?? resolvedUserId;
      if (!resolvedGuildId && resolvedUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("guild_id")
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        resolvedGuildId = profile?.guild_id ?? null;
      }
    }

    if (!resolvedUserId) {
      return respondJson(401, { error: "Missing user_id." });
    }

    const supabaseWriteKey = serviceRoleKey || supabaseAnonKey;
    const supabaseWrite = createClient(supabaseUrl, supabaseWriteKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { error: updateError } = await supabaseWrite
      .from("profiles")
      .update({
        activity_points: points,
        activity_points_updated_at: new Date().toISOString(),
      })
      .eq("user_id", resolvedUserId);
    if (updateError) {
      console.error("activity-ocr: update error", updateError);
      return respondJson(500, { error: "Unable to update profile." });
    }

    if (resolvedGuildId) {
      await supabaseWrite.from("activity_points_history").insert({
        guild_id: resolvedGuildId,
        user_id: resolvedUserId,
        points,
        source: body.source ?? "app",
      });
    }

    return respondJson(200, { points });
  } catch (error) {
    console.error("activity-ocr: unexpected error", error);
    return respondJson(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
