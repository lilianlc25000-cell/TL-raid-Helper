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
  type?: number;
  parent_id?: string | null;
};

type DiscordRole = {
  id: string;
  name: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const VIEW_CHANNEL_PERMISSION = 1024;
const MEMBER_ROLE_NAME = "Joueur TL-App";
const CATEGORY_TYPE = 4;
const TEXT_CHANNEL_TYPE = 0;
const ROOT_CATEGORY_NAME = "🛡️-TL-Raid-Manager";
const LOOT_CATEGORY_NAME = "🎁-Loot";
const MISC_CATEGORY_NAME = "🧰-Divers";
const INSCRIPTION_CHANNEL = "🔓-inscription";
const EVENT_INSCRIPTION_CHANNEL = "📝-inscription-event";
const EVENT_GROUP_CHANNEL = "👥-groupe";
const POLL_CHANNEL = "📊-sondage";
const WISHLIST_CHANNEL = "📜-wish-list";
const LOOT_CHANNEL = "🎁-coffre-de-guilde";
const DPS_CHANNEL = "📈-dps-meter";
const ACTIVITY_CHANNEL = "⭐-points-activite";
const EVENT_DAYS = [
  { key: "lundi", label: "📆-Lundi" },
  { key: "mardi", label: "📆-Mardi" },
  { key: "mercredi", label: "📆-Mercredi" },
  { key: "jeudi", label: "📆-Jeudi" },
  { key: "vendredi", label: "📆-Vendredi" },
  { key: "samedi", label: "📆-Samedi" },
  { key: "dimanche", label: "📆-Dimanche" },
];

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

    const body = (await req.json().catch(() => ({}))) as {
      guild_id?: string;
      channel_config?: Record<string, boolean>;
      mode?: "reset" | "custom";
    };

    const { data: guildConfig, error: configError } = await supabase
      .from("guild_configs")
      .select("discord_guild_id,discord_channel_config")
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (configError || !guildConfig?.discord_guild_id) {
      console.error("discord-provision: config error", configError);
      return respondJson(400, { error: "Aucune configuration Discord." });
    }

    const guildId = guildConfig.discord_guild_id;
    const baseConfig = {
      event: false,
      group: false,
      loot: false,
      wishlist: false,
      dps_meter: false,
      polls: false,
      activity_points: false,
    };
    const hasBodyConfig =
      body.channel_config && Object.keys(body.channel_config).length > 0;
    const channelConfig =
      body.mode === "reset"
        ? {
            ...baseConfig,
            event: true,
            group: true,
            loot: true,
          }
        : {
            ...baseConfig,
            ...(hasBodyConfig
              ? body.channel_config
              : (guildConfig.discord_channel_config ?? {})),
          };

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

    const channels = channelsResult.data ?? [];
    const channelsByName = new Map(
      channels.map((channel) => [channel.name, channel]),
    );
    const findChannel = (name: string, type?: number) =>
      channels.find(
        (channel) =>
          channel.name === name && (type === undefined || channel.type === type),
      );

    const ensureChannel = async (
      name: string,
      overwrites?: typeof privateOverwrites,
      options?: { type?: number; parentId?: string | null; position?: number },
    ): Promise<{ channel: DiscordChannel; created: boolean }> => {
      const existing = findChannel(name, options?.type);
      if (existing) {
        if (overwrites || options?.parentId !== undefined || options?.position !== undefined) {
          const patchResult = await fetchDiscord(
            `${DISCORD_API_BASE}/channels/${existing.id}`,
            {
              method: "PATCH",
              headers: discordHeaders,
              body: JSON.stringify({
                permission_overwrites: overwrites,
                parent_id: options?.parentId ?? null,
                position: options?.position,
              }),
            },
          );
          if (!patchResult.ok) {
            console.error("discord-provision: channel patch failed", patchResult);
            throw new Error(`Impossible de mettre à jour le salon ${name}.`);
          }
        }
        return { channel: existing, created: false };
      }

      const createResult = await fetchDiscord<DiscordChannel>(
        `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({
            name,
            type: options?.type ?? TEXT_CHANNEL_TYPE,
            parent_id: options?.parentId ?? null,
            position: options?.position,
            permission_overwrites: overwrites,
          }),
        },
      );

      if (!createResult.ok || !createResult.data) {
        console.error("discord-provision: channel create failed", createResult);
        throw new Error(`Impossible de créer le salon ${name}.`);
      }

      channelsByName.set(name, createResult.data);
      return { channel: createResult.data, created: true };
    };

    const deleteChannel = async (name: string, type?: number) => {
      const existing = findChannel(name, type);
      if (!existing) {
        return;
      }
      const deleteResult = await fetchDiscord(
        `${DISCORD_API_BASE}/channels/${existing.id}`,
        {
          method: "DELETE",
          headers: discordHeaders,
        },
      );
      if (!deleteResult.ok) {
        console.error("discord-provision: delete failed", deleteResult);
      }
    };

    const deleteChannelsByName = async (name: string, type?: number) => {
      const matches = channels.filter(
        (channel) =>
          channel.name === name && (type === undefined || channel.type === type),
      );
      for (const channel of matches) {
        const deleteResult = await fetchDiscord(
          `${DISCORD_API_BASE}/channels/${channel.id}`,
          {
            method: "DELETE",
            headers: discordHeaders,
          },
        );
        if (!deleteResult.ok) {
          console.error("discord-provision: delete failed", deleteResult);
        }
      }
    };

    const deleteCategoryAndChildren = async (name: string) => {
      const categories = channels.filter(
        (channel) => channel.name === name && channel.type === CATEGORY_TYPE,
      );
      if (categories.length === 0) {
        return;
      }
      const categoryIds = new Set(categories.map((category) => category.id));
      const children = channels.filter(
        (channel) => channel.parent_id && categoryIds.has(channel.parent_id),
      );
      for (const child of children) {
        const deleteResult = await fetchDiscord(
          `${DISCORD_API_BASE}/channels/${child.id}`,
          {
            method: "DELETE",
            headers: discordHeaders,
          },
        );
        if (!deleteResult.ok) {
          console.error("discord-provision: delete child failed", deleteResult);
        }
      }
      for (const category of categories) {
        const deleteResult = await fetchDiscord(
          `${DISCORD_API_BASE}/channels/${category.id}`,
          {
            method: "DELETE",
            headers: discordHeaders,
          },
        );
        if (!deleteResult.ok) {
          console.error("discord-provision: delete failed", deleteResult);
        }
      }
    };

    const legacyCleanup = async () => {
      await deleteChannel("📅-tl-planning");
      await deleteChannel("🎁-tl-loots");
      await deleteChannel("groupe");
      await deleteChannel("wishlist");
      await deleteChannel("dps-meter");
      await deleteChannel("sondage");
      await deleteChannel("points-activites");
      await deleteChannel("Event", CATEGORY_TYPE);
      await deleteChannel("📅-Event", CATEGORY_TYPE);
      await deleteChannel(LOOT_CATEGORY_NAME, CATEGORY_TYPE);
      await deleteChannel(MISC_CATEGORY_NAME, CATEGORY_TYPE);
      const days = [
        "lundi",
        "mardi",
        "mercredi",
        "jeudi",
        "vendredi",
        "samedi",
        "dimanche",
        "event-lundi",
        "event-mardi",
        "event-mercredi",
        "event-jeudi",
        "event-vendredi",
        "event-samedi",
        "event-dimanche",
        ...EVENT_DAYS.map((day) => day.label),
      ];
      for (const day of days) {
        await deleteChannel(day);
      }
    };

    const hasAnyChannel = Object.values(channelConfig).some(Boolean);
    if (!hasAnyChannel && body.mode !== "reset") {
      await legacyCleanup();
      await deleteChannel(WISHLIST_CHANNEL);
      await deleteChannel(LOOT_CHANNEL);
      await deleteChannel(DPS_CHANNEL);
      await deleteChannel(ACTIVITY_CHANNEL);
      await deleteChannel(POLL_CHANNEL);
      await deleteChannelsByName(EVENT_INSCRIPTION_CHANNEL);
      await deleteChannelsByName(EVENT_GROUP_CHANNEL);
      for (const day of EVENT_DAYS) {
        await deleteCategoryAndChildren(day.label);
      }
      await deleteCategoryAndChildren(LOOT_CATEGORY_NAME);
      await deleteCategoryAndChildren(MISC_CATEGORY_NAME);
      await deleteCategoryAndChildren(ROOT_CATEGORY_NAME);
      return respondJson(200, { success: true, channels: [] });
    }

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

    await legacyCleanup();

    const rootCategory = await ensureChannel(ROOT_CATEGORY_NAME, undefined, {
      type: CATEGORY_TYPE,
      position: 0,
    });

    const inscriptionResult = await ensureChannel(INSCRIPTION_CHANNEL, undefined, {
      parentId: rootCategory.channel.id,
      position: 0,
    });
    if (inscriptionResult.created) {
      await postWelcomeMessage(inscriptionResult.channel.id);
    }

    let planningResult: { channel: DiscordChannel; created: boolean } | null =
      null;
    let groupsResult: { channel: DiscordChannel; created: boolean } | null =
      null;

    if (channelConfig.event) {
      for (const [index, day] of EVENT_DAYS.entries()) {
        const dayCategory = await ensureChannel(day.label, privateOverwrites, {
          type: CATEGORY_TYPE,
          position: index + 1,
        });
        const dayInscription = await ensureChannel(
          EVENT_INSCRIPTION_CHANNEL,
          privateOverwrites,
          {
            parentId: dayCategory.channel.id,
            position: 0,
          },
        );
        const dayGroup = await ensureChannel(
          EVENT_GROUP_CHANNEL,
          privateOverwrites,
          {
            parentId: dayCategory.channel.id,
            position: 1,
          },
        );
        if (index === 0) {
          planningResult = dayInscription;
          groupsResult = dayGroup;
        }
      }
    } else {
      for (const day of EVENT_DAYS) {
        await deleteCategoryAndChildren(day.label);
      }
      await deleteChannelsByName(EVENT_INSCRIPTION_CHANNEL);
      await deleteChannelsByName(EVENT_GROUP_CHANNEL);
    }

    let lootCategory: { channel: DiscordChannel } | null = null;
    if (channelConfig.loot || channelConfig.wishlist) {
      lootCategory = await ensureChannel(LOOT_CATEGORY_NAME, privateOverwrites, {
        type: CATEGORY_TYPE,
        position: 8,
      });
    } else {
      await deleteCategoryAndChildren(LOOT_CATEGORY_NAME);
    }

    if (lootCategory) {
      let lootPosition = 0;
      if (channelConfig.wishlist) {
        await ensureChannel(WISHLIST_CHANNEL, privateOverwrites, {
          parentId: lootCategory.channel.id,
          position: lootPosition++,
        });
      } else {
        await deleteChannel(WISHLIST_CHANNEL);
      }
      if (channelConfig.loot) {
        await ensureChannel(LOOT_CHANNEL, privateOverwrites, {
          parentId: lootCategory.channel.id,
          position: lootPosition++,
        });
      } else {
        await deleteChannel(LOOT_CHANNEL);
      }
    }

    let miscCategory: { channel: DiscordChannel } | null = null;
    let activityChannel: { channel: DiscordChannel } | null = null;
    if (
      channelConfig.dps_meter ||
      channelConfig.activity_points ||
      channelConfig.polls
    ) {
      miscCategory = await ensureChannel(MISC_CATEGORY_NAME, privateOverwrites, {
        type: CATEGORY_TYPE,
        position: 9,
      });
    } else {
      await deleteCategoryAndChildren(MISC_CATEGORY_NAME);
    }

    if (miscCategory) {
      let miscPosition = 0;
      if (channelConfig.dps_meter) {
        await ensureChannel(DPS_CHANNEL, privateOverwrites, {
          parentId: miscCategory.channel.id,
          position: miscPosition++,
        });
      } else {
        await deleteChannel(DPS_CHANNEL);
      }
      if (channelConfig.activity_points) {
        activityChannel = await ensureChannel(ACTIVITY_CHANNEL, privateOverwrites, {
          parentId: miscCategory.channel.id,
          position: miscPosition++,
        });
      } else {
        await deleteChannel(ACTIVITY_CHANNEL);
        activityChannel = null;
      }
      if (channelConfig.polls) {
        await ensureChannel(POLL_CHANNEL, privateOverwrites, {
          parentId: miscCategory.channel.id,
          position: miscPosition++,
        });
      } else {
        await deleteChannel(POLL_CHANNEL);
      }
    }

    const { error: updateError } = await supabase
      .from("guild_configs")
      .update({
        raid_channel_id: planningResult?.channel.id ?? null,
        group_channel_id: groupsResult?.channel.id ?? null,
        discord_member_role_id: memberRole.id,
        activity_channel_id: activityChannel?.channel.id ?? null,
      })
      .eq("owner_id", authData.user.id);

    if (updateError) {
      console.error("discord-provision: db update failed", updateError);
      return respondJson(500, { error: "Impossible de sauvegarder la config." });
    }

    return respondJson(200, {
      success: true,
      role_id: memberRole.id,
      channels: [
        inscriptionResult.channel,
        planningResult?.channel ?? null,
        groupsResult?.channel ?? null,
      ],
    });
  } catch (error) {
    console.error("discord-provision: unexpected error", error);
    return respondJson(500, {
      error: error instanceof Error ? error.message : error,
    });
  }
});
