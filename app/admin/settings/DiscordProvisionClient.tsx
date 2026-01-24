"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  hasDiscordGuild: boolean;
  guildName?: string | null;
  refreshOnLoad?: boolean;
  refreshOnFocus?: boolean;
};

export default function DiscordProvisionClient({
  initialStatus,
  hasDiscordGuild,
  guildName,
  refreshOnLoad = false,
  refreshOnFocus = false,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ChannelStatus>(initialStatus);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!refreshOnLoad) {
      return;
    }
    const timeout = window.setTimeout(() => {
      router.refresh();
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [refreshOnLoad, router]);

  useEffect(() => {
    if (!refreshOnFocus) {
      return;
    }
    const handleFocus = () => {
      router.refresh();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshOnFocus, router]);

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
    if (!hasDiscordGuild) {
      setError("Pas de connexion à discord.");
      setIsProvisioning(false);
      return;
    }

    const { data: payload, error: invokeError } = await supabase.functions
      .invoke<{
        created?: Record<string, string>;
        error?: string;
        detail?: string;
      }>("discord-provision", {
        body: { access_token: accessToken },
      });

    if (invokeError) {
      const rawPayload =
        invokeError?.context?.response?.body ||
        invokeError?.context?.response?.data ||
        null;
      const rawText =
        typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);
      setError(
        `Impossible de créer les salons Discord. ${invokeError.message}${
          rawText ? ` (${rawText.slice(0, 200)})` : ""
        }`,
      );
      setIsProvisioning(false);
      return;
    }

    const payloadError = payload?.error ?? null;
    const payloadDetail = payload?.detail ?? null;
    if (payloadError) {
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
      {guildName ? (
        <p className="mt-2 text-xs text-text/50">
          Serveur connecté : {guildName}
        </p>
      ) : null}
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
