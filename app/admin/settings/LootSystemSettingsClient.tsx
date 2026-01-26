"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LootSystemValue = "fcfs" | "roll" | "council";

type LootSystemSettingsClientProps = {
  ownerId: string | null;
  initialLootSystem: LootSystemValue | null;
  hasGuildConfig: boolean;
};

const lootOptions: Array<{
  value: LootSystemValue;
  title: string;
  description: string;
}> = [
  {
    value: "fcfs",
    title: "Premier arrivé, premier servi",
    description: "Le premier qui clique reçoit l'item.",
  },
  {
    value: "roll",
    title: "Roll (Aléatoire)",
    description: "Système classique de /roll 1-99.",
  },
  {
    value: "council",
    title: "Conseil de Loot",
    description: "Liste d'attente, priorité et décision d'officier.",
  },
];

export default function LootSystemSettingsClient({
  ownerId,
  initialLootSystem,
  hasGuildConfig,
}: LootSystemSettingsClientProps) {
  const [selected, setSelected] = useState<LootSystemValue>(
    initialLootSystem ?? "council",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canEdit = Boolean(ownerId && hasGuildConfig);

  const selectionLabel = useMemo(() => {
    const option = lootOptions.find((item) => item.value === selected);
    return option?.title ?? "Conseil de Loot";
  }, [selected]);

  const handleSave = async () => {
    if (!ownerId) {
      setStatus("Utilisateur non connecté.");
      return;
    }
    if (!hasGuildConfig) {
      setStatus("Configurez d'abord votre serveur Discord.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("guild_configs")
      .update({ loot_system: selected })
      .eq("owner_id", ownerId);
    if (error) {
      setStatus(error.message || "Impossible de sauvegarder les paramètres.");
      setIsSaving(false);
      return;
    }
    setStatus(`Paramètres enregistrés : ${selectionLabel}.`);
    setIsSaving(false);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-text/50">
        Système de Distribution de Loot
      </p>
      <h2 className="mt-2 text-xl font-semibold text-text">
        Paramétrer la distribution
      </h2>
      <p className="mt-2 text-sm text-text/70">
        Choisissez la méthode utilisée pour attribuer les loots en raid.
      </p>

      {!hasGuildConfig ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Connectez d'abord votre serveur Discord pour enregistrer ce réglage.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {lootOptions.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!canEdit}
              onClick={() => setSelected(option.value)}
              className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                isSelected
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-black/30 text-text/70 hover:border-white/30"
              } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="text-sm font-semibold">{option.title}</div>
              <div className="mt-2 text-xs text-text/60">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || isSaving}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Sauvegarde..." : "Sauvegarder les paramètres"}
        </button>
        {status ? (
          <span className="text-xs text-text/60">{status}</span>
        ) : null}
      </div>
    </div>
  );
}
