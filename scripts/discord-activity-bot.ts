import { createClient } from "@supabase/supabase-js";
import { Client, GatewayIntentBits } from "discord.js";

const botToken = process.env.DISCORD_BOT_TOKEN ?? "";
const ingestUrl = process.env.DISCORD_INGEST_URL ?? "";
const ingestSecret = process.env.DISCORD_INGEST_SECRET ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!botToken || !ingestUrl || !supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing DISCORD_BOT_TOKEN, DISCORD_INGEST_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

let activityChannelIds = new Set<string>();
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const refreshActivityChannels = async (guildIds: Set<string>) => {
  try {
    const { data, error } = await supabase
      .from("guild_configs")
      .select("activity_channel_id,discord_guild_id")
      .not("activity_channel_id", "is", null);
    if (error) {
      console.error("Unable to load activity channels:", error.message);
      return;
    }
    const allowed = (data ?? [])
      .filter((row) => row.discord_guild_id && guildIds.has(row.discord_guild_id))
      .map((row) => row.activity_channel_id)
      .filter(Boolean) as string[];
    activityChannelIds = new Set(allowed);
  } catch (error) {
    console.error("Load activity channels error:", error);
  }
};

const startPollingFallback = (guildIds: Set<string>) => {
  setInterval(() => {
    void refreshActivityChannels(guildIds);
  }, 120_000);
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!activityChannelIds.has(message.channelId)) return;
  if (message.attachments.size === 0) return;

  const attachment = message.attachments.first();
  const attachmentUrl = attachment?.url;
  if (!attachmentUrl) return;

  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ingestSecret ? { "x-ingest-secret": ingestSecret } : {}),
      },
      body: JSON.stringify({
        discord_user_id: message.author.id,
        attachment_url: attachmentUrl,
        message_id: message.id,
        channel_id: message.channelId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OCR ingest failed:", errorText);
      return;
    }

    await message.delete();
  } catch (error) {
    console.error("OCR ingest error:", error);
  }
});

client.once("ready", () => {
  console.log(`Discord OCR bot connecté en tant que ${client.user?.tag ?? "?"}`);
  const guildIds = new Set(client.guilds.cache.map((guild) => guild.id));
  void refreshActivityChannels(guildIds);

  const channel = supabase
    .channel("activity-channel-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "guild_configs" },
      () => {
        void refreshActivityChannels(guildIds);
      },
    );
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("Discord OCR bot: abonnement Realtime actif.");
      startPollingFallback(guildIds);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("Discord OCR bot: Realtime indisponible, fallback polling.");
      startPollingFallback(guildIds);
    }
  });
});

client.login(botToken);
