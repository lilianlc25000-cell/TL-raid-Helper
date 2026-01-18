"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      if (!isMounted) {
        return;
      }
      if (!id) {
        setError("Veuillez vous connecter pour accéder à la messagerie.");
        return;
      }
      setUserId(id);
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const target = searchParams.get("user");
    const name = searchParams.get("name");
    if (!target) {
      setSelectedUserId(null);
      setSelectedName("");
      return;
    }
    setSelectedUserId(target);
    setSelectedName(name ?? "");
  }, [searchParams]);

  const loadMessages = async (targetId: string) => {
    if (!userId) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setLoadingMessages(true);
    const { data, error: fetchError } = (await supabase
      .from("direct_messages")
      .select("id,sender_id,recipient_id,body,created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${targetId}),and(sender_id.eq.${targetId},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true })) as {
      data: DirectMessage[] | null;
      error: { message?: string } | null;
    };
    if (fetchError) {
      setError(fetchError.message || "Impossible de charger les messages.");
      setLoadingMessages(false);
      return;
    }
    setMessages(data ?? []);
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }
    void loadMessages(selectedUserId);
  }, [selectedUserId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const channel = supabase.channel(`dm-${userId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or=(sender_id.eq.${userId},recipient_id.eq.${userId})`,
        },
        (payload) => {
          const next = payload.new as DirectMessage;
          if (!selectedUserId) {
            return;
          }
          const relevant =
            (next.sender_id === userId && next.recipient_id === selectedUserId) ||
            (next.sender_id === selectedUserId && next.recipient_id === userId);
          if (!relevant) {
            return;
          }
          setMessages((prev) => [...prev, next]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedUserId]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, selectedUserId]);

  useEffect(() => {
    let isMounted = true;
    const loadSelectedProfile = async () => {
      if (!selectedUserId || selectedName) {
        return;
      }
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }
      const { data } = (await supabase
        .from("profiles")
        .select("ingame_name")
        .eq("user_id", selectedUserId)
        .maybeSingle()) as { data: { ingame_name: string } | null };
      if (!isMounted) {
        return;
      }
      if (data?.ingame_name) {
        setSelectedName(data.ingame_name);
      }
    };
    loadSelectedProfile();
    return () => {
      isMounted = false;
    };
  }, [selectedUserId, selectedName]);

  const handleSend = async () => {
    if (!userId || !selectedUserId) {
      return;
    }
    const body = newMessage.trim();
    if (!body) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setNewMessage("");
    const { error: sendError } = await supabase.from("direct_messages").insert({
      sender_id: userId,
      recipient_id: selectedUserId,
      body,
    });
    if (sendError) {
      setError(sendError.message || "Impossible d'envoyer le message.");
    }
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Messagerie
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Messages privés
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Discutez en privé avec les membres de la guilde.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </header>

        <div className="flex flex-col rounded-3xl border border-white/10 bg-surface/60 p-4 backdrop-blur">
          <div className="border-b border-white/10 pb-3">
            <p className="text-xs uppercase tracking-[0.25em] text-text/50">
              Conversation
            </p>
            <h2 className="mt-2 text-lg font-semibold text-text">
              {selectedUserId ? selectedName : "Choisir un membre"}
            </h2>
          </div>

            <div
              ref={scrollRef}
              className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1"
            >
              {selectedUserId ? (
                loadingMessages ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                    Chargement des messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                    Aucun message pour le moment.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === userId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={[
                            "max-w-[80%] rounded-2xl border px-4 py-3 text-sm",
                            isMine
                              ? "border-primary/40 bg-primary/20 text-text"
                              : "border-white/10 bg-black/40 text-text/80",
                          ].join(" ")}
                        >
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-text/40">
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                  Passez par la page Guilde pour démarrer une conversation.
                </div>
              )}
            </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Écrire un message..."
                rows={3}
                disabled={!selectedUserId}
                className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!selectedUserId || !newMessage.trim()}
                className="rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
