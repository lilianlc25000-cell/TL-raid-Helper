"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseDPSLog } from "@/lib/dps-parser";

type ParsedLogEntry = {
  rank: number;
  playerName: string;
  dps: number;
  totalDamage: number;
  duration: number;
};

const TARGET_TABS = [
  "Mannequin",
  "Dragaryles",
  "Vulkan",
  "Zairos",
  "Calanthia",
  "Umbrakan",
  "Verence",
  "Martha",
  "Tête de lion",
] as const;

type TargetTab = (typeof TARGET_TABS)[number];

const emptyLogsByTarget = TARGET_TABS.reduce(
  (acc, target) => ({ ...acc, [target]: [] }),
  {} as Record<TargetTab, ParsedLogEntry[]>,
);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const TARGET_ALIASES: Record<TargetTab, string[]> = {
  Mannequin: [
    "mannequin",
    "mannequin d'entrainement",
    "mannequin d'entraînement",
    "dummy",
    "training dummy",
    "entrainement",
    "entraînement",
  ],
  Dragaryles: ["dragaryles"],
  Vulkan: ["vulkan"],
  Zairos: ["zairos"],
  Calanthia: ["calanthia"],
  Umbrakan: ["umbrakan"],
  Verence: ["verence"],
  Martha: ["martha"],
  "Tête de lion": ["tete de lion", "tête de lion"],
};

const getTargetTokens = (target: TargetTab) =>
  TARGET_ALIASES[target].map((token) => normalizeText(token));

const formatNumber = (value: number) => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toString();
};

const formatDps = (value: number) => {
  if (value < 1000) {
    return value.toString();
  }
  const thousands = Math.floor(value / 1000);
  const remainder = Math.floor((value % 1000) / 10);
  return remainder > 0 ? `${thousands}k${remainder}` : `${thousands}k`;
};

const rankColor = (rank: number) => {
  if (rank === 1) return "bg-red-400";
  if (rank === 2) return "bg-orange-400";
  if (rank === 3) return "bg-amber-300";
  return "bg-slate-400";
};

const trophyColor = (rank: number) => {
  if (rank === 1) return "text-amber-300";
  if (rank === 2) return "text-slate-200";
  if (rank === 3) return "text-orange-300";
  return null;
};

const detectTargetFromLog = (content: string): TargetTab | null => {
  const tokens = new Map(
    TARGET_TABS.map((tab) => [tab, getTargetTokens(tab)]),
  );
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("CombatLogVersion")) {
      continue;
    }
    const parts = line.split(",");
    if (parts.length < 10) {
      continue;
    }
    const eventType = parts[1]?.trim();
    if (eventType !== "DamageDone") {
      continue;
    }
    const targetName = parts[9]?.trim();
    if (!targetName) {
      continue;
    }
    const normalizedTarget = normalizeText(targetName);
    for (const [tab, tokenList] of tokens.entries()) {
      if (tokenList.some((token) => normalizedTarget.includes(token))) {
        return tab;
      }
    }
  }
  return null;
};

