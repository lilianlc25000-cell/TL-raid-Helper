"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type PollRow = {
  id: string;
  question: string;
  ends_at: string;
  is_archived: boolean;
};

export default function ActivePoll() {
  const [poll, setPoll] = useState<PollRow | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadPoll = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    const nowIso = new Date().toISOString();
    const { data: activePolls } = await supabase
      .from("polls")
      .select("id,question,ends_at,is_archived")
      .eq("is_archived", false)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: true })
      .limit(10);

    const pollRow = activePolls?.[0] ?? null;
    setActiveCount(activePolls?.length ?? 0);

    if (!pollRow) {
      setPoll(null);
      setIsLoading(false);
      return;
    }

    setPoll(pollRow);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadPoll();
  }, [loadPoll]);

  if (isLoading) {
    return (
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(139,92,246,0.25)] backdrop-blur">
        <div className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="h-5 w-32 rounded-full bg-white/10" />
        <div className="mt-4 h-4 w-48 rounded-full bg-white/10" />
        <div className="mt-3 h-4 w-36 rounded-full bg-white/10" />
      </article>
    );
  }

  if (!poll) {
    return (
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(139,92,246,0.2)] backdrop-blur">
        <div className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Sondage du Moment</h2>
          <span className="rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-violet-200">
            Off
          </span>
        </div>
        <p className="mt-4 text-sm text-text/60">
          Aucun sondage en cours pour le moment.
        </p>
      </article>
    );
  }

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(139,92,246,0.25)] backdrop-blur">
      <div className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Sondage du Moment</h2>
        <span className="rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-violet-200">
          <HelpCircle className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-sm text-text/70">
        {activeCount} sondage(s) disponible(s).
      </p>

      <div className="relative mt-5 inline-flex w-fit self-start">
        <span className="inline-flex rounded-full p-[1px] shadow-[0_0_18px_rgba(139,92,246,0.45)] animate-pulse">
          <Link
            href="/polls"
            className="inline-flex items-center rounded-full border border-violet-300/60 bg-violet-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-violet-100 transition hover:border-violet-200"
          >
            Ouvrir
          </Link>
        </span>
      </div>
    </article>
  );
}
