"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChannelConfig = {
  event: boolean;
  group: boolean;
  loot: boolean;
  wishlist: boolean;
  dps_meter: boolean;
  polls: boolean;
  activity_points: boolean;
};

type DiscordChannelManagerProps = {
  ownerId: string | null;
  guildId: string | null;
  initialConfig: Record<string, boolean> | null;
};

const DEFAULT_CONFIG: ChannelConfig = {
  event: false,
  group: false,
  loot: false,
  wishlist: false,
  dps_meter: false,
  polls: false,
  activity_points: false,
};

const CHANNEL_OPTIONS: Array<{
  key: keyof ChannelConfig;
  label: string;
  description: string;
}> = [
  {
    key: "event",
    label: "Event",
    description: "Categorie Event avec salons: lundi -> dimanche.",
  },
  { key: "group", label: "Groupe", description: "Salon pour les groupes." },
  { key: "loot", label: "Loot", description: "Salon pour les loots." },
  {
    key: "wishlist",
    label: "WishList",
    description: "Salon pour les demandes de wishlist.",
  },
  {
    key: "dps_meter",
    label: "DPS meter",
    description: "Salon pour les releves de DPS.",
  },
  {
    key: "polls",
    label: "Sondage",
    description: "Salon pour les votes de guilde.",
  },
  {
    key: "activity_points",
    label: "Points d'activites",
    description: "Salon pour envoyer les captures de points d'activite.",
  },
];

const getInitialConfig = (
  initialConfig: Record<string, boolean> | null,
): ChannelConfig => ({
  ...DEFAULT_CONFIG,
  ...initialConfig,
});

export default function DiscordChannelManager({
  ownerId,
  guildId,
  initialConfig,
}: DiscordChannelManagerProps) {
  const [config, setConfig] = useState<ChannelConfig>(
    getInitialConfig(initialConfig),
  );
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  const hasConnection = Boolean(ownerId && guildId);
  const hasChanges = useMemo(() => {
    const base = getInitialConfig(initialConfig);
    return Object.keys(base).some(
      (key) =>
        base[key as keyof ChannelConfig] !==
        config[key as keyof ChannelConfig],
    );
  }, [config, initialConfig]);

  const handleToggle = (key: keyof ChannelConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!ownerId || !guildId) {
      setStatus("error");
      setMessage("Connectez d'abord un serveur Discord.");
      return;
    }
    const hasAnyChannel = Object.values(config).some(Boolean);
    setStatus("saving");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("guild_configs")
      .update({ discord_channel_config: config })
      .eq("owner_id", ownerId);
    if (error) {
      setStatus("error");
      setMessage(error.message || "Impossible de sauvegarder la config.");
      return;
    }
    if (!hasAnyChannel) {
      setStatus("success");
      setMessage("Aucun salon selectionne.");
      return;
    }
    const { error: provisionError } = await supabase.functions.invoke(
      "discord-provision",
      {
        body: { guild_id: guildId, channel_config: config },
      },
    );
    if (provisionError) {
      setStatus("error");
      setMessage(
        provisionError.message ||
          "Sauvegarde ok, mais creation des salons impossible.",
      );
      return;
    }
    setStatus("success");
    setMessage("Salons Discord mis a jour.");
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-text/50">
        Ajouter des salons
      </p>
      <p className="mt-2 text-sm text-text/70">
        Choisissez les salons a creer ou retirer sur votre serveur Discord.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHANNEL_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => handleToggle(option.key)}
            disabled={!hasConnection}
            className={[
              "rounded-xl border px-4 py-3 text-left text-sm transition",
              config[option.key]
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-black/40 text-text/70 hover:border-white/20",
              !hasConnection ? "cursor-not-allowed opacity-50" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">{option.label}</span>
              <span className="text-xs uppercase tracking-[0.2em]">
                {config[option.key] ? "Active" : "Desactive"}
              </span>
            </div>
            <p className="mt-1 text-xs text-text/60">{option.description}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text/60">
          {status === "saving" ? "Mise a jour en cours..." : message}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasConnection || status === "saving" || !hasChanges}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
