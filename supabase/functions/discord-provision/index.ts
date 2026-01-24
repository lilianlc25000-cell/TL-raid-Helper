import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type GuildConfigRow = {
  id: string;
  owner_id: string;
  discord_guild_id: string;
};

type ChannelInfo = {
  id: string;
  name: string;
};

const CHANNELS = [
  { key: "raid", name: "raid-helper" },
  { key: "polls", name: "sondages" },
  { key: "loot", name: "loot" },
  { key: "groups", name: "groupes" },
  { key: "dps", name: "dps" },
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getDiscordHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  "Content-Type": "application/json",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const discordBotToken = Deno.env.get("DISCORD_BOT_TOKEN");

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return json(500, { ok: false, error: "missing_supabase_env" });
  }
  if (!discordBotToken) {
    return json(500, { ok: false, error: "missing_discord_bot_token" });
  }

  const payload = (await req.json().catch(() => null)) as
    | { access_token?: string }
    | null;
  const authHeader = req.headers.get("Authorization") ?? "";
  let token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : "";
  if (!token && payload?.access_token) {
    token = payload.access_token;
  }
  if (!token) {
    return json(401, { ok: false, error: "missing_auth" });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: authData, error: authError } =
    await adminClient.auth.getUser(token);
  let resolvedUser = authData.user;
  let resolvedError = authError;

  if (!resolvedUser) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: fallbackData, error: fallbackError } =
      await authClient.auth.getUser();
    resolvedUser = fallbackData.user ?? null;
    resolvedError = fallbackError ?? resolvedError;
  }

  if (!resolvedUser) {
    return json(401, {
      ok: false,
      error: "invalid_auth",
      detail: resolvedError?.message ?? null,
    });
  }

  const adminId = resolvedUser.id;
  const { data: config } = await adminClient
    .from("guild_configs")
    .select("id,owner_id,discord_guild_id")
    .eq("owner_id", adminId)
    .maybeSingle() as { data: GuildConfigRow | null };

  if (!config?.discord_guild_id) {
    return json(404, {
      ok: false,
      error: "missing_guild_config",
      detail: "Aucune configuration Discord trouvée pour ce compte.",
    });
  }

  const discordHeaders = getDiscordHeaders(discordBotToken);
  const channelsResponse = await fetch(
    `https://discord.com/api/v10/guilds/${config.discord_guild_id}/channels`,
    { headers: discordHeaders },
  );
  if (!channelsResponse.ok) {
    return json(500, { ok: false, error: "discord_channels_failed" });
  }

  const channels = (await channelsResponse.json()) as ChannelInfo[];
  const created: Record<string, string> = {};
  const webhooks: Record<string, string> = {};

  for (const entry of CHANNELS) {
    const existing = channels.find((channel) => channel.name === entry.name);
    let channelId = existing?.id;

    if (!channelId) {
      const createResponse = await fetch(
        `https://discord.com/api/v10/guilds/${config.discord_guild_id}/channels`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({ name: entry.name, type: 0 }),
        },
      );
      if (!createResponse.ok) {
        return json(500, { ok: false, error: "discord_channel_create_failed" });
      }
      const createdChannel = (await createResponse.json()) as ChannelInfo;
      channelId = createdChannel.id;
      created[entry.key] = channelId;
    }

    const webhookResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/webhooks`,
      {
        method: "POST",
        headers: discordHeaders,
        body: JSON.stringify({ name: "TL Raid Manager" }),
      },
    );
    if (!webhookResponse.ok) {
      return json(500, { ok: false, error: "discord_webhook_create_failed" });
    }
    const webhook = (await webhookResponse.json()) as { url?: string };
    if (webhook.url) {
      webhooks[entry.key] = webhook.url;
    }
  }

  const updatePayload: Record<string, string | null> = {
    raid_channel_id: created.raid ?? null,
    polls_channel_id: created.polls ?? null,
    loot_channel_id: created.loot ?? null,
    groups_channel_id: created.groups ?? null,
    dps_channel_id: created.dps ?? null,
    raid_webhook_url: webhooks.raid ?? null,
    polls_webhook_url: webhooks.polls ?? null,
    loot_webhook_url: webhooks.loot ?? null,
    groups_webhook_url: webhooks.groups ?? null,
    dps_webhook_url: webhooks.dps ?? null,
  };

  const { error: updateError } = await adminClient
    .from("guild_configs")
    .update(updatePayload)
    .eq("id", config.id);

  if (updateError) {
    return json(500, { ok: false, error: "guild_config_update_failed" });
  }

  return json(200, { ok: true, created, webhooks });
});
