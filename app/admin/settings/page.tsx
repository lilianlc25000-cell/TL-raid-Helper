import { createClient } from "@/lib/supabase/server";
import EligibilityAndDiscordClient from "@/app/admin/settings/EligibilityAndDiscordClient";
import LootSystemSettingsClient from "@/app/admin/settings/LootSystemSettingsClient";

export const dynamic = "force-dynamic";

const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN ?? "";
const DISCORD_API_BASE = "https://discord.com/api/v10";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id ?? null;
  const { data: profile } = currentUserId
    ? await supabase
        .from("profiles")
        .select("guild_id")
        .eq("user_id", currentUserId)
        .maybeSingle()
    : { data: null };
  const guildId = profile?.guild_id ?? null;
  const { data: guild } = guildId
    ? await supabase
        .from("guilds")
        .select("owner_id")
        .eq("id", guildId)
        .maybeSingle()
    : { data: null };
  const ownerId = guild?.owner_id ?? null;

  const { data: guildConfig } = ownerId
    ? await supabase
        .from("guild_configs")
        .select(
          "discord_guild_id,discord_guild_name,raid_channel_id,loot_system,discord_channel_config,eligibility_criteria",
        )
        .eq("owner_id", ownerId)
        .maybeSingle()
    : { data: null };
  const { data: guildSettings } = guildId
    ? await supabase
        .from("guild_settings")
        .select("participation_threshold,activity_threshold")
        .eq("guild_id", guildId)
        .maybeSingle()
    : { data: null };

  let effectiveGuildConfig = guildConfig;
  if (guildConfig?.discord_guild_id && discordBotToken) {
    const checkResponse = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildConfig.discord_guild_id}`,
      { headers: { Authorization: `Bot ${discordBotToken}` } },
    );
    if (!checkResponse.ok) {
      await supabase.from("guild_configs").delete().eq("owner_id", ownerId);
      effectiveGuildConfig = null;
    }
  }

  const appUrl = appUrlFromEnv.trim().replace(/\/+$/, "");
  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const oauthUrl = discordClientId && appUrl
    ? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=8&response_type=code&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&scope=bot+applications.commands`
    : "";

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.35em] text-text/60">
            Réglages
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Paramètres Admin
          </h1>
        </header>

        <LootSystemSettingsClient
          ownerId={ownerId}
          initialLootSystem={effectiveGuildConfig?.loot_system ?? null}
          hasGuildConfig={Boolean(effectiveGuildConfig?.discord_guild_id)}
        />

        <EligibilityAndDiscordClient
          ownerId={ownerId}
          guildId={guildId}
          initialCriteria={(effectiveGuildConfig?.eligibility_criteria as string[]) ?? []}
          initialParticipationThreshold={
            guildSettings?.participation_threshold ?? 1
          }
          initialActivityThreshold={guildSettings?.activity_threshold ?? 1}
          discordGuildId={effectiveGuildConfig?.discord_guild_id ?? null}
          discordGuildName={effectiveGuildConfig?.discord_guild_name ?? null}
          discordChannelConfig={
            (effectiveGuildConfig?.discord_channel_config as Record<
              string,
              boolean
            >) ?? null
          }
          oauthUrl={oauthUrl}
        />
      </section>
    </div>
  );
}
