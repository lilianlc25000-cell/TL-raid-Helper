"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { notifyDiscordViaFunction } from "../../../lib/discord";

type PollEntry = {
  id: string;
  question: string;
  ends_at: string;
  is_archived: boolean;
};

type PollOptionRow = {
  id: string;
  poll_id: string;
  label: string;
  poll_votes?: { count: number }[];
};

const durationOptions = [
  { label: "1h", hours: 1 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "3 jours", hours: 72 },
  { label: "1 semaine", hours: 168 },
];

const formatPercent = (value: number) =>
  `${Math.round(value * 100)}%`.replace(/\s+/g, "");

export default function AdminPollsPage() {
  const [activeTab, setActiveTab] = useState<"create" | "results">("create");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [selectedDuration, setSelectedDuration] = useState(24);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [optionsByPoll, setOptionsByPoll] = useState<Record<string, PollOptionRow[]>>(
    {},
  );
  const [loadingResults, setLoadingResults] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const loadAccess = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setCanManage(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setCanManage(false);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role_rank")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null } | null;
    };
    const rank = profile?.role_rank ?? "soldat";
    setCanManage(rank === "admin" || rank === "conseiller");
  }, []);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const loadResults = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setLoadingResults(false);
      return;
    }
    setLoadingResults(true);
    setError(null);
    const { data: pollRows, error: pollError } = (await supabase
      .from("polls")
      .select("id,question,ends_at,is_archived")
      .order("ends_at", { ascending: false })) as {
      data: PollEntry[] | null;
      error: { message?: string } | null;
    };
    if (pollError) {
      setError(pollError.message || "Impossible de charger les sondages.");
      setLoadingResults(false);
      return;
    }
    const now = Date.now();
    const finished = (pollRows ?? []).filter((poll) => {
      const ended = new Date(poll.ends_at).getTime() <= now;
      return poll.is_archived || ended;
    });
    setPolls(finished);
    if (finished.length === 0) {
      setOptionsByPoll({});
      setLoadingResults(false);
      return;
    }
    const pollIds = finished.map((poll) => poll.id);
    const { data: optionRows, error: optionError } = (await supabase
      .from("poll_options")
      .select("id,label,poll_id,poll_votes(count)")
      .in("poll_id", pollIds)) as {
      data: PollOptionRow[] | null;
      error: { message?: string } | null;
    };
    if (optionError) {
      setError(optionError.message || "Impossible de charger les résultats.");
      setLoadingResults(false);
      return;
    }
    const grouped: Record<string, PollOptionRow[]> = {};
    (optionRows ?? []).forEach((row) => {
      grouped[row.poll_id] = [...(grouped[row.poll_id] ?? []), row];
    });
    setOptionsByPoll(grouped);
    setLoadingResults(false);
  }, []);

  useEffect(() => {
    if (activeTab === "results") {
      void loadResults();
    }
  }, [activeTab, loadResults]);

  const addOption = () => {
    setOptions((prev) => [...prev, ""]);
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (!trimmedQuestion) {
      setError("Ajoute une question.");
      return;
    }
    if (trimmedOptions.length < 2) {
      setError("Ajoute au moins deux options.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setError("Connecte-toi pour créer un sondage.");
      return;
    }
    const endsAt = new Date(Date.now() + selectedDuration * 3600 * 1000).toISOString();
    setIsSaving(true);
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        question: trimmedQuestion,
        created_by: userId,
        ends_at: endsAt,
        is_archived: false,
      })
      .select("id")
      .single();
    if (pollError || !poll) {
      setError(pollError?.message || "Impossible de créer le sondage.");
      setIsSaving(false);
      return;
    }
    const { error: optionsError } = await supabase.from("poll_options").insert(
      trimmedOptions.map((label) => ({
        poll_id: poll.id,
        label,
      })),
    );
    if (optionsError) {
      setError(optionsError.message || "Impossible d'ajouter les options.");
      setIsSaving(false);
      return;
    }
    setQuestion("");
    setOptions(["", ""]);
    setSuccess("Sondage lancé !");
    setIsSaving(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      await notifyDiscordViaFunction(accessToken, {
        type: "polls",
        content: `🗳️ Nouveau sondage: ${trimmedQuestion}`,
      });
    }

  };

  const resultsContent = useMemo(() => {
    if (polls.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
          Aucun sondage terminé pour le moment.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {polls.map((poll) => {
          const optionsForPoll = optionsByPoll[poll.id] ?? [];
          const votesByOption = optionsForPoll.map((option) => ({
            id: option.id,
            label: option.label,
            votes: option.poll_votes?.[0]?.count ?? 0,
          }));
          const totalVotes = votesByOption.reduce((sum, opt) => sum + opt.votes, 0);
          const winner = votesByOption.reduce(
            (current, opt) => (opt.votes > current.votes ? opt : current),
            votesByOption[0] ?? { id: "", label: "—", votes: 0 },
          );
          return (
            <div
              key={poll.id}
              className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-5 shadow-[0_0_20px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                    Sondage
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-text">
                    {poll.question}
                  </h3>
                </div>
                <div className="text-xs uppercase tracking-[0.25em] text-text/50">
                  {totalVotes} votes
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {votesByOption.map((option) => {
                  const percent = totalVotes > 0 ? option.votes / totalVotes : 0;
                  const isWinner = option.id === winner.id && totalVotes > 0;
                  return (
                    <div key={option.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-text/80">
                        <span className={isWinner ? "text-emerald-200" : ""}>
                          {option.label}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-text/50">
                          {formatPercent(percent)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-black/40">
                        <div
                          className={`h-2 rounded-full ${
                            isWinner ? "bg-emerald-400" : "bg-sky-400"
                          }`}
                          style={{ width: `${Math.max(percent * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-xs uppercase tracking-[0.25em] text-emerald-200">
                Gagnant : {winner.label}
              </p>
            </div>
          );
        })}
      </div>
    );
  }, [polls, optionsByPoll]);

  if (!canManage) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          Accès réservé aux officiers.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.35em] text-text/60">
            Sondages
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Gestion des sondages
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Créez des votes et consultez les résultats archivés.
          </p>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {success ? (
            <p className="mt-3 text-sm text-emerald-200">{success}</p>
          ) : null}
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
              activeTab === "create"
                ? "border-amber-300/70 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-black/40 text-text/70 hover:text-text"
            }`}
          >
            Créer un sondage
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
              activeTab === "results"
                ? "border-sky-300/70 bg-sky-400/10 text-sky-200"
                : "border-white/10 bg-black/40 text-text/70 hover:text-text"
            }`}
          >
            Archives & Résultats
          </button>
        </div>

        {activeTab === "create" ? (
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur">
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.25em] text-text/60">
                  Question
                </label>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ex: Quel jour pour le raid ?"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-[0.25em] text-text/60">
                    Options
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {options.map((option, index) => (
                    <input
                      key={`opt-${index}`}
                      value={option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.25em] text-text/60">
                  Durée
                </label>
                <select
                  value={selectedDuration}
                  onChange={(event) => setSelectedDuration(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
                >
                  {durationOptions.map((option) => (
                    <option key={option.label} value={option.hours}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Lancement..." : "Lancer le vote"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur">
            {loadingResults ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
                Chargement des résultats...
              </div>
            ) : (
              resultsContent
            )}
          </div>
        )}
      </section>
    </div>
  );
}