export default function DPSMeterPage() {
  const router = useRouter();
  const [savedLogsByTarget, setSavedLogsByTarget] =
    useState(emptyLogsByTarget);
  const [pendingLogsByTarget, setPendingLogsByTarget] =
    useState(emptyLogsByTarget);
  const [activeTarget, setActiveTarget] = useState<TargetTab>(TARGET_TABS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [isLoadingGuild, setIsLoadingGuild] = useState(true);

  const parseContent = useCallback((content: string) => {
    const parsed = parseDPSLog(content);
    const detectedTarget = detectTargetFromLog(content);
    const target = detectedTarget ?? activeTarget;
    setPendingLogsByTarget((prev) => ({ ...prev, [target]: parsed }));
    if (detectedTarget) {
      setActiveTarget(detectedTarget);
    }
  }, [activeTarget]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const text = await file.text();
        parseContent(text);
      }
    },
    [parseContent],
  );

  useEffect(() => {
    let isMounted = true;
    const loadGuild = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoadingGuild(false);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        router.replace("/login");
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id")
        .eq("user_id", userId)
        .maybeSingle()) as {
        data: { guild_id?: string | null } | null;
      };
      const guildId = profile?.guild_id ?? null;
      if (!guildId) {
        router.replace("/guild/join");
        return;
      }
      if (isMounted) {
        setGuildId(guildId);
      }
      setIsLoadingGuild(false);
    };
    void loadGuild();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) {
        await handleFiles(files);
      }
    },
    [handleFiles],
  );

  const handleSave = async () => {
    const targetsToSave = TARGET_TABS.filter(
      (target) => (pendingLogsByTarget[target] ?? []).length > 0,
    );
    if (targetsToSave.length === 0) {
      setError("Aucun log parsé.");
      return;
    }
    if (!guildId) {
      setError("Aucune guilde active.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    let totalSaved = 0;
    let totalMissing = 0;

    for (const target of targetsToSave) {
      const activeLogs = pendingLogsByTarget[target] ?? [];
      if (activeLogs.length === 0) {
        continue;
      }
      const names = activeLogs.map((entry) => entry.playerName);
      const { data: profiles, error: profileError } = (await supabase
        .from("profiles")
        .select("user_id,ingame_name")
        .in("ingame_name", names)) as {
        data:
          | Array<{
              user_id: string;
              ingame_name: string;
            }>
          | null;
        error: { message?: string } | null;
      };

      if (profileError) {
        setError(profileError.message || "Impossible de charger les profils.");
        setIsSaving(false);
        return;
      }

      const userByName = new Map(
        (profiles ?? []).map((profile) => [
          profile.ingame_name.toLowerCase(),
          profile.user_id,
        ]),
      );

      const rows = activeLogs
        .map((entry) => {
          const userId = userByName.get(entry.playerName.toLowerCase()) ?? null;
          if (!userId) {
            return null;
          }
          return {
            guild_id: guildId,
            target_category: target,
            user_id: userId,
            class_played: null,
            dps: entry.dps,
            total_damage: entry.totalDamage,
            duration_seconds: entry.duration,
          };
        })
        .filter(Boolean) as Array<{
        guild_id: string;
        target_category: string;
        user_id: string;
        class_played: string | null;
        dps: number;
        total_damage: number;
        duration_seconds: number;
      }>;

      const missingCount = activeLogs.length - rows.length;
      if (rows.length > 0) {
        const { error: deleteError } = await supabase
          .from("raid_performance")
          .delete()
          .eq("guild_id", guildId)
          .eq("target_category", target);
        if (deleteError) {
          setError(
            deleteError.message ||
              "Impossible de remplacer les anciennes performances.",
          );
          setIsSaving(false);
          return;
        }
        const { error: insertError } = await supabase
          .from("raid_performance")
          .insert(rows);
        if (insertError) {
          setError(
            insertError.message || "Impossible d'enregistrer les performances.",
          );
          setIsSaving(false);
          return;
        }
      }

      totalMissing += missingCount;
      totalSaved += rows.length;
      setSavedLogsByTarget((prev) => ({ ...prev, [target]: activeLogs }));
      setPendingLogsByTarget((prev) => ({ ...prev, [target]: [] }));
    }

    if (totalMissing > 0) {
      setWarning(
        `${totalMissing} joueur(s) introuvable(s) : scores ignorés.`,
      );
    }
    setSuccess(`${totalSaved} scores importés !`);
    setIsSaving(false);


  };

  const pendingRows = useMemo(
    () => pendingLogsByTarget[activeTarget] ?? [],
    [pendingLogsByTarget, activeTarget],
  );
  const previewRows = useMemo(
    () => (pendingRows.length > 0 ? pendingRows : savedLogsByTarget[activeTarget] ?? []),
    [pendingRows, savedLogsByTarget, activeTarget],
  );
  const pendingTotal = useMemo(
    () =>
      TARGET_TABS.reduce(
        (sum, tab) => sum + (pendingLogsByTarget[tab]?.length ?? 0),
        0,
      ),
    [pendingLogsByTarget],
  );

  useEffect(() => {
    let isMounted = true;
    const loadSavedRankings = async () => {
      if (!guildId) {
        return;
      }
      const supabase = createClient();
      if (!supabase) {
        return;
      }
      const { data, error: fetchError } = await supabase
        .from("raid_performance")
        .select(
          "dps,total_damage,duration_seconds,profiles(ingame_name),target_category",
        )
        .eq("guild_id", guildId)
        .eq("target_category", activeTarget);
      if (!isMounted || fetchError) {
        return;
      }
      const mapped = (data ?? [])
        .map((row) => {
          const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;
          return {
            playerName: profile?.ingame_name ?? "Inconnu",
            dps: row.dps,
            totalDamage: row.total_damage,
            duration: row.duration_seconds,
          };
        })
        .sort((a, b) => b.dps - a.dps)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
      setSavedLogsByTarget((prev) => ({ ...prev, [activeTarget]: mapped }));
    };
    void loadSavedRankings();
    return () => {
      isMounted = false;
    };
  }, [activeTarget, guildId]);

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Performance DPS meter
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Importer un CombatLog
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Choisis un raid puis importe ton fichier pour alimenter le classement.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-sky-200/80">
            Un DPS meter par catégorie de cible
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
          {warning ? (
            <p className="mt-2 text-sm text-amber-200">{warning}</p>
          ) : null}
          {success ? (
            <p className="mt-2 text-sm text-emerald-200">{success}</p>
          ) : null}
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/60 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-text/60">
            Cible DPS
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TARGET_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTarget(tab)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                  activeTarget === tab
                    ? "border-sky-300/70 bg-sky-400/20 text-sky-100 shadow-[0_0_15px_rgba(56,189,248,0.35)]"
                    : "border-white/10 bg-black/40 text-text/70 hover:text-text"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {isLoadingGuild ? (
            <p className="mt-3 text-xs text-text/50">
              Chargement de la guilde...
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <label
              className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition ${
                isDragging
                  ? "border-sky-400 bg-sky-400/10"
                  : "border-white/10 bg-surface/60"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <p className="text-lg text-text">
                📄 Glissez votre fichier CombatLog.txt ici
              </p>
              <input
                type="file"
                accept=".txt,.csv"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) {
                    void handleFiles(files);
                  }
                }}
              />
            </label>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-text/60">
                Classement de guilde
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || pendingTotal === 0}
                className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Enregistrement..."
                  : "💾 Enregistrer les résultats"}
              </button>
            </div>

            {previewRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
                {pendingRows.length > 0
                  ? "Prévisualisation locale en cours."
                  : "Aucun DPS sauvegardé pour cette cible."}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {pendingRows.length > 0 ? (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-amber-200">
                    Aperçu local — non publié tant que vous n&apos;enregistrez pas
                  </div>
                ) : null}
                {previewRows.map((entry) => {
                  const trophyClass = trophyColor(entry.rank);
                  return (
                    <div
                      key={`${entry.playerName}-${entry.rank}`}
                      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-surface/60 to-slate-900/70 px-5 py-5 shadow-[0_0_24px_rgba(0,0,0,0.4)]"
                    >
                      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-white/5 blur-3xl" />
                      <div className="absolute right-6 top-4 h-1.5 w-24 rounded-full bg-white/5" />
                      <div className="flex flex-wrap items-center justify-between gap-6">
                        <div>
                          <div className="text-xs uppercase tracking-[0.35em] text-text/50">
                            Joueur
                          </div>
                          <div className="flex items-center gap-3 text-xl font-semibold text-text">
                            <span>{entry.playerName}</span>
                            {trophyClass ? (
                              <Trophy className={`h-4 w-4 ${trophyClass}`} />
                            ) : (
                              <span className="text-sm text-text/50">
                                #{entry.rank}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                        <div className="sm:pt-4">
                          <div className="text-xs uppercase tracking-[0.25em] text-text/50">
                            Dégâts totaux
                          </div>
                          <div className="mt-1 text-base font-semibold text-text">
                            {formatNumber(entry.totalDamage)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs uppercase tracking-[0.35em] text-text/50">
                            DPS brut
                          </div>
                          <div className="mt-2 text-4xl font-semibold text-text">
                            {formatDps(entry.dps)}
                          </div>
                        </div>
                        <div className="text-right sm:pt-4">
                          <div className="text-xs uppercase tracking-[0.25em] text-text/50">
                            Temps
                          </div>
                          <div className="mt-1 text-base font-semibold text-text">
                            {entry.duration}s
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
