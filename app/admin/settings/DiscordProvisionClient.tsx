"use client";

import { useState } from "react";

type ProvisionStatus = {
  raid_channel_id: string | null;
  polls_channel_id: string | null;
  loot_channel_id: string | null;
  groups_channel_id: string | null;
  dps_channel_id: string | null;
  statics_pvp_channel_id: string | null;
  statics_pve_channel_id: string | null;
};

type Props = {
  initialStatus: ProvisionStatus;
  canProvision: boolean;
  guildName?: string | null;
};

const channelLabels: Array<{ key: keyof ProvisionStatus; label: string }> = [
  { key: "raid_channel_id", label: "raid-helper" },
  { key: "polls_channel_id", label: "sondages" },
  { key: "loot_channel_id", label: "loot" },
  { key: "groups_channel_id", label: "groupes" },
  { key: "dps_channel_id", label: "dps-meter" },
  { key: "statics_pvp_channel_id", label: "statics-pvp" },
  { key: "statics_pve_channel_id", label: "statics-pve" },
];

export default function DiscordProvisionClient({
  initialStatus,
  canProvision,
  guildName,
}: Props) {
  const [status, setStatus] = useState<ProvisionStatus>(initialStatus);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const missing = channelLabels.filter((entry) => !status[entry.key]);

  const handleProvision = async () => {
    if (!canProvision) {
      setError("Le bot doit être relié à un serveur Discord.");
      return;
    }
    setIsProvisioning(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/discord/provision", { method: "POST" });
    const raw = await response.text().catch(() => "");
    const payload =
      raw && raw.trim().startsWith("{")
        ? (JSON.parse(raw) as {
            createdChannels?: Record<string, string>;
            error?: string;
            guildName?: string | null;
          })
        : null;

    if (!response.ok) {
      setError(
        `Impossible de créer les salons Discord. ${
          payload?.error ?? `status_${response.status}`
        }`,
      );
      setIsProvisioning(false);
      return;
    }

    setStatus((prev) => ({
      ...prev,
      ...(payload?.createdChannels
        ? {
            raid_channel_id:
              payload.createdChannels.raid ?? prev.raid_channel_id,
            polls_channel_id:
              payload.createdChannels.polls ?? prev.polls_channel_id,
            loot_channel_id:
              payload.createdChannels.loot ?? prev.loot_channel_id,
            groups_channel_id:
              payload.createdChannels.groups ?? prev.groups_channel_id,
            dps_channel_id:
              payload.createdChannels.dps ?? prev.dps_channel_id,
            statics_pvp_channel_id:
              payload.createdChannels.statics_pvp ??
              prev.statics_pvp_channel_id,
            statics_pve_channel_id:
              payload.createdChannels.statics_pve ??
              prev.statics_pve_channel_id,
          }
        : {}),
    }));
    setSuccess(
      `Salons Discord créés${guildName ? ` pour ${guildName}` : ""}.`,
    );
    setIsProvisioning(false);
  };

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

      {missing.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200">
          Salons prêts
        </p>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-text/70">
          Salons manquants : {missing.map((entry) => entry.label).join(", ")}
        </div>
      )}

      {success ? (
        <p className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {canProvision ? (
        <button
          type="button"
          onClick={handleProvision}
          disabled={isProvisioning}
          className="mt-5 inline-flex items-center rounded-full border border-violet-400/60 bg-violet-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-violet-200 transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProvisioning ? "Création..." : "Créer les salons Discord"}
        </button>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
          Le bot doit être connecté à un serveur Discord.
        </div>
      )}
    </div>
  );
}
