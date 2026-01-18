"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
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

  useEffect(() => {
    let isMounted = true;
    const loadMembers = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoading(false);
        return;
      }
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

      if (!isMounted) {
        return;
      }
      if (fetchError) {
        setError(fetchError.message || "Impossible de charger la guilde.");
        setIsLoading(false);
        return;
      }
      setMembers(
        (data ?? []).map((entry) => ({
          userId: entry.user_id,
          ingameName: entry.ingame_name,
          role: entry.role,
          archetype: entry.archetype,
          gearScore: entry.gear_score,
          mainWeapon: entry.main_weapon,
          offWeapon: entry.off_weapon,
          roleRank: entry.role_rank,
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

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.ingameName.localeCompare(b.ingameName)),
    [members],
  );

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
        </header>

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
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4 text-sm text-text/80 shadow-[0_0_20px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between"
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
