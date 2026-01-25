"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type GuildMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  guild_id?: string | null;
};

type SenderProfile = {
  user_id: string;
  ingame_name: string;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function GuildMessagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GuildMessage[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const supabase = createClient();
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
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id")
        .eq("user_id", id)
        .maybeSingle()) as { data: { guild_id?: string | null } | null };
      if (!isMounted) {
        return;
      }
      if (!profile?.guild_id) {
        setError("Rejoins une guilde pour accéder à la messagerie.");
        setLoading(false);
        return;
      }
      setGuildId(profile.guild_id ?? null);
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadMessages = async (currentGuildId: string) => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = (await supabase
      .from("guild_messages")
      .select("id,sender_id,body,created_at,guild_id")
      .eq("guild_id", currentGuildId)
      .order("created_at", { ascending: true })
      .limit(200)) as {
      data: GuildMessage[] | null;
      error: { message?: string } | null;
    };
    if (fetchError) {
      setError(fetchError.message || "Impossible de charger les messages.");
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    setMessages(rows);
    const senderIds = Array.from(new Set(rows.map((row) => row.sender_id)));
    if (senderIds.length) {
      const { data: profiles } = (await supabase
        .from("profiles")
        .select("user_id,ingame_name")
        .in("user_id", senderIds)) as { data: SenderProfile[] | null };
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((profile) => {
        map[profile.user_id] = profile.ingame_name;
      });
      setNamesById(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId || !guildId) {
      return;
    }
    void loadMessages(guildId);
  }, [userId, guildId]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    if (!guildId) {
      return;
    }
    const channel = supabase.channel(`guild-messages-${guildId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guild_messages",
          filter: `guild_id=eq.${guildId}`,
        },
        (payload) => {
          const next = payload.new as GuildMessage;
          setMessages((prev) => [...prev, next]);
          if (!namesById[next.sender_id]) {
            void loadMessages(guildId);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [namesById, guildId]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!userId || !guildId) {
      return;
    }
    const body = newMessage.trim();
    if (!body) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    setNewMessage("");
    const { data, error: sendError } = await supabase
      .from("guild_messages")
      .insert({
        sender_id: userId,
        body,
        guild_id: guildId,
      })
      .select("id,sender_id,body,created_at,guild_id")
      .single();
    if (sendError) {
      setError(sendError.message || "Impossible d'envoyer le message.");
      return;
    }
    if (data) {
      setMessages((prev) => [...prev, data]);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex h-[70vh] flex-col rounded-3xl border border-white/10 bg-surface/60 p-4 backdrop-blur">

          <div
            ref={scrollRef}
            className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto pr-1"
          >
            {error ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                Chargement des messages...
              </div>
            ) : messages.length === 0 ? null : (
              messages.map((message) => {
                const isMine = message.sender_id === userId;
                const senderLabel = isMine
                  ? "Vous"
                  : namesById[message.sender_id] ?? "Membre";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[80%] rounded-2xl border px-4 py-3 text-sm",
                        isMine
                          ? "border-primary/40 bg-primary/20 text-text text-right"
                          : "border-white/10 bg-black/40 text-text/80",
                      ].join(" ")}
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] text-text/50">
                        {senderLabel} · {formatTime(message.created_at)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-text">
                        {message.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-auto border-t border-white/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Écrire un message à la guilde..."
                rows={3}
                disabled={!userId}
                className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!userId || !newMessage.trim()}
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
