"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseDPSLog } from "@/lib/dps-parser";

type ParsedLogEntry = {
  rank: number;
  playerName: string;
  dps: number;
  totalDamage: number;
  duration: number;
};

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

const rankColor = (rank: number) => {
  if (rank === 1) return "bg-red-400";
  if (rank === 2) return "bg-orange-400";
  if (rank === 3) return "bg-amber-300";
  return "bg-slate-400";
};

export default function DPSImportPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? "";
  const [rawText, setRawText] = useState("");
  const [parsedLogs, setParsedLogs] = useState<ParsedLogEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const parseContent = useCallback((content: string) => {
    const parsed = parseDPSLog(content);
    setParsedLogs(parsed);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      setRawText(text);
      parseContent(text);
    },
    [parseContent],
  );

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

  const handleSave = async () => {
    if (!eventId) {
      setError("Événement introuvable.");
      return;
    }
    if (parsedLogs.length === 0) {
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

    const names = parsedLogs.map((entry) => entry.playerName);
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

    const rows = parsedLogs
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

    const missingCount = parsedLogs.length - rows.length;
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

  const previewRows = useMemo(() => parsedLogs, [parsedLogs]);

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            DPS Logs
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Importer un CombatLog
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Glissez un fichier ou collez le contenu brut pour prévisualiser les
            scores.
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

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-white/10 bg-surface/60"
              }`}
            >
              <p className="text-lg text-text">📄 Glissez votre fichier CombatLog.txt ici</p>
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

            <details className="rounded-3xl border border-white/10 bg-surface/60 px-6 py-4">
              <summary className="cursor-pointer text-sm uppercase tracking-[0.25em] text-text/70">
                Coller le contenu brut
              </summary>
              <textarea
                value={rawText}
                onChange={(event) => {
                  const value = event.target.value;
                  setRawText(value);
                  parseContent(value);
                }}
                rows={8}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
                placeholder="Collez le contenu du CombatLog.txt ici..."
              />
            </details>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-text/60">
                Prévisualisation
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || parsedLogs.length === 0}
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
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm text-text/80">
                  <thead className="bg-black/40 text-xs uppercase tracking-[0.2em] text-text/50">
                    <tr>
                      <th className="px-4 py-3">Rang</th>
                      <th className="px-4 py-3">Joueur</th>
                      <th className="px-4 py-3">DPS</th>
                      <th className="px-4 py-3">Dégâts totaux</th>
                      <th className="px-4 py-3">Temps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((entry) => (
                      <tr
                        key={`${entry.playerName}-${entry.rank}`}
                        className="border-t border-white/10"
                      >
                        <td className="px-4 py-3 font-semibold text-text">
                          {entry.rank}
                        </td>
                        <td className="px-4 py-3">{entry.playerName}</td>
                        <td className="px-4 py-3 font-semibold text-text">
                          <span
                            className={`mr-2 inline-flex h-2 w-2 rounded-full ${rankColor(
                              entry.rank,
                            )}`}
                          />
                          {entry.dps}
                        </td>
                        <td className="px-4 py-3">{formatNumber(entry.totalDamage)}</td>
                        <td className="px-4 py-3">{entry.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
