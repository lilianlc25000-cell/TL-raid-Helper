"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type PollRow = {
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

const formatRemaining = (endsAt: string) => {
  const end = new Date(endsAt).getTime();
  const diff = Math.max(0, end - Date.now());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

export default function PollsPage() {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [optionsByPoll, setOptionsByPoll] = useState<Record<string, PollOptionRow[]>>(
    {},
  );
  const [selectedByPoll, setSelectedByPoll] = useState<Record<string, string>>({});
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const currentUserId = auth.user?.id ?? null;
    setUserId(currentUserId);

    const nowIso = new Date().toISOString();
    const { data: pollRows, error: pollError } = (await supabase
      .from("polls")
      .select("id,question,ends_at,is_archived")
      .eq("is_archived", false)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: true })) as {
      data: PollRow[] | null;
      error: { message?: string } | null;
    };
    if (pollError) {
      setActionError(pollError.message || "Impossible de charger les sondages.");
      setIsLoading(false);
      return;
    }

    const list = pollRows ?? [];
    setPolls(list);

    if (list.length === 0) {
      setOptionsByPoll({});
      setVotedPolls(new Set());
      setIsLoading(false);
      return;
    }

    const pollIds = list.map((poll) => poll.id);
    const { data: optionRows } = (await supabase
      .from("poll_options")
      .select("id,label,poll_id,poll_votes(count)")
      .in("poll_id", pollIds)) as {
      data: PollOptionRow[] | null;
    };

    const grouped: Record<string, PollOptionRow[]> = {};
    (optionRows ?? []).forEach((row) => {
      grouped[row.poll_id] = [...(grouped[row.poll_id] ?? []), row];
    });
    setOptionsByPoll(grouped);

    if (currentUserId) {
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("poll_id")
        .eq("user_id", currentUserId)
        .in("poll_id", pollIds);
      const voted = new Set((votes ?? []).map((vote) => vote.poll_id));
      setVotedPolls(voted);
    } else {
      setVotedPolls(new Set());
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  const handleVote = async (pollId: string) => {
    const optionId = selectedByPoll[pollId];
    if (!optionId || !userId) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setActionError(null);
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
    });
    if (error) {
      setActionError(error.message || "Impossible de voter.");
      return;
    }
    await loadPolls();
  };

  const renderPoll = useCallback(
    (poll: PollRow) => {
      const options = optionsByPoll[poll.id] ?? [];
      const totalVotes = options.reduce(
        (sum, option) => sum + (option.poll_votes?.[0]?.count ?? 0),
        0,
      );
      const hasVoted = votedPolls.has(poll.id);
      return (
        <div
          key={poll.id}
          className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(139,92,246,0.25)] backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">{poll.question}</h2>
            <span className="rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-violet-200">
              {`Se termine dans ${formatRemaining(poll.ends_at)}`}
            </span>
          </div>

          {hasVoted ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">
                Merci d&apos;avoir voté !
              </p>
              {options.map((option) => {
                const votes = option.poll_votes?.[0]?.count ?? 0;
                const percent = totalVotes > 0 ? votes / totalVotes : 0;
                return (
                  <div key={option.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-text/70">
                      <span>{option.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-text/50">
                        {Math.round(percent * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/40">
                      <div
                        className="h-2 rounded-full bg-violet-400"
                        style={{ width: `${Math.max(percent * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setSelectedByPoll((prev) => ({
                        ...prev,
                        [poll.id]: option.id,
                      }))
                    }
                    className={[
                      "w-full rounded-2xl border px-4 py-2 text-left text-sm transition",
                      selectedByPoll[poll.id] === option.id
                        ? "border-violet-300/70 bg-violet-400/10 text-violet-100"
                        : "border-white/10 bg-black/40 text-text/70 hover:text-text",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleVote(poll.id)}
                disabled={!selectedByPoll[poll.id]}
                className="mt-4 w-full rounded-2xl border border-violet-300/70 bg-violet-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-violet-100 transition hover:border-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Valider mon vote
              </button>
            </>
          )}
        </div>
      );
    },
    [optionsByPoll, votedPolls, selectedByPoll, handleVote],
  );

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
          Chargement des sondages...
        </div>
      );
    }
    if (polls.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
          Aucun sondage en cours.
        </div>
      );
    }
    return <div className="space-y-4">{polls.map(renderPoll)}</div>;
  }, [isLoading, polls, renderPoll]);

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.35em] text-text/60">
            Sondages
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Sondages en cours
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Votez pour les prochaines décisions de guilde.
          </p>
          {actionError ? (
            <p className="mt-3 text-sm text-red-300">{actionError}</p>
          ) : null}
        </header>

        {content}
      </section>
    </div>
  );
}
