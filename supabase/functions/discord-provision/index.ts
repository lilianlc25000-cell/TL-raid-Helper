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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchDiscord = async <T>(
  url: string,
  options: RequestInit,
  attempt = 0,
): Promise<{ ok: true; data: T | null } | { ok: false; status: number; body: string }> => {
  const response = await fetch(url, options);
  if (response.status === 429 && attempt < 5) {
    const retryHeader = response.headers.get("retry-after") ?? "1";
    const retrySeconds = Number(retryHeader);
    const waitMs = Number.isFinite(retrySeconds)
      ? Math.max(1, retrySeconds) * 1000
      : 1000;
    await sleep(waitMs);
    return fetchDiscord<T>(url, options, attempt + 1);
  }
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

    let channels = channelsResult.data ?? [];
    const channelsByName = new Map(
      channels.map((channel) => [channel.name, channel]),
    );
    const channelsById = new Map(
      channels.map((channel) => [channel.id, channel]),
    );
    const findChannel = (name: string, type?: number, parentId?: string | null) =>
      channels.find(
        (channel) =>
          channel.name === name &&
          (type === undefined || channel.type === type) &&
          (parentId === undefined ||
            (channel.parent_id ?? null) === parentId),
      );

    const { data: managedRows, error: managedError } = await supabase
      .from("discord_channels")
      .select("kind,day_key,channel_id")
      .eq("owner_id", authData.user.id);

    if (managedError) {
      console.error("discord-provision: managed channels error", managedError);
      return respondJson(500, { error: "Impossible de lire les salons gérés." });
    }

    const managedByKey = new Map(
      (managedRows ?? []).map((row) => [
        `${row.kind}:${row.day_key ?? ""}`,
        row as { kind: string; day_key: string | null; channel_id: string },
      ]),
    );

    const warnings: string[] = [];

    const ensureCategory = async (
      name: string,
      position?: number,
      overwrites?: typeof privateOverwrites,
    ) => {
      const existing = channels.find(
        (channel) => channel.name === name && channel.type === CATEGORY_TYPE,
      );
      if (existing?.id) {
        return existing.id;
      }
      const createResult = await fetchDiscord<DiscordChannel>(
        `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({
            name,
            type: CATEGORY_TYPE,
            position,
            permission_overwrites: overwrites,
          }),
        },
      );
      if (!createResult.ok || !createResult.data?.id) {
        throw new Error("CRITICAL: Category ID is missing during update loop");
      }
      channels.push(createResult.data);
      channelsById.set(createResult.data.id, createResult.data);
      channelsByName.set(createResult.data.name, createResult.data);
      return createResult.data.id;
    };

    const ensureManagedCategory = async (
      kind: string,
      dayKey: string | null,
      name: string,
      position?: number,
      overwrites?: typeof privateOverwrites,
    ) => {
      const categoryId = await ensureCategory(name, position, overwrites);
      if (!categoryId) {
        throw new Error("CRITICAL: Category ID is missing during update loop");
      }
      await upsertManagedChannel(kind, dayKey, categoryId);
      const channel = channelsById.get(categoryId) ?? { id: categoryId, name };
      return { channel, created: false };
    };

    const ensureChannel = async (
      name: string,
      overwrites?: typeof privateOverwrites,
      options?: { type?: number; parentId?: string | null; position?: number },
    ): Promise<{ channel: DiscordChannel; created: boolean }> => {
      const existing = findChannel(name, options?.type, options?.parentId);
      if (existing) {
        if (
          overwrites ||
          options?.parentId !== undefined ||
          options?.position !== undefined
        ) {
          const parentId =
            options?.parentId !== undefined ? options.parentId : existing.parent_id ?? null;
          const patchResult = await fetchDiscord(
            `${DISCORD_API_BASE}/channels/${existing.id}`,
            {
              method: "PATCH",
              headers: discordHeaders,
              body: JSON.stringify({
                permission_overwrites: overwrites,
                parent_id: parentId,
                position: options?.position,
              }),
            },
          );
          if (!patchResult.ok) {
            console.error("discord-provision: channel patch failed", patchResult);
            warnings.push(`Impossible de mettre à jour le salon ${name}.`);
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

    const deleteManagedChannel = async (kind: string, dayKey?: string | null) => {
      const key = `${kind}:${dayKey ?? ""}`;
      const managed = managedByKey.get(key);
      if (!managed) {
        return;
      }
      const existing = channelsById.get(managed.channel_id);
      if (existing) {
        await fetchDiscord(`${DISCORD_API_BASE}/channels/${existing.id}`, {
          method: "DELETE",
          headers: discordHeaders,
        });
      }
      const deleteQuery = supabase
        .from("discord_channels")
        .delete()
        .eq("owner_id", authData.user.id)
        .eq("kind", kind);
      if (dayKey === null || dayKey === undefined) {
        await deleteQuery.is("day_key", null);
      } else {
        await deleteQuery.eq("day_key", dayKey);
      }
      managedByKey.delete(key);
    };

    const upsertManagedChannel = async (
      kind: string,
      dayKey: string | null,
      channelId: string,
    ) => {
      await supabase.from("discord_channels").upsert(
        {
          owner_id: authData.user.id,
          kind,
          day_key: dayKey,
          channel_id: channelId,
        },
        { onConflict: "owner_id,kind,day_key" },
      );
      managedByKey.set(`${kind}:${dayKey ?? ""}`, {
        kind,
        day_key: dayKey,
        channel_id: channelId,
      });
    };

    const ensureManagedChannel = async (
      kind: string,
      dayKey: string | null,
      name: string,
      overwrites?: typeof privateOverwrites,
      options?: { type?: number; parentId?: string | null; position?: number },
    ) => {
      const key = `${kind}:${dayKey ?? ""}`;
      const managed = managedByKey.get(key);
      let existing = managed ? channelsById.get(managed.channel_id) : undefined;
      if (!existing) {
        const byName = findChannel(name, options?.type, options?.parentId);
        if (byName) {
          existing = byName;
          await upsertManagedChannel(kind, dayKey, byName.id);
        }
      }
      if (existing) {
        if (
          overwrites ||
          options?.parentId !== undefined ||
          options?.position !== undefined
        ) {
          const parentId =
            options?.parentId !== undefined
              ? options.parentId
              : existing.parent_id ?? null;
          if (
            options?.type !== CATEGORY_TYPE &&
            options?.parentId === undefined
          ) {
            throw new Error("Category ID missing");
          }
          console.log(
            "Updating channel",
            existing.id,
            "into parent",
            parentId,
          );
          const patchResult = await fetchDiscord(
            `${DISCORD_API_BASE}/channels/${existing.id}`,
            {
              method: "PATCH",
              headers: discordHeaders,
              body: JSON.stringify({
                name,
                permission_overwrites: overwrites,
                parent_id: parentId,
                position: options?.position,
              }),
            },
          );
          if (!patchResult.ok) {
            console.error("discord-provision: channel patch failed", patchResult);
            warnings.push(`Impossible de mettre à jour le salon ${name}.`);
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
      channelsById.set(createResult.data.id, createResult.data);
      await upsertManagedChannel(kind, dayKey, createResult.data.id);
      return { channel: createResult.data, created: true };
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

    const refreshChannels = async () => {
      const refreshed = await fetchDiscord<DiscordChannel[]>(
        `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      if (!refreshed.ok) {
        console.error("discord-provision: channels refresh failed", refreshed);
        return;
      }
      channels = refreshed.data ?? [];
      channelsByName.clear();
      channels.forEach((channel) => channelsByName.set(channel.name, channel));
    };

    const reconcileCategory = async (
      parentId: string,
      expectedIds: string[],
    ) => {
      const expectedSet = new Set(expectedIds);
      const orphans = channels.filter(
        (channel) =>
          (channel.parent_id ?? null) === parentId &&
          !expectedSet.has(channel.id),
      );
      await Promise.all(
        orphans.map((channel) =>
          fetchDiscord(`${DISCORD_API_BASE}/channels/${channel.id}`, {
            method: "DELETE",
            headers: discordHeaders,
          }),
        ),
      );
    };

    const purgeManagedChannels = async () => {
      const categoryNames = [
        ROOT_CATEGORY_NAME,
        LOOT_CATEGORY_NAME,
        MISC_CATEGORY_NAME,
        ...EVENT_DAYS.map((day) => day.label),
      ];
      const channelNames = [
        INSCRIPTION_CHANNEL,
        EVENT_INSCRIPTION_CHANNEL,
        EVENT_GROUP_CHANNEL,
        WISHLIST_CHANNEL,
        LOOT_CHANNEL,
        DPS_CHANNEL,
        ACTIVITY_CHANNEL,
        POLL_CHANNEL,
      ];
      await Promise.all(
        categoryNames.map((name) => deleteCategoryAndChildren(name)),
      );
      await Promise.all(channelNames.map((name) => deleteChannelsByName(name)));
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
      await Promise.all(
        (managedRows ?? []).map((row) =>
          deleteManagedChannel(row.kind, row.day_key),
        ),
      );
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

    const rootCategory = await ensureManagedCategory(
      "root_category",
      null,
      ROOT_CATEGORY_NAME,
      0,
    );

    const inscriptionResult = await ensureManagedChannel(
      "inscription_channel",
      null,
      INSCRIPTION_CHANNEL,
      undefined,
      {
        parentId: rootCategory.channel.id,
        position: 0,
      },
    );
    if (inscriptionResult.created) {
      await postWelcomeMessage(inscriptionResult.channel.id);
    }
    await refreshChannels();
    await reconcileCategory(rootCategory.channel.id, [inscriptionResult.channel.id]);

    let planningResult: { channel: DiscordChannel; created: boolean } | null =
      null;
    let groupsResult: { channel: DiscordChannel; created: boolean } | null =
      null;

    if (channelConfig.event) {
      const dayResults = await Promise.all(
        EVENT_DAYS.map(async (day, index) => {
          const dayCategory = await ensureManagedCategory(
            "event_day_category",
            day.key,
            day.label,
            index + 1,
            privateOverwrites,
          );
          const dayInscription = await ensureManagedChannel(
            "event_inscription_channel",
            day.key,
            EVENT_INSCRIPTION_CHANNEL,
            privateOverwrites,
            {
              parentId: dayCategory.channel.id,
              position: 0,
            },
          );
          const dayGroup = await ensureManagedChannel(
            "event_group_channel",
            day.key,
            EVENT_GROUP_CHANNEL,
            privateOverwrites,
            {
              parentId: dayCategory.channel.id,
              position: 1,
            },
          );
          return { index, dayCategory, dayInscription, dayGroup };
        }),
      );
      const first = dayResults.find((result) => result.index === 0);
      if (first) {
        planningResult = first.dayInscription;
        groupsResult = first.dayGroup;
      }
      await refreshChannels();
      await Promise.all(
        dayResults.map((result) =>
          reconcileCategory(result.dayCategory.channel.id, [
            result.dayInscription.channel.id,
            result.dayGroup.channel.id,
          ]),
        ),
      );
    } else {
      await Promise.all(
        EVENT_DAYS.map((day) => deleteManagedChannel("event_day_category", day.key)),
      );
      await Promise.all(
        EVENT_DAYS.map((day) =>
          deleteManagedChannel("event_inscription_channel", day.key),
        ),
      );
      await Promise.all(
        EVENT_DAYS.map((day) =>
          deleteManagedChannel("event_group_channel", day.key),
        ),
      );
    }

    let lootCategory: { channel: DiscordChannel } | null = null;
    if (channelConfig.loot || channelConfig.wishlist) {
      lootCategory = await ensureManagedCategory(
        "loot_category",
        null,
        LOOT_CATEGORY_NAME,
        8,
        privateOverwrites,
      );
    } else {
      await deleteManagedChannel("loot_category", null);
    }

    if (lootCategory) {
      const lootOps: Array<Promise<{ id?: string }>> = [];
      if (channelConfig.wishlist) {
        lootOps.push(
          ensureManagedChannel(
            "wishlist_channel",
            null,
            WISHLIST_CHANNEL,
            privateOverwrites,
            {
              parentId: lootCategory.channel.id,
              position: 0,
            },
          ).then((res) => ({ id: res.channel.id })),
        );
      } else {
        lootOps.push(deleteManagedChannel("wishlist_channel", null).then(() => ({})));
      }
      if (channelConfig.loot) {
        lootOps.push(
          ensureManagedChannel(
            "loot_channel",
            null,
            LOOT_CHANNEL,
            privateOverwrites,
            {
              parentId: lootCategory.channel.id,
              position: channelConfig.wishlist ? 1 : 0,
            },
          ).then((res) => ({ id: res.channel.id })),
        );
      } else {
        lootOps.push(deleteManagedChannel("loot_channel", null).then(() => ({})));
      }
      const lootResults = await Promise.all(lootOps);
      const expectedLootIds = lootResults
        .map((result) => result.id)
        .filter((id): id is string => Boolean(id));
      await refreshChannels();
      await reconcileCategory(lootCategory.channel.id, expectedLootIds);
    }

    let miscCategory: { channel: DiscordChannel } | null = null;
    let activityChannel: { channel: DiscordChannel } | null = null;
    if (
      channelConfig.dps_meter ||
      channelConfig.activity_points ||
      channelConfig.polls
    ) {
      miscCategory = await ensureManagedCategory(
        "misc_category",
        null,
        MISC_CATEGORY_NAME,
        9,
        privateOverwrites,
      );
    } else {
      await deleteManagedChannel("misc_category", null);
    }

    if (miscCategory) {
      const miscOps: Array<Promise<{ id?: string; kind?: string }>> = [];
      if (channelConfig.dps_meter) {
        miscOps.push(
          ensureManagedChannel(
            "dps_channel",
            null,
            DPS_CHANNEL,
            privateOverwrites,
            {
              parentId: miscCategory.channel.id,
              position: 0,
            },
          ).then((res) => ({ id: res.channel.id, kind: "dps" })),
        );
      } else {
        miscOps.push(deleteManagedChannel("dps_channel", null).then(() => ({})));
      }
      if (channelConfig.activity_points) {
        miscOps.push(
          ensureManagedChannel(
            "activity_channel",
            null,
            ACTIVITY_CHANNEL,
            privateOverwrites,
            {
              parentId: miscCategory.channel.id,
              position: channelConfig.dps_meter ? 1 : 0,
            },
          ).then((res) => ({ id: res.channel.id, kind: "activity" })),
        );
      } else {
        miscOps.push(
          deleteManagedChannel("activity_channel", null).then(() => ({})),
        );
      }
      if (channelConfig.polls) {
        const position =
          (channelConfig.dps_meter ? 1 : 0) +
          (channelConfig.activity_points ? 1 : 0);
        miscOps.push(
          ensureManagedChannel(
            "poll_channel",
            null,
            POLL_CHANNEL,
            privateOverwrites,
            {
              parentId: miscCategory.channel.id,
              position,
            },
          ).then((res) => ({ id: res.channel.id, kind: "poll" })),
        );
      } else {
        miscOps.push(deleteManagedChannel("poll_channel", null).then(() => ({})));
      }
      const miscResults = await Promise.all(miscOps);
      const expectedMiscIds = miscResults
        .map((result) => result.id)
        .filter((id): id is string => Boolean(id));
      const activityResult = miscResults.find((result) => result.kind === "activity");
      activityChannel = activityResult?.id
        ? { channel: { id: activityResult.id, name: ACTIVITY_CHANNEL } }
        : null;
      await refreshChannels();
      await reconcileCategory(miscCategory.channel.id, expectedMiscIds);
    }

    const updatePayload = {
      raid_channel_id: planningResult?.channel.id ?? null,
      group_channel_id: groupsResult?.channel.id ?? null,
      discord_member_role_id: memberRole.id,
      activity_channel_id: activityChannel?.channel.id ?? null,
    };
    let updateError = (
      await supabase
        .from("guild_configs")
        .update(updatePayload)
        .eq("owner_id", authData.user.id)
    ).error;
    if (updateError?.code === "PGRST204") {
      warnings.push(
        "activity_channel_id manquant dans le schema cache, update sans ce champ.",
      );
      const fallbackPayload = {
        raid_channel_id: updatePayload.raid_channel_id,
        group_channel_id: updatePayload.group_channel_id,
        discord_member_role_id: updatePayload.discord_member_role_id,
      };
      updateError = (
        await supabase
          .from("guild_configs")
          .update(fallbackPayload)
          .eq("owner_id", authData.user.id)
      ).error;
    }

    if (updateError) {
      console.error("discord-provision: db update failed", updateError);
      return respondJson(500, {
        error: "Impossible de sauvegarder la config.",
        detail: updateError.message ?? null,
        warnings,
      });
    }

    return respondJson(200, {
      success: true,
      role_id: memberRole.id,
      warnings,
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
