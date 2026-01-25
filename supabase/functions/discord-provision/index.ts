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

type DiscordRole = {
  id: string;
  name: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const VIEW_CHANNEL_PERMISSION = 1024;
const MEMBER_ROLE_NAME = "Joueur TL-App";

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
  const appUrlRaw = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "";
  const appUrl = appUrlRaw.trim().replace(/\/+$/, "");
  if (!appUrl) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_APP_URL manquant." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const discordHeaders = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  const fetchDiscordJson = async <T>(
    url: string,
    options: RequestInit,
  ): Promise<T> => {
    const response = await fetch(url, options);
    const responseText = await response.text().catch(() => "");
    if (!response.ok) {
      throw new Error(
        `Discord request failed: ${response.status} ${responseText}`,
      );
    }
    return (responseText ? JSON.parse(responseText) : null) as T;
  };

  const getOrCreateMemberRole = async () => {
    const roles = await fetchDiscordJson<DiscordRole[]>(
      `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    const existingRole = roles.find((role) => role.name === MEMBER_ROLE_NAME);
    if (existingRole) {
      return existingRole;
    }
    return await fetchDiscordJson<DiscordRole>(
      `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
      {
        method: "POST",
        headers: discordHeaders,
        body: JSON.stringify({ name: MEMBER_ROLE_NAME }),
      },
    );
  };

  const privateOverwrites = (memberRoleId: string) => [
    {
      id: guildId,
      type: 0,
      deny: VIEW_CHANNEL_PERMISSION.toString(),
    },
    {
      id: memberRoleId,
      type: 0,
      allow: VIEW_CHANNEL_PERMISSION.toString(),
    },
  ];

  const ensureChannel = async (
    name: string,
    overwrites?: ReturnType<typeof privateOverwrites>,
  ) => {
    const existingChannels = await fetchDiscordJson<DiscordChannel[]>(
      `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    const found = existingChannels.find((channel) => channel.name === name);
    if (found) {
      if (overwrites) {
        await fetchDiscordJson(
          `${DISCORD_API_BASE}/channels/${found.id}`,
          {
            method: "PATCH",
            headers: discordHeaders,
            body: JSON.stringify({ permission_overwrites: overwrites }),
          },
        );
      }
      return found;
    }

    return await fetchDiscordJson<DiscordChannel>(
      `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
      {
        method: "POST",
        headers: discordHeaders,
        body: JSON.stringify({
          name,
          type: 0,
          permission_overwrites: overwrites,
        }),
      },
    );
  };

  const postWelcomeMessage = async (channelId: string) => {
    await fetchDiscordJson(
      `${DISCORD_API_BASE}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: discordHeaders,
        body: JSON.stringify({
          embeds: [
            {
              title: "Bienvenue ! Connectez-vous pour accéder aux raids",
              description:
                "Pour voir le planning et les loots, vous devez lier votre compte Discord à l'application.",
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: "Se Connecter / S'inscrire",
                  url: `${appUrl}/login`,
                },
              ],
            },
          ],
        }),
      },
    );
  };

  try {
    const memberRole = await getOrCreateMemberRole();
    const overwrites = privateOverwrites(memberRole.id);

    const inscriptionChannel = await ensureChannel("🔓-inscription");
    await postWelcomeMessage(inscriptionChannel.id);

    const planningChannel = await ensureChannel("📅-tl-planning", overwrites);
    const lootsChannel = await ensureChannel("🎁-tl-loots", overwrites);

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

    const { error: roleUpdateError } = await supabase
      .from("guild_configs")
      .update({ discord_member_role_id: memberRole.id })
      .eq("owner_id", authData.user.id);

    if (roleUpdateError) {
      return new Response(
        JSON.stringify({ error: "Impossible de sauvegarder le rôle Discord." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        role_id: memberRole.id,
        channels: [inscriptionChannel, planningChannel, lootsChannel],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : error }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
