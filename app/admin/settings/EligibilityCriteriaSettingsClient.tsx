"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EligibilityCriteria =
  | "loot_received"
  | "participation_points"
  | "activity_points";

type EligibilityCriteriaSettingsClientProps = {
  ownerId: string | null;
  guildId: string | null;
  initialCriteria: string[];
  initialParticipationThreshold: number;
  initialActivityThreshold: number;
  onSaved?: (criteria: EligibilityCriteria[]) => void;
};

const CRITERIA_OPTIONS: Array<{
  key: EligibilityCriteria;
  label: string;
  description: string;
}> = [
  {
    key: "loot_received",
    label: "Nombre de loots recus",
    description: "Priorite au plus petit nombre de loots.",
  },
  {
    key: "participation_points",
    label: "Points de participation",
    description: "Priorite au plus grand nombre de points.",
  },
  {
    key: "activity_points",
    label: "Points d'activite",
    description: "Priorite au plus grand nombre de points d'activite.",
  },
];

export default function EligibilityCriteriaSettingsClient({
  ownerId,
  guildId,
  initialCriteria,
  initialParticipationThreshold,
  initialActivityThreshold,
  onSaved,
}: EligibilityCriteriaSettingsClientProps) {
  const [criteria, setCriteria] = useState<EligibilityCriteria[]>(
    (initialCriteria.filter(Boolean) as EligibilityCriteria[]) ?? [],
  );
  const [participationThreshold, setParticipationThreshold] = useState<number>(
    initialParticipationThreshold ?? 1,
  );
  const [activityThreshold, setActivityThreshold] = useState<number>(
    initialActivityThreshold ?? 1,
  );
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  const hasChanges = useMemo(() => {
    const base = (initialCriteria ?? []) as EligibilityCriteria[];
    if (base.length !== criteria.length) {
      return true;
    }
    return base.some((value) => !criteria.includes(value));
  }, [criteria, initialCriteria]);

  const handleToggle = (key: EligibilityCriteria) => {
    setCriteria((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    if (!ownerId || !guildId) {
      setStatus("error");
      setMessage("Aucune guilde active.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("guild_configs")
      .update({ eligibility_criteria: criteria })
      .eq("owner_id", ownerId);
    if (error) {
      setStatus("error");
      setMessage(error.message || "Impossible de sauvegarder.");
      return;
    }
    const { error: settingsError } = await supabase
      .from("guild_settings")
      .upsert(
        {
          guild_id: guildId,
          participation_threshold: Math.max(0, participationThreshold || 0),
          activity_threshold: Math.max(0, activityThreshold || 0),
        },
        { onConflict: "guild_id" },
      );
    if (settingsError) {
      setStatus("error");
      setMessage(settingsError.message || "Impossible de sauvegarder.");
      return;
    }
    setStatus("success");
    setMessage("Criteres mis a jour.");
    onSaved?.(criteria);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-text/50">
        Eligibilite loot
      </p>
      <h2 className="mt-2 text-xl font-semibold text-text">
        Criteres de priorite
      </h2>
      <p className="mt-2 text-sm text-text/70">
        Les admins peuvent activer 1, 2 ou 3 conditions.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CRITERIA_OPTIONS.map((option) => {
          const isActive = criteria.includes(option.key);
          const isParticipation = option.key === "participation_points";
          const isActivity = option.key === "activity_points";
          return (
            <div
              key={option.key}
              className={[
                "rounded-xl border px-4 py-3 text-left text-sm transition",
                isActive
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/40 text-text/70",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => handleToggle(option.key)}
                className="flex w-full items-center justify-between"
              >
                <span className="font-semibold text-text">{option.label}</span>
                <span className="text-xs uppercase tracking-[0.2em]">
                  {isActive ? "Actif" : "Inactif"}
                </span>
              </button>
              <p className="mt-1 text-xs text-text/60">{option.description}</p>
              {(isParticipation || isActivity) && isActive ? (
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text/70">
                  <span>
                    Minimum pour etre eligible
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={
                      isParticipation ? participationThreshold : activityThreshold
                    }
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (isParticipation) {
                        setParticipationThreshold(Number.isNaN(value) ? 0 : value);
                      } else {
                        setActivityThreshold(Number.isNaN(value) ? 0 : value);
                      }
                    }}
                    className="w-24 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-right text-xs text-text"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text/60">{message}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving" || !hasChanges}
          className="rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
