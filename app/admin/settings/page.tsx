import Link from "next/link";
import DiscordProvisionClient from "@/app/admin/settings/DiscordProvisionClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";

const successMessages: Record<string, string> = {
  discord_connected: "Discord est bien connecté.",
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
          "guild_name,discord_guild_id,raid_channel_id,polls_channel_id,loot_channel_id,groups_channel_id,dps_channel_id",
        )
        .eq("owner_id", ownerId)
        .maybeSingle()
    : { data: null };
  const connectedGuildName = guildConfig?.guild_name ?? null;
  const hasDiscordGuild = Boolean(guildConfig?.discord_guild_id);

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
          Connecte ton serveur Discord pour activer les webhooks.
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
            Discord
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text">
            Installer le bot Discord
          </h2>
          <p className="mt-2 text-sm text-text/70">
            Le bot doit être installé sur le serveur avant de créer les salons.
          </p>
          {hasDiscordGuild ? (
            <div className="mt-5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200">
              {connectedGuildName || "Serveur Discord connecté"}
            </div>
          ) : isDiscordReady ? (
            <Link
              href={discordBotInviteUrl}
              className="mt-5 inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
            >
              Installer le bot
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              Configure DISCORD_CLIENT_ID pour activer l'installation du bot.
            </div>
          )}
          <p className="mt-4 text-xs text-text/50">
            Ensuite, connecte un webhook pour lier la guilde.
          </p>
          {isWebhookReady ? (
            <Link
              href={discordOauthUrl}
              className="mt-2 inline-flex items-center text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:text-emerald-100"
            >
              Connecter un webhook
            </Link>
          ) : (
            <p className="mt-2 text-xs text-amber-200">
              Configure NEXT_PUBLIC_APP_URL pour activer le webhook.
            </p>
          )}
        </div>
        <DiscordProvisionClient
          initialStatus={{
            raid_channel_id: guildConfig?.raid_channel_id ?? null,
            polls_channel_id: guildConfig?.polls_channel_id ?? null,
            loot_channel_id: guildConfig?.loot_channel_id ?? null,
            groups_channel_id: guildConfig?.groups_channel_id ?? null,
            dps_channel_id: guildConfig?.dps_channel_id ?? null,
          }}
          hasDiscordGuild={hasDiscordGuild}
          guildName={connectedGuildName}
          refreshOnLoad={Boolean(successKey)}
          refreshOnFocus={!hasDiscordGuild}
        />
      </section>
    </div>
  );
}
