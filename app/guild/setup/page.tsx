"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function GuildSetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [guildName, setGuildName] = useState("");
  const [guildSlug, setGuildSlug] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError("Veuillez vous connecter pour gérer une guilde.");
        return;
      }
      setUserId(id);
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!userId) {
      return;
    }
    const name = guildName.trim();
    const slug = normalizeSlug(guildSlug || guildName);
    if (!name || !slug) {
      setError("Nom et code de guilde obligatoires.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .insert({ name, slug, owner_id: userId })
      .select("id")
      .single();
    if (guildError) {
      setError(guildError.message || "Impossible de créer la guilde.");
      setLoading(false);
      return;
    }
    await supabase.from("guild_members").insert({
      guild_id: guild.id,
      user_id: userId,
      role_rank: "admin",
    });
    await supabase
      .from("profiles")
      .update({ guild_id: guild.id })
      .eq("user_id", userId);
    setSuccess("Guilde créée ! Redirection...");
    setLoading(false);
    router.push("/");
  };

  const handleJoin = async () => {
    if (!userId) {
      return;
    }
    const slug = normalizeSlug(joinSlug);
    if (!slug) {
      setError("Code de guilde requis.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data: guild, error: fetchError } = await supabase
      .from("guilds")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (fetchError || !guild) {
      setError("Guilde introuvable.");
      setLoading(false);
      return;
    }
    const { error: joinError } = await supabase.from("guild_members").insert({
      guild_id: guild.id,
      user_id: userId,
      role_rank: "member",
    });
    if (joinError) {
      setError(joinError.message || "Impossible de rejoindre la guilde.");
      setLoading(false);
      return;
    }
    await supabase
      .from("profiles")
      .update({ guild_id: guild.id })
      .eq("user_id", userId);
    setSuccess("Guilde rejointe ! Redirection...");
    setLoading(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Guilde
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Création / Rejoindre
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Crée ta guilde ou rejoins-en une via son code.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
          {success ? (
            <p className="mt-3 text-sm text-emerald-300">{success}</p>
          ) : null}
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.25em] text-text/50">
              Créer une guilde
            </h2>
            <div className="mt-4 space-y-3">
              <input
                value={guildName}
                onChange={(event) => setGuildName(event.target.value)}
                placeholder="Nom de la guilde"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
              />
              <input
                value={guildSlug}
                onChange={(event) => setGuildSlug(event.target.value)}
                placeholder="Code (ex: les-archers)"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || !userId}
                className="w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Créer la guilde
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.25em] text-text/50">
              Rejoindre une guilde
            </h2>
            <div className="mt-4 space-y-3">
              <input
                value={joinSlug}
                onChange={(event) => setJoinSlug(event.target.value)}
                placeholder="Code de guilde"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={loading || !userId}
                className="w-full rounded-2xl border border-sky-400/60 bg-sky-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rejoindre la guilde
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
