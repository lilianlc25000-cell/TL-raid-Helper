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

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const fetchDiscord = async <T>(
  url: string,
  options: RequestInit,
): Promise<{ ok: true; data: T | null } | { ok: false; status: number; body: string }> => {
  const response = await fetch(url, options);
  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    return { ok: false, status: response.status, body: responseText };
  }
  if (!responseText) {
    return { ok: true, data: null };
  }
  try {
    return { ok: true, data: JSON.parse(responseText) as T };
  } catch {
    return { ok: true, data: null };
  }
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const appUrlRaw = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "";
    const appUrl = appUrlRaw.trim().replace(/\/+$/, "");

    if (!supabaseUrl || !supabaseAnonKey || !botToken || !appUrl) {
      console.error("discord-provision: missing env", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
        hasBotToken: Boolean(botToken),
        hasAppUrl: Boolean(appUrl),
      });
      return respondJson(500, { error: "Missing server configuration." });
    }

    if (!authHeader) {
      return respondJson(401, { error: "Missing authorization." });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("discord-provision: auth error", authError);
      return respondJson(401, { error: "Unauthorized." });
    }

    const { data: guildConfig, error: configError } = await supabase
      .from("guild_configs")
      .select("discord_guild_id")
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (configError || !guildConfig?.discord_guild_id) {
      console.error("discord-provision: config error", configError);
      return respondJson(400, { error: "Aucune configuration Discord." });
    }

    const guildId = guildConfig.discord_guild_id;
    const discordHeaders = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    };

    const rolesResult = await fetchDiscord<DiscordRole[]>(
      `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!rolesResult.ok) {
      console.error("discord-provision: roles fetch failed", rolesResult);
      return respondJson(502, { error: "Impossible de lire les rôles Discord." });
    }

    let memberRole =
      rolesResult.data?.find((role) => role.name === MEMBER_ROLE_NAME) ?? null;

    if (!memberRole) {
      const createRoleResult = await fetchDiscord<DiscordRole>(
        `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({ name: MEMBER_ROLE_NAME }),
        },
      );
      if (!createRoleResult.ok || !createRoleResult.data) {
        console.error("discord-provision: role create failed", createRoleResult);
        return respondJson(502, { error: "Impossible de créer le rôle Discord." });
      }
      memberRole = createRoleResult.data;
    }

    const privateOverwrites = [
      {
        id: guildId,
        type: 0,
        deny: VIEW_CHANNEL_PERMISSION.toString(),
      },
      {
        id: memberRole.id,
        type: 0,
        allow: VIEW_CHANNEL_PERMISSION.toString(),
      },
    ];

    const channelsResult = await fetchDiscord<DiscordChannel[]>(
      `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!channelsResult.ok) {
      console.error("discord-provision: channels fetch failed", channelsResult);
      return respondJson(502, { error: "Impossible de lire les salons." });
    }

    const channelsByName = new Map(
      (channelsResult.data ?? []).map((channel) => [channel.name, channel]),
    );

    const ensureChannel = async (
      name: string,
      overwrites?: typeof privateOverwrites,
    ) => {
      const existing = channelsByName.get(name);
      if (existing) {
        if (overwrites) {
          const patchResult = await fetchDiscord(
            `${DISCORD_API_BASE}/channels/${existing.id}`,
            {
              method: "PATCH",
              headers: discordHeaders,
              body: JSON.stringify({ permission_overwrites: overwrites }),
            },
          );
          if (!patchResult.ok) {
            console.error("discord-provision: channel patch failed", patchResult);
            throw new Error("Impossible de mettre à jour les permissions.");
          }
        }
        return existing;
      }

      const createResult = await fetchDiscord<DiscordChannel>(
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

      if (!createResult.ok || !createResult.data) {
        console.error("discord-provision: channel create failed", createResult);
        throw new Error("Impossible de créer un salon Discord.");
      }

      channelsByName.set(name, createResult.data);
      return createResult.data;
    };

    const postWelcomeMessage = async (channelId: string) => {
      const messageResult = await fetchDiscord(
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
                  url: `${appUrl}/login?force=1`,
                  },
                ],
              },
            ],
          }),
        },
      );
      if (!messageResult.ok) {
        console.error("discord-provision: welcome message failed", messageResult);
      }
    };

    const inscriptionChannel = await ensureChannel("🔓-inscription");
    await postWelcomeMessage(inscriptionChannel.id);

    const planningChannel = await ensureChannel("📅-tl-planning", privateOverwrites);
    const lootsChannel = await ensureChannel("🎁-tl-loots", privateOverwrites);
    const groupsChannel = await ensureChannel("groupe", privateOverwrites);

    const { error: updateError } = await supabase
      .from("guild_configs")
      .update({
        raid_channel_id: planningChannel.id,
        group_channel_id: groupsChannel.id,
        discord_member_role_id: memberRole.id,
      })
      .eq("owner_id", authData.user.id);

    if (updateError) {
      console.error("discord-provision: db update failed", updateError);
      return respondJson(500, { error: "Impossible de sauvegarder la config." });
    }

    return respondJson(200, {
      success: true,
      role_id: memberRole.id,
      channels: [inscriptionChannel, planningChannel, lootsChannel, groupsChannel],
    });
  } catch (error) {
    console.error("discord-provision: unexpected error", error);
    return respondJson(500, {
      error: error instanceof Error ? error.message : error,
    });
  }
});
