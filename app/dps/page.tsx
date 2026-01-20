"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseDPSLog } from "@/lib/dps-parser";

type ParsedLogEntry = {
  rank: number;
  playerName: string;
  dps: number;
  totalDamage: number;
  duration: number;
};

type EventEntry = {
  id: string;
  title: string;
  start_time: string;
};

const TARGET_TABS = [
  "Mannequin",
  "Dragaryles",
  "Vulkan",
  "Zairos",
  "Calanthia",
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
    .replace(/[\u0300-\u036f]/g, "");

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
    TARGET_TABS.map((tab) => [tab, normalizeText(tab)]),
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
    for (const [tab, token] of tokens.entries()) {
      if (normalizedTarget.includes(token)) {
        return tab;
      }
    }
  }
  return null;
};

export default function DPSMeterPage() {
  const router = useRouter();
  const [logsByTarget, setLogsByTarget] = useState(emptyLogsByTarget);
  const [activeTarget, setActiveTarget] = useState<TargetTab>(TARGET_TABS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const parseContent = useCallback((content: string) => {
    const parsed = parseDPSLog(content);
    const detectedTarget = detectTargetFromLog(content);
    const target = detectedTarget ?? activeTarget;
    setLogsByTarget((prev) => ({ ...prev, [target]: parsed }));
    if (detectedTarget) {
      setActiveTarget(detectedTarget);
    }
  }, [activeTarget]);

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      parseContent(text);
    },
    [parseContent],
  );

  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoadingEvents(false);
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
      const { data: eventRows, error: eventError } = (await supabase
        .from("events")
        .select("id,title,start_time")
        .eq("guild_id", guildId)
        .order("start_time", { ascending: false })) as {
        data: EventEntry[] | null;
        error: { message?: string } | null;
      };
      if (!isMounted) {
        return;
      }
      if (eventError) {
        setError(eventError.message || "Impossible de charger les événements.");
        setIsLoadingEvents(false);
        return;
      }
      setEvents(eventRows ?? []);
      setIsLoadingEvents(false);
    };
    void loadEvents();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        await handleFile(file);
      }
    },
    [handleFile],
  );

  const targetEventId = useMemo(() => {
    if (events.length === 0) {
      return "";
    }
    const token = normalizeText(activeTarget);
    const match = events.find((event) =>
      normalizeText(event.title).includes(token),
    );
    return match?.id ?? events[0].id;
  }, [events, activeTarget]);

  const targetEventLabel = useMemo(() => {
    if (!targetEventId) {
      return "—";
    }
    return events.find((event) => event.id === targetEventId)?.title ?? "—";
  }, [events, targetEventId]);

  const handleSave = async () => {
    const activeLogs = logsByTarget[activeTarget] ?? [];
    if (activeLogs.length === 0) {
      setError("Aucun log parsé.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    let eventId = targetEventId;
    if (!eventId) {
      if (!guildId) {
        setError("Aucun raid disponible pour enregistrer.");
        setIsSaving(false);
        return;
      }
      const { data: createdEvent, error: createError } = await supabase
        .from("events")
        .insert({
          title: `${activeTarget} DPS`,
          event_type: "DPS",
          difficulty: null,
          start_time: new Date().toISOString(),
          description: "Import DPS automatique",
          cohesion_reward: 0,
          status: "planned",
          is_points_distributed: false,
          are_groups_published: false,
          guild_id: guildId,
        })
        .select("id,title,start_time")
        .single();
      if (createError || !createdEvent) {
        setError("Impossible de créer le raid pour l'import.");
        setIsSaving(false);
        return;
      }
      eventId = createdEvent.id;
      setEvents((prev) => [createdEvent as EventEntry, ...prev]);
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
          event_id: eventId,
          user_id: userId,
          class_played: null,
          dps: entry.dps,
          total_damage: entry.totalDamage,
          duration_seconds: entry.duration,
        };
      })
      .filter(Boolean) as Array<{
      event_id: string;
      user_id: string;
      class_played: string | null;
      dps: number;
      total_damage: number;
      duration_seconds: number;
    }>;

    const missingCount = activeLogs.length - rows.length;
    if (rows.length > 0) {
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

    if (missingCount > 0) {
      setWarning(
        `${missingCount} joueur(s) introuvable(s) : scores ignorés.`,
      );
    }
    setSuccess(`${rows.length} scores importés !`);
    setIsSaving(false);
  };

  const previewRows = useMemo(
    () => logsByTarget[activeTarget] ?? [],
    [logsByTarget, activeTarget],
  );

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
          {isLoadingEvents || events.length === 0 ? (
            <p className="mt-3 text-xs text-text/50">
              {isLoadingEvents
                ? "Chargement des raids..."
                : "Aucun raid disponible."}
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition ${
                isDragging
                  ? "border-sky-400 bg-sky-400/10"
                  : "border-white/10 bg-surface/60"
              }`}
            >
              <p className="text-lg text-text">
                📄 Glissez votre fichier CombatLog.txt ici
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-text/50">
                ou cliquez pour sélectionner
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text">
                Choisir un fichier
                <input
                  type="file"
                  accept=".txt,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFile(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-text/60">
                Classement de guilde
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || previewRows.length === 0}
                className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Enregistrement..." : "💾 Enregistrer les résultats"}
              </button>
            </div>

            {previewRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
                Aucun log détecté pour le moment.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
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
