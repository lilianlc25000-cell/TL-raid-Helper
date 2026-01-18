"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Shield, ShieldCheck, UserMinus } from "lucide-react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { getWeaponImage } from "../../../lib/weapons";

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

export default function GuildMembersPage() {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const loadAccess = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setIsAuthReady(true);
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
    setIsAdmin(rank === "admin" || rank === "conseiller");
    setCanManage(rank === "admin");
    setIsAuthReady(true);
  }, []);

  const loadMembers = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = (await supabase
      .from("profiles")
      .select(
        "user_id,ingame_name,role,archetype,gear_score,main_weapon,off_weapon,role_rank",
      )) as {
      data:
        | Array<{
            user_id: string;
            ingame_name: string;
            role: string | null;
            archetype: string | null;
            gear_score: number | null;
            main_weapon: string | null;
            off_weapon: string | null;
            role_rank: string | null;
          }>
        | null;
      error: { message?: string } | null;
    };

    if (fetchError) {
      setError(fetchError.message || "Impossible de charger les membres.");
      setIsLoading(false);
      return;
    }

    const mapped =
      data?.map((entry) => ({
        userId: entry.user_id,
        ingameName: entry.ingame_name,
        role: entry.role,
        archetype: entry.archetype,
        gearScore: entry.gear_score,
        mainWeapon: entry.main_weapon,
        offWeapon: entry.off_weapon,
        roleRank: entry.role_rank,
      })) ?? [];

    setMembers(mapped);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    if (!isAuthReady || !isAdmin) {
      return;
    }
    loadMembers();
  }, [isAuthReady, isAdmin, loadMembers]);

  const updateRoleRank = async (userId: string, roleRank: string) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role_rank: roleRank })
      .eq("user_id", userId);
    if (updateError) {
      setError(updateError.message || "Impossible de mettre à jour le rôle.");
      return;
    }
    setMembers((prev) =>
      prev.map((member) =>
        member.userId === userId ? { ...member, roleRank } : member,
      ),
    );
    setMenuOpenId(null);
  };

  const handleExclude = async (userId: string) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role_rank: "exclu" })
      .eq("user_id", userId);
    if (updateError) {
      setError(updateError.message || "Impossible d'exclure le joueur.");
      return;
    }
    await supabase.from("event_signups").delete().eq("user_id", userId);
    setMembers((prev) => prev.filter((member) => member.userId !== userId));
    setMenuOpenId(null);
  };

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.ingameName.localeCompare(b.ingameName)),
    [members],
  );

  if (!isAuthReady) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Chargement des accès...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          Accès refusé.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-gold/50 bg-surface/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.4em] text-gold/70">
            Command Center
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Gérer les membres de la guilde
          </h1>
          <p className="mt-2 text-sm text-text/70">
            Promotions, exclusions et suivi des profils.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/60">
            Chargement des membres...
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/60">
            Aucun membre inscrit pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMembers.map((member) => {
              const mainImage = getWeaponImage(member.mainWeapon);
              const offImage = getWeaponImage(member.offWeapon);
              const mainKey = `${member.userId}-main`;
              const offKey = `${member.userId}-off`;
              return (
                <div
                  key={member.userId}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4 text-sm text-text/80 shadow-[0_0_20px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-text">
                      {member.ingameName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text/60">
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

                  <div className="flex items-center gap-3">
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
                    <div className="relative">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpenId((prev) =>
                              prev === member.userId ? null : member.userId,
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-text/60 transition hover:text-text"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canManage && menuOpenId === member.userId ? (
                        <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-xl border border-white/10 bg-zinc-950 p-2 text-xs text-text/70 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
                          <button
                            type="button"
                            onClick={() => updateRoleRank(member.userId, "admin")}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Promouvoir admin
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRoleRank(member.userId, "conseiller")}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Promouvoir conseiller
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRoleRank(member.userId, "soldat")}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Passer soldat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExclude(member.userId)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Exclure
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
