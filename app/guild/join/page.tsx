"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

type GuildEntry = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  member_count?: number;
};

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function GuildJoinPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [query, setQuery] = useState("");
  const [guildName, setGuildName] = useState("");
  const [guildAccessCode, setGuildAccessCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [pendingGuild, setPendingGuild] = useState<GuildEntry | null>(null);

  const isProfileComplete = (profile: {
    ingame_name?: string | null;
    main_weapon?: string | null;
    off_weapon?: string | null;
    role?: string | null;
    archetype?: string | null;
    gear_score?: number | null;
  } | null) =>
    Boolean(
      profile?.ingame_name?.trim() &&
        profile?.main_weapon &&
        profile?.off_weapon &&
        profile?.role &&
        profile?.archetype &&
        typeof profile?.gear_score === "number" &&
        profile.gear_score > 0,
    );

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
        setError("Veuillez vous connecter pour rejoindre une guilde.");
        setLoading(false);
        return;
      }
      setUserId(id);
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id,ingame_name,main_weapon,off_weapon,role,archetype,gear_score")
        .eq("user_id", id)
        .maybeSingle()) as {
        data:
          | {
              guild_id?: string | null;
              ingame_name?: string | null;
              main_weapon?: string | null;
              off_weapon?: string | null;
              role?: string | null;
              archetype?: string | null;
              gear_score?: number | null;
            }
          | null;
      };
      if (!isProfileComplete(profile)) {
        router.replace("/profile");
        return;
      }
      if (profile?.guild_id) {
        router.push("/");
        return;
      }
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadGuilds = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = (await supabase.rpc(
      "get_guilds_with_counts",
    )) as {
      data: GuildEntry[] | null;
      error: { message?: string } | null;
    };
    if (fetchError) {
      setError(fetchError.message || "Impossible de charger les guildes.");
      setLoading(false);
      return;
    }
    const list = (data ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const hasTrinity = list.some((guild) => guild.slug === "trinity");
    const withTrinity = hasTrinity
      ? list
      : [
          {
            id: "trinity",
            name: "Trinity",
            slug: "trinity",
            owner_id: "",
            member_count: 0,
          },
          ...list,
        ];
    setGuilds(withTrinity);
    setLoading(false);
  };

  useEffect(() => {
    void loadGuilds();
  }, []);

  const handleJoin = async (guild: GuildEntry) => {
    if (!userId) {
      return;
    }
    setPendingGuild(guild);
    setKeyInput("");
    setShowKeyModal(true);
  };

  const performJoin = async (guild: GuildEntry, roleRank: "admin" | "member") => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setJoiningId(guild.id);
    setError(null);
    let targetGuildId = guild.id;
    const { error: joinError } = await supabase.from("guild_members").insert({
      guild_id: targetGuildId,
      user_id: userId,
      role_rank: roleRank,
    });
    if (joinError) {
      setError(joinError.message || "Impossible de rejoindre la guilde.");
      setJoiningId(null);
      return;
    }
    await supabase
      .from("profiles")
      .update({ guild_id: targetGuildId, role_rank: roleRank })
      .eq("user_id", userId);
    setJoiningId(null);
    router.push("/");
    router.refresh();
  };


  const handleCreate = async () => {
    if (!userId) {
      return;
    }
    const name = guildName.trim();
    const slug = normalizeSlug(guildName);
    const accessCode = guildAccessCode.trim();
    if (!name || !slug || !accessCode) {
      setError("Nom et clé obligatoires.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setError(null);
    setLoading(true);
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .insert({ name, slug, owner_id: userId, access_code: accessCode })
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
      .update({ guild_id: guild.id, role_rank: "admin" })
      .eq("user_id", userId);
    setLoading(false);
    router.push("/");
    router.refresh();
  };

  const filteredGuilds = guilds.filter((guild) =>
    guild.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleKeyConfirm = async () => {
    if (!userId) {
      return;
    }
    if (!pendingGuild) {
      return;
    }
    const key = keyInput.trim();
    if (!key) {
      setError("Clé d'accès requise.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    setError(null);
    let targetGuild: GuildEntry | null = null;
    let joinRole: "admin" | "member" = "member";
    if (pendingGuild.id === "trinity") {
      const { data: existing } = await supabase
        .from("guilds")
        .select("id,name,slug,owner_id")
        .eq("slug", "trinity")
        .eq("access_code", key)
        .maybeSingle();
      if (existing) {
        targetGuild = existing as GuildEntry;
      } else if (key === "1234") {
        const { data: created, error: createError } = await supabase
          .from("guilds")
          .insert({
            name: "Trinity",
            slug: "trinity",
            owner_id: userId,
            access_code: key,
          })
          .select("id,name,slug,owner_id")
          .single();
        if (createError) {
          setError(createError.message || "Impossible de créer la guilde.");
          return;
        }
        targetGuild = created as GuildEntry;
        joinRole = "admin";
      } else {
        setError("Clé Trinity invalide.");
        return;
      }
    } else {
      const { data: existing } = await supabase
        .from("guilds")
        .select("id,name,slug,owner_id")
        .eq("id", pendingGuild.id)
        .eq("access_code", key)
        .maybeSingle();
      if (!existing) {
        setError("Clé invalide.");
        return;
      }
      targetGuild = existing as GuildEntry;
    }
    setShowKeyModal(false);
    setPendingGuild(null);
    if (targetGuild) {
      await performJoin(targetGuild, joinRole);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Guilde
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Rejoindre une guilde
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Choisis une guilde existante et sa clé d'accès.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une guilde..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none sm:w-72"
            />
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-text/50">
                Créer sa guilde
              </p>
              <div className="mt-3 space-y-3">
                <input
                  value={guildName}
                  onChange={(event) => setGuildName(event.target.value)}
                  placeholder="Nom de la guilde"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
                />
              <input
                value={guildAccessCode}
                onChange={(event) => setGuildAccessCode(event.target.value)}
                placeholder="Clé d'accès (ex: 1234)"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
              />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading || !userId}
                  className="w-full rounded-2xl border border-emerald-400/60 bg-emerald-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Créer la guilde
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-text/50">
                Guildes publiques
              </p>
              <p className="mt-2 text-xs text-text/40">
                Sélectionne une guilde pour rejoindre.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                Chargement des guildes...
              </div>
            ) : filteredGuilds.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-text/60">
                Aucune guilde trouvée.
              </div>
            ) : (
              filteredGuilds.map((guild) => (
                <div
                  key={guild.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-text/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-text">
                      {guild.name}
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-text/40">
                      {(guild.member_count ?? 0)}/70
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoin(guild)}
                    disabled={joiningId === guild.id || !userId}
                    className="rounded-2xl border border-sky-400/60 bg-sky-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {joiningId === guild.id ? "..." : "Rejoindre"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      {showKeyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface/95 p-6 text-text shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.25em] text-text/50">
              Accès à la guilde
            </p>
            <h2 className="mt-2 text-lg font-semibold text-text">Clé d'accès</h2>
            <p className="mt-2 text-sm text-text/70">
              Entre la clé pour rejoindre la guilde.
            </p>
            <input
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="Clé d'accès"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text outline-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowKeyModal(false);
                  setPendingGuild(null);
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleKeyConfirm}
                className="flex-1 rounded-2xl border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
