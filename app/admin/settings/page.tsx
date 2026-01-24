import Link from "next/link";
import DiscordProvisionClient from "@/app/admin/settings/DiscordProvisionClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN ?? "";

const successMessages: Record<string, string> = {
  discord_connected: "Webhook Discord connecté avec succès.",
};

const errorMessages: Record<string, string> = {
  discord_missing_code: "Code Discord manquant.",
  discord_missing_env: "Variables d'environnement Discord manquantes.",
  discord_oauth_failed: "Échec de l'autorisation Discord.",
  discord_webhook_missing: "Webhook Discord introuvable.",
  discord_save_failed: "Impossible d'enregistrer la config Discord.",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string } | Promise<{ success?: string; error?: string }>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const appUrl = appUrlFromEnv.trim().replace(/\/+$/, "");
  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const discordOauthUrl = `https://discord.com/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=webhook.incoming`;
  const discordBotInviteUrl = discordClientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=536874000&integration_type=0&scope=bot%20applications.commands`
    : "";
  const isDiscordReady = Boolean(discordClientId);
  const isWebhookReady = Boolean(discordClientId && appUrl);

  const successKey = resolvedSearchParams?.success ?? null;
  const successMessage = successKey && successMessages[successKey];
  const errorMessage =
    resolvedSearchParams?.error &&
    errorMessages[resolvedSearchParams.error];

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const ownerId = authData.user?.id ?? null;
  const { data: guildConfig } = ownerId
    ? await supabase
        .from("guild_configs")
        .select(
          "guild_name,discord_guild_id,discord_webhook_url,raid_channel_id,polls_channel_id,loot_channel_id,groups_channel_id,dps_channel_id,statics_pvp_channel_id,statics_pve_channel_id",
        )
        .eq("owner_id", ownerId)
        .maybeSingle()
    : { data: null };

  const hasWebhook = Boolean(
    guildConfig?.discord_guild_id && guildConfig?.discord_webhook_url,
  );

  let botLinked = false;
  let botGuildName: string | null = null;
  if (discordBotToken && guildConfig?.discord_guild_id) {
    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildConfig.discord_guild_id}`,
      {
        headers: { Authorization: `Bot ${discordBotToken}` },
        cache: "no-store",
      },
    );
    if (guildResponse.ok) {
      const guild = (await guildResponse.json()) as { name?: string };
      botLinked = true;
      botGuildName = guild.name ?? null;
    }
  }

  const connectedGuildName =
    botGuildName ?? guildConfig?.guild_name ?? null;
  const canProvision = botLinked && hasWebhook;

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-gold/50 bg-surface/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-gold/70">
          Réglages
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
          Paramètres Admin
        </h1>
        <p className="mt-2 text-sm text-text/70">
          Connecte ton serveur Discord pour activer les notifications.
        </p>
        {successMessage ? (
          <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Étape 1 · Webhook
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text">
            Connecter un webhook
          </h2>
          <p className="mt-2 text-sm text-text/70">
            Choisis un salon pour lier la guilde à l’application.
          </p>
          {hasWebhook ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200">
              Webhook connecté
            </div>
          ) : isWebhookReady ? (
            <Link
              href={discordOauthUrl}
              className="mt-5 inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
            >
              Connecter un webhook
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              Configure NEXT_PUBLIC_APP_URL pour activer le webhook.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Étape 2 · Bot
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text">
            Installer le bot Discord
          </h2>
          <p className="mt-2 text-sm text-text/70">
            Le bot doit être ajouté au serveur pour créer les salons.
          </p>
          {botLinked ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200">
              Bot installé · {connectedGuildName ?? "Serveur Discord"}
            </div>
          ) : isDiscordReady ? (
            <Link
              href={discordBotInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
            >
              Installer le bot (nouvel onglet)
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              Configure DISCORD_CLIENT_ID pour activer l'installation du bot.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <DiscordProvisionClient
          initialStatus={{
            raid_channel_id: guildConfig?.raid_channel_id ?? null,
            polls_channel_id: guildConfig?.polls_channel_id ?? null,
            loot_channel_id: guildConfig?.loot_channel_id ?? null,
            groups_channel_id: guildConfig?.groups_channel_id ?? null,
            dps_channel_id: guildConfig?.dps_channel_id ?? null,
            statics_pvp_channel_id: guildConfig?.statics_pvp_channel_id ?? null,
            statics_pve_channel_id: guildConfig?.statics_pve_channel_id ?? null,
          }}
          canProvision={canProvision}
          guildName={connectedGuildName}
        />
      </section>
    </div>
  );
}
