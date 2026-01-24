import Link from "next/link";

export const dynamic = "force-dynamic";

const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function AdminSettingsPage() {
  const appUrl = appUrlFromEnv.trim().replace(/\/+$/, "");
  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const discordOauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=incoming.webhook`;
  const isDiscordReady = Boolean(discordClientId && appUrl);

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
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Discord
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text">
            Connecter un webhook
          </h2>
          <p className="mt-2 text-sm text-text/70">
            Le scope incoming.webhook permet de choisir un salon et générer
            l&apos;URL automatiquement.
          </p>
          {isDiscordReady ? (
            <Link
              href={discordOauthUrl}
              className="mt-5 inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
            >
              Connecter Discord
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              Configure DISCORD_CLIENT_ID et NEXT_PUBLIC_APP_URL pour activer la
              connexion Discord.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
