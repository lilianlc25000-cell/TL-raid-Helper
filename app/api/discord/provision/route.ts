import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

type ChannelInfo = {
  id: string;
  name: string;
};

type GuildInfo = {
  name?: string;
};

const CHANNELS = [
  { key: "raid", name: "raid-helper" },
  { key: "polls", name: "sondages" },
  { key: "loot", name: "loot" },
  { key: "groups", name: "groupes" },
  { key: "dps", name: "dps" },
] as const;

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

  let guildName: string | null = null;
  const guildResponse = await fetch(
    `https://discord.com/api/v10/guilds/${config.discord_guild_id}`,
    { headers: discordHeaders },
  );
  if (guildResponse.ok) {
    const guild = (await guildResponse.json()) as GuildInfo;
    guildName = guild.name ?? null;
  }

  const channelsResponse = await fetch(
    `https://discord.com/api/v10/guilds/${config.discord_guild_id}/channels`,
    { headers: discordHeaders },
  );
  if (!channelsResponse.ok) {
    return NextResponse.json(
      { error: "discord_channels_failed" },
      { status: 500 },
    );
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
        return NextResponse.json(
          { error: "discord_channel_create_failed" },
          { status: 500 },
        );
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
      return NextResponse.json(
        { error: "discord_webhook_create_failed" },
        { status: 500 },
      );
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
  if (guildName) {
    updatePayload.guild_name = guildName;
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

  return NextResponse.json({ ok: true, created, webhooks });
}
