"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Shield, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { getWeaponImage } from "../../lib/weapons";

type MemberEntry = {
  userId: string;
  ingameName: string;
  role: string | null;
  archetype: string | null;
  gearScore: number | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  roleRank: string | null;
};

const getClassName = (mainWeapon: string | null, offWeapon: string | null) => {
  if (!mainWeapon || !offWeapon) {
    return "Classe inconnue";
  }
  return `${mainWeapon} / ${offWeapon}`;
};

const getRankStyle = (rank: string | null) => {
  const normalized = (rank ?? "soldat").toLowerCase();
  if (normalized === "admin") {
    return "border-amber-400/70 bg-amber-400/10 text-amber-200";
  }
  if (normalized === "conseiller") {
    return "border-slate-400/70 bg-slate-400/10 text-slate-200";
  }
  return "border-orange-400/70 bg-orange-400/10 text-orange-200";
};

const getRankLabel = (rank: string | null) => {
  const normalized = (rank ?? "soldat").toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "conseiller") return "Conseiller";
  return "Soldat";
};

export default function GuildPage() {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<MemberEntry | null>(null);
  const [currentGuildId, setCurrentGuildId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadMembers = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      let guildId: string | null = null;
      if (userId) {
        const { data: profile } = (await supabase
          .from("profiles")
          .select("guild_id")
          .eq("user_id", userId)
          .maybeSingle()) as { data: { guild_id?: string | null } | null };
        guildId = profile?.guild_id ?? null;
        if (isMounted) {
          setCurrentGuildId(guildId);
        }
      }
      if (!guildId) {
        setMembers([]);
        setIsLoading(false);
        return;
      }
      const { data: memberRows, error: membersError } = (await supabase
        .from("guild_members")
        .select("user_id,role_rank")
        .eq("guild_id", guildId)) as {
        data:
          | Array<{
              user_id: string;
              role_rank: string | null;
            }>
          | null;
        error: { message?: string } | null;
      };
      if (membersError) {
        setError(membersError.message || "Impossible de charger la guilde.");
        setIsLoading(false);
        return;
      }
      const memberIds = (memberRows ?? []).map((row) => row.user_id);
      const { data, error: fetchError } = (await supabase
        .from("profiles")
        .select(
          "user_id,ingame_name,role,archetype,gear_score,main_weapon,off_weapon",
        )
        .in("user_id", memberIds)) as {
        data:
          | Array<{
              user_id: string;
              ingame_name: string;
              role: string | null;
              archetype: string | null;
              gear_score: number | null;
              main_weapon: string | null;
              off_weapon: string | null;
            }>
          | null;
        error: { message?: string } | null;
      };

      if (!isMounted) {
        return;
      }
      if (fetchError) {
        setError(fetchError.message || "Impossible de charger la guilde.");
        setIsLoading(false);
        return;
      }
      const roleById = new Map(
        (memberRows ?? []).map((row) => [row.user_id, row.role_rank]),
      );
      setMembers(
        (data ?? []).map((entry) => ({
          userId: entry.user_id,
          ingameName: entry.ingame_name,
          role: entry.role,
          archetype: entry.archetype,
          gearScore: entry.gear_score,
          mainWeapon: entry.main_weapon,
          offWeapon: entry.off_weapon,
          roleRank: roleById.get(entry.user_id) ?? null,
        })),
      );
      setIsLoading(false);
    };

    loadMembers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const setupPresence = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        return;
      }
      const channel = supabase.channel("guild-online", {
        config: {
          presence: { key: userId },
        },
      });
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        if (!isMounted) {
          return;
        }
        setOnlineMemberIds(new Set(Object.keys(state)));
      });
      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          return;
        }
        await channel.track({ online_at: new Date().toISOString() });
      });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setupPresence();
    return () => {
      isMounted = false;
      void cleanupPromise?.then((cleanup) => cleanup?.());
    };
  }, []);

  const sortedMembers = useMemo(() => {
    const rankOrder = (rank: string | null) => {
      const normalized = (rank ?? "soldat").toLowerCase();
      if (normalized === "admin") return 0;
      if (normalized === "conseiller") return 1;
      return 2;
    };
    return [...members].sort((a, b) => {
      const rankDiff = rankOrder(a.roleRank) - rankOrder(b.roleRank);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.ingameName.localeCompare(b.ingameName, "fr");
    });
  }, [members]);

  if (isLoading) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Chargement de la guilde...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-gold/50 bg-surface/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.4em] text-gold/70">
            Guilde
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Membres de la guilde
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Vue en lecture seule, sans droits de gestion.
          </p>
          <div className="mt-4">
            <Link
              href="/guild/messages"
              className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
            >
              Messagerie générale de guilde
            </Link>
            {currentGuildId ? (
              <button
                type="button"
                onClick={async () => {
                  const supabase = createSupabaseBrowserClient();
                  if (!supabase || !currentGuildId) {
                    return;
                  }
                  setIsLeaving(true);
                  const { data } = await supabase.auth.getUser();
                  const userId = data.user?.id;
                  if (!userId) {
                    setIsLeaving(false);
                    return;
                  }
                  await supabase
                    .from("guild_members")
                    .delete()
                    .eq("guild_id", currentGuildId)
                    .eq("user_id", userId);
                  await supabase
                    .from("profiles")
                    .update({ guild_id: null })
                    .eq("user_id", userId);
                  setIsLeaving(false);
                  window.location.href = "/guild/join";
                }}
                disabled={isLeaving}
                className="ml-3 inline-flex items-center rounded-full border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLeaving ? "Quitter..." : "Quitter la guilde"}
              </button>
            ) : null}
          </div>
        </header>

        {!currentGuildId ? (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-6 py-5 text-sm text-amber-100">
            Vous n&apos;avez pas encore de guilde.
            <div className="mt-3">
              <Link
                href="/guild/join"
                className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
              >
                Créer / Rejoindre une guilde
              </Link>
            </div>
          </div>
        ) : null}

        {sortedMembers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/60">
            Aucun membre pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMembers.map((member) => {
              const mainImage = getWeaponImage(member.mainWeapon);
              const offImage = getWeaponImage(member.offWeapon);
              const mainKey = `${member.userId}-main`;
              const offKey = `${member.userId}-off`;
              const isOnline = onlineMemberIds.has(member.userId);
              return (
                <div
                  key={member.userId}
                  className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4 text-sm text-text/80 shadow-[0_0_20px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-text">
                      {member.ingameName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text/60">
                      <span
                        className={`rounded-full border px-2 py-1 ${
                          isOnline
                            ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-black/40"
                        }`}
                      >
                        {isOnline ? "En ligne" : "Hors ligne"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1">
                        {getClassName(member.mainWeapon, member.offWeapon)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1">
                        Rôle: {member.role || "Inconnu"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1">
                        Sous-classe: {member.archetype || "Non définie"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1">
                        GS: {member.gearScore ?? "?"}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 ${getRankStyle(
                          member.roleRank,
                        )}`}
                      >
                        {getRankLabel(member.roleRank)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMenuOpenFor((prev) =>
                          prev === member.userId ? null : member.userId,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-text/70 transition hover:text-text"
                      aria-label={`Actions ${member.ingameName}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                      {mainImage && !imageErrors[mainKey] ? (
                        <Image
                          src={mainImage}
                          alt={member.mainWeapon ?? "Arme principale"}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-lg object-contain"
                          unoptimized
                          onError={() =>
                            setImageErrors((prev) => ({
                              ...prev,
                              [mainKey]: true,
                            }))
                          }
                        />
                      ) : (
                        <Shield className="h-4 w-4 text-text/70" />
                      )}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                      {offImage && !imageErrors[offKey] ? (
                        <Image
                          src={offImage}
                          alt={member.offWeapon ?? "Arme secondaire"}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-lg object-contain"
                          unoptimized
                          onError={() =>
                            setImageErrors((prev) => ({
                              ...prev,
                              [offKey]: true,
                            }))
                          }
                        />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-text/70" />
                      )}
                    </span>
                  </div>

                  {menuOpenFor === member.userId ? (
                    <div className="absolute right-4 top-4 z-10 w-48 rounded-xl border border-white/10 bg-surface/95 p-2 shadow-[0_0_25px_rgba(0,0,0,0.45)] backdrop-blur">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileView(member);
                          setMenuOpenFor(null);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-text/80 transition hover:bg-white/5 hover:text-text"
                      >
                        Voir le profil
                      </button>
                      <a
                        href={`/messages?user=${encodeURIComponent(
                          member.userId,
                        )}&name=${encodeURIComponent(member.ingameName)}`}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text/80 transition hover:bg-white/5 hover:text-text"
                      >
                        Envoyer un message
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {profileView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface/95 p-6 text-text shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Profil membre
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  {profileView.ingameName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileView(null)}
                className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-text/70">
              <div>Rôle : {profileView.role ?? "Inconnu"}</div>
              <div>Sous-classe : {profileView.archetype ?? "Non définie"}</div>
              <div>GS : {profileView.gearScore ?? "?"}</div>
              <div>Rang : {getRankLabel(profileView.roleRank)}</div>
              <div>
                Classe : {getClassName(profileView.mainWeapon, profileView.offWeapon)}
              </div>
            </div>
            <a
              href={`/messages?user=${encodeURIComponent(
                profileView.userId,
              )}&name=${encodeURIComponent(profileView.ingameName)}`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
            >
              Envoyer un message
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
