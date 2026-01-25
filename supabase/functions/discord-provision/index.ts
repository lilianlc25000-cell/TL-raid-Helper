import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DiscordChannel = {
  id: string;
  name: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";

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

  const { data: guildConfig, error: configError } = await supabase
    .from("guild_configs")
    .select("discord_guild_id")
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (configError || !guildConfig?.discord_guild_id) {
    return new Response(
      JSON.stringify({ error: "Aucune configuration Discord." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const guildId = guildConfig.discord_guild_id;

  const existingChannelsResponse = await fetch(
    `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );

  if (!existingChannelsResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Impossible de lire les salons." }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const existingChannels =
    (await existingChannelsResponse.json()) as DiscordChannel[];

  const ensureChannel = async (name: string) => {
    const found = existingChannels.find((channel) => channel.name === name);
    if (found) {
      return found;
    }

    const createResponse = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, type: 0 }),
      },
    );

    if (!createResponse.ok) {
      const errorBody = await createResponse.text().catch(() => "");
      throw new Error(
        `Discord channel creation failed: ${createResponse.status} ${errorBody}`,
      );
    }

    return (await createResponse.json()) as DiscordChannel;
  };

  try {
    const planningChannel = await ensureChannel("📅-tl-planning");
    const lootsChannel = await ensureChannel("🎁-tl-loots");

    const { error: updateError } = await supabase
      .from("guild_configs")
      .update({ raid_channel_id: planningChannel.id })
      .eq("owner_id", authData.user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Impossible de sauvegarder la config." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        channels: [planningChannel, lootsChannel],
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : error }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
