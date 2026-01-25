import { createSupabaseServerClient } from "@/lib/supabase/server";
import DiscordProvisionButton from "@/app/admin/settings/DiscordProvisionButton";
import DiscordNotifyTestButton from "@/app/admin/settings/DiscordNotifyTestButton";

export const dynamic = "force-dynamic";

const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const ownerId = authData.user?.id ?? null;

  const { data: guildConfig } = ownerId
    ? await supabase
        .from("guild_configs")
        .select("discord_guild_id,discord_guild_name,raid_channel_id")
        .eq("owner_id", ownerId)
        .maybeSingle()
    : { data: null };

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

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Intégration Discord
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text">
            Connecter votre serveur
          </h2>
          <p className="mt-2 text-sm text-text/70">
            Autorise le bot à rejoindre votre Discord pour créer les salons.
          </p>

          {oauthUrl ? (
            <a
              href={oauthUrl}
              className="mt-5 inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
            >
              Connecter mon Serveur
            </a>
          ) : (
            <p className="mt-5 text-xs text-amber-200">
              Configure DISCORD_CLIENT_ID et NEXT_PUBLIC_APP_URL.
            </p>
          )}

          {guildConfig?.discord_guild_id ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  ✅ Connecté au serveur :{" "}
                  {guildConfig.discord_guild_name ?? "Serveur Discord"}
                </span>
                <DiscordNotifyTestButton
                  channelId={guildConfig.raid_channel_id ?? null}
                />
              </div>
              <DiscordProvisionButton guildId={guildConfig.discord_guild_id} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
