"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export const dynamic = "force-dynamic";

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type ProfileEntry = {
  user_id: string;
  ingame_name: string;
  role_rank: string | null;
};

type ThreadEntry = {
  partnerId: string;
  partnerName: string;
  roleRank: string | null;
  lastMessage: string;
  lastAt: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function MessagesListPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      if (!isMounted) {
        return;
      }
      if (!id) {
        setError("Veuillez vous connecter pour accéder à la messagerie.");
        setLoading(false);
        return;
      }
      setUserId(id);
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadThreads = async (currentUserId: string) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = (await supabase
      .from("direct_messages")
      .select("id,sender_id,recipient_id,body,created_at")
      .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false })
      .limit(200)) as {
      data: DirectMessage[] | null;
      error: { message?: string } | null;
    };
    if (fetchError) {
      setError(fetchError.message || "Impossible de charger les conversations.");
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    const threadMap = new Map<string, DirectMessage>();
    rows.forEach((message) => {
      const partnerId =
        message.sender_id === currentUserId
          ? message.recipient_id
          : message.sender_id;
      if (!threadMap.has(partnerId)) {
        threadMap.set(partnerId, message);
      }
    });
    const partnerIds = Array.from(threadMap.keys());
    if (partnerIds.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const { data: profilesData } = (await supabase
      .from("profiles")
      .select("user_id,ingame_name,role_rank")
      .in("user_id", partnerIds)) as { data: ProfileEntry[] | null };
    const profileMap = new Map(
      (profilesData ?? []).map((profile) => [profile.user_id, profile]),
    );
    const nextThreads = partnerIds.map((partnerId) => {
      const message = threadMap.get(partnerId) as DirectMessage;
      const profile = profileMap.get(partnerId);
      return {
        partnerId,
        partnerName: profile?.ingame_name ?? "Membre",
        roleRank: profile?.role_rank ?? null,
        lastMessage: message.body,
        lastAt: message.created_at,
      };
    });
    setThreads(nextThreads);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) {
      return;
    }
    void loadThreads(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const channel = supabase.channel(`threads-${userId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or=(sender_id.eq.${userId},recipient_id.eq.${userId})`,
        },
        () => {
          void loadThreads(userId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filteredThreads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return threads;
    }
    return threads.filter((thread) =>
      thread.partnerName.toLowerCase().includes(normalized),
    );
  }, [threads, query]);

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Messagerie
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Conversations privées
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Démarrez une conversation depuis l&apos;onglet Guilde.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/60 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs uppercase tracking-[0.25em] text-text/50">
              Conversations
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-text outline-none sm:w-64"
            />
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                Chargement des conversations...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
                Aucune conversation pour le moment.
                <div className="mt-2 text-xs text-text/40">
                  Va sur l&apos;onglet Guilde pour envoyer un premier message.
                </div>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <Link
                  key={thread.partnerId}
                  href={`/messages/${encodeURIComponent(
                    thread.partnerId,
                  )}?name=${encodeURIComponent(thread.partnerName)}`}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/80 transition hover:border-primary/40 hover:bg-primary/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-text">
                      {thread.partnerName}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-text/40">
                      {formatDate(thread.lastAt)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="line-clamp-1 text-sm text-text/70">
                      {thread.lastMessage}
                    </p>
                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-text/50">
                      {thread.roleRank ?? "membre"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
