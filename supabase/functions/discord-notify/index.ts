import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
};

type NotifyPayload = {
  channel_id: string;
  content?: string;
  embed?: DiscordEmbed;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";

const postDiscordMessage = async (
  channelId: string,
  body: { content?: string; embeds?: DiscordEmbed[] },
  botToken: string,
) => {
  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorBody: responseText,
    };
  }

  return {
    ok: true,
    status: response.status,
    responseBody: responseText,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !botToken) {
    return new Response(
      JSON.stringify({ error: "Missing server configuration." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!payload?.channel_id) {
    return new Response(JSON.stringify({ error: "Missing channel_id." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const content = payload.content?.trim();
  const embed = payload.embed;

  if (!content && !embed) {
    return new Response(
      JSON.stringify({ error: "Missing content or embed." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const discordBody: { content?: string; embeds?: DiscordEmbed[] } = {};
  if (content) {
    discordBody.content = content;
  }
  if (embed) {
    discordBody.embeds = [embed];
  }

  const result = await postDiscordMessage(
    payload.channel_id,
    discordBody,
    botToken,
  );

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: "Discord notification failed.",
        status: result.status,
        details: result.errorBody,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  return new Response(
    JSON.stringify({ success: true, discord: result.responseBody }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
