"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ChannelStatus = {
  raid_channel_id?: string | null;
  polls_channel_id?: string | null;
  loot_channel_id?: string | null;
  groups_channel_id?: string | null;
  dps_channel_id?: string | null;
};

type Props = {
  initialStatus: ChannelStatus;
};

export default function DiscordProvisionClient({ initialStatus }: Props) {
  const [status, setStatus] = useState<ChannelStatus>(initialStatus);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleProvision = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setIsProvisioning(true);
    setError(null);
    setSuccess(null);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setError("Connecte-toi avant de configurer Discord.");
      setIsProvisioning(false);
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!baseUrl) {
      setError("NEXT_PUBLIC_SUPABASE_URL manquant.");
      setIsProvisioning(false);
      return;
    }
    if (!anonKey) {
      setError("NEXT_PUBLIC_SUPABASE_ANON_KEY manquant.");
      setIsProvisioning(false);
      return;
    }

    const response = await fetch(`${baseUrl}/functions/v1/discord-provision`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    const rawText = await response.text().catch(() => "");
    const payload = rawText
      ? (JSON.parse(rawText) as {
          created?: Record<string, string>;
          error?: string;
          detail?: string;
        })
      : null;

    if (!response.ok) {
      const payloadError = payload?.error ?? `status_${response.status}`;
      const payloadDetail =
        payload?.detail ?? (rawText ? rawText.slice(0, 200) : null);
      setError(
        `Impossible de créer les salons Discord. ${payloadError}${
          payloadDetail ? ` (${payloadDetail})` : ""
        }`,
      );
      setIsProvisioning(false);
      return;
    }

    if (payload?.created) {
      setStatus((prev) => ({
        ...prev,
        raid_channel_id: payload.created.raid ?? prev.raid_channel_id,
        polls_channel_id: payload.created.polls ?? prev.polls_channel_id,
        loot_channel_id: payload.created.loot ?? prev.loot_channel_id,
        groups_channel_id: payload.created.groups ?? prev.groups_channel_id,
        dps_channel_id: payload.created.dps ?? prev.dps_channel_id,
      }));
    }

    setSuccess("Salons Discord créés.");
    setIsProvisioning(false);
  };

  const hasChannels =
    Boolean(status.raid_channel_id) &&
    Boolean(status.polls_channel_id) &&
    Boolean(status.loot_channel_id) &&
    Boolean(status.groups_channel_id) &&
    Boolean(status.dps_channel_id);

  return (
    <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-text/50">
        Salons Discord
      </p>
      <h2 className="mt-2 text-xl font-semibold text-text">
        Création automatique
      </h2>
      <p className="mt-2 text-sm text-text/70">
        Le bot crée les salons par défaut et installe les webhooks.
      </p>
      {success ? (
        <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-text/50">
        <span>
          {hasChannels ? "Salons configurés" : "Salons manquants"}
        </span>
      </div>
      <button
        type="button"
        onClick={handleProvision}
        disabled={isProvisioning}
        className="mt-4 inline-flex items-center rounded-full border border-violet-400/60 bg-violet-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-violet-200 transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProvisioning ? "Création..." : "Créer les salons Discord"}
      </button>
    </div>
  );
}
