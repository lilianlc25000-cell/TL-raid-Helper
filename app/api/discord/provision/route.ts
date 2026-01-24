import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ChannelConfig = {
  key: string;
  name: string;
  channelIdField: string;
  webhookField: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
};

type DiscordWebhook = {
  id: string;
  url: string;
  name: string;
};

type GuildInfo = {
  id: string;
  name: string;
};

const CHANNELS: ChannelConfig[] = [
  { key: "raid", name: "raid-helper", channelIdField: "raid_channel_id", webhookField: "raid_webhook_url" },
  { key: "polls", name: "sondages", channelIdField: "polls_channel_id", webhookField: "polls_webhook_url" },
  { key: "loot", name: "loot", channelIdField: "loot_channel_id", webhookField: "loot_webhook_url" },
  { key: "groups", name: "groupes", channelIdField: "groups_channel_id", webhookField: "groups_webhook_url" },
  { key: "dps", name: "dps-meter", channelIdField: "dps_channel_id", webhookField: "dps_webhook_url" },
  { key: "statics_pvp", name: "statics-pvp", channelIdField: "statics_pvp_channel_id", webhookField: "statics_pvp_webhook_url" },
  { key: "statics_pve", name: "statics-pve", channelIdField: "statics_pve_channel_id", webhookField: "statics_pve_webhook_url" },
];

const WEBHOOK_NAME = "TL Raid Manager";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    return NextResponse.json(
      { error: "missing_server_env" },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const ownerId = authData.user?.id ?? null;
  if (!ownerId) {
    return NextResponse.json(
      { error: "invalid_auth", detail: authError?.message ?? null },
      { status: 401 },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: config } = await adminClient
    .from("guild_configs")
    .select("id,discord_guild_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!config?.discord_guild_id) {
    return NextResponse.json(
      { error: "missing_guild_config" },
      { status: 400 },
    );
  }

  const discordHeaders = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  const guildResponse = await fetch(
    `https://discord.com/api/v10/guilds/${config.discord_guild_id}`,
    { headers: discordHeaders },
  );
  if (!guildResponse.ok) {
    return NextResponse.json(
      { error: "bot_not_in_guild" },
      { status: 403 },
    );
  }
  const guildInfo = (await guildResponse.json()) as GuildInfo;

  const channelsResponse = await fetch(
    `https://discord.com/api/v10/guilds/${config.discord_guild_id}/channels`,
    { headers: discordHeaders },
  );
  if (!channelsResponse.ok) {
    return NextResponse.json(
      { error: "channels_fetch_failed" },
      { status: 500 },
    );
  }
  const existingChannels = (await channelsResponse.json()) as DiscordChannel[];

  const updatePayload: Record<string, string | null> = {
    guild_name: guildInfo.name ?? null,
  };
  const createdChannels: Record<string, string> = {};
  const createdWebhooks: Record<string, string> = {};

  for (const channelConfig of CHANNELS) {
    let channel = existingChannels.find(
      (entry) => entry.name === channelConfig.name && entry.type === 0,
    );
    if (!channel) {
      const createResponse = await fetch(
        `https://discord.com/api/v10/guilds/${config.discord_guild_id}/channels`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({ name: channelConfig.name, type: 0 }),
        },
      );
      if (!createResponse.ok) {
        return NextResponse.json(
          { error: "channel_create_failed", channel: channelConfig.name },
          { status: 500 },
        );
      }
      channel = (await createResponse.json()) as DiscordChannel;
      createdChannels[channelConfig.key] = channel.id;
    }

    updatePayload[channelConfig.channelIdField] = channel.id;

    const webhooksResponse = await fetch(
      `https://discord.com/api/v10/channels/${channel.id}/webhooks`,
      { headers: discordHeaders },
    );
    if (!webhooksResponse.ok) {
      return NextResponse.json(
        { error: "webhook_fetch_failed", channel: channelConfig.name },
        { status: 500 },
      );
    }
    const existingWebhooks = (await webhooksResponse.json()) as DiscordWebhook[];
    let webhook = existingWebhooks.find(
      (entry) => entry.name === WEBHOOK_NAME,
    );
    if (!webhook) {
      const createWebhookResponse = await fetch(
        `https://discord.com/api/v10/channels/${channel.id}/webhooks`,
        {
          method: "POST",
          headers: discordHeaders,
          body: JSON.stringify({ name: WEBHOOK_NAME }),
        },
      );
      if (!createWebhookResponse.ok) {
        return NextResponse.json(
          { error: "webhook_create_failed", channel: channelConfig.name },
          { status: 500 },
        );
      }
      webhook = (await createWebhookResponse.json()) as DiscordWebhook;
    }

    updatePayload[channelConfig.webhookField] = webhook.url;
    createdWebhooks[channelConfig.key] = webhook.url;
  }

  const { error: updateError } = await adminClient
    .from("guild_configs")
    .update(updatePayload)
    .eq("id", config.id);

  if (updateError) {
    return NextResponse.json(
      { error: "guild_config_update_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    createdChannels,
    createdWebhooks,
    guildName: guildInfo.name ?? null,
  });
}
