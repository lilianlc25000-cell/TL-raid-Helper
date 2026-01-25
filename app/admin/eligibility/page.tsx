"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  Eye,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { DEFAULT_PARTICIPATION_THRESHOLD } from "../../../lib/game-constants";

type MemberEntry = {
  userId: string;
  ingameName: string;
  roleRank: string | null;
  participationPoints: number;
  lootReceivedCount: number;
};

type WishlistEntry = {
  id: string;
  itemName: string;
  slotName: string;
  priority: number;
};

const getRoleStyle = (rank: string | null) => {
  const normalized = (rank ?? "soldat").toLowerCase();
  if (normalized === "admin") {
    return "border-amber-400/60 bg-amber-500/10 text-amber-200";
  }
  if (normalized === "conseiller") {
    return "border-slate-400/60 bg-slate-500/10 text-slate-200";
  }
  return "border-emerald-400/50 bg-emerald-500/10 text-emerald-200";
};

const slotLabelMap: Record<string, string> = {
  main_hand: "Arme principale",
  off_hand: "Arme secondaire",
  bracelet: "Bracelet",
  ring1: "Anneau 1",
  ring2: "Anneau 2",
  belt: "Ceinture",
  necklace: "Boucles d'oreilles",
};

const getRankBadge = (index: number) => {
  if (index === 0) return { icon: Trophy, color: "text-amber-300" };
  if (index === 1) return { icon: Trophy, color: "text-slate-200" };
  if (index === 2) return { icon: Trophy, color: "text-amber-700" };
  return null;
};

export default function AdminEligibilityPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberEntry | null>(null);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [participationThreshold, setParticipationThreshold] = useState<number>(
    DEFAULT_PARTICIPATION_THRESHOLD,
  );
  const [thresholdInput, setThresholdInput] = useState<string>(
    String(DEFAULT_PARTICIPATION_THRESHOLD),
  );
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  const loadMembers = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsAuthReady(true);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role_rank,guild_id")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null; guild_id?: string | null } | null;
    };
    const roleRank = String(profile?.role_rank ?? "").toLowerCase();
    const canAccess = roleRank === "admin" || roleRank === "conseiller";
    setIsAdmin(canAccess);
    if (!canAccess) {
      setIsAuthReady(true);
      return;
    }
    if (!profile?.guild_id) {
      setError("Aucune guilde active.");
      setIsAuthReady(true);
      return;
    }
    setGuildId(profile.guild_id);
    const { data: settings } = await supabase
      .from("guild_settings")
      .select("participation_threshold")
      .eq("guild_id", profile.guild_id)
      .maybeSingle();
    if (!settings) {
      await supabase.from("guild_settings").insert({
        guild_id: profile.guild_id,
        participation_threshold: DEFAULT_PARTICIPATION_THRESHOLD,
      });
      setParticipationThreshold(DEFAULT_PARTICIPATION_THRESHOLD);
      setThresholdInput(String(DEFAULT_PARTICIPATION_THRESHOLD));
    } else {
      const threshold =
        settings.participation_threshold ?? DEFAULT_PARTICIPATION_THRESHOLD;
      setParticipationThreshold(threshold);
      setThresholdInput(String(threshold));
    }
    const { data, error: membersError } = (await supabase
      .from("profiles")
      .select("user_id,ingame_name,role_rank,cohesion_points,loot_received_count")
      .eq("guild_id", profile.guild_id)
      .order("cohesion_points", { ascending: false })
      .order("ingame_name", { ascending: true })) as {
      data:
        | Array<{
            user_id: string;
            ingame_name: string;
            role_rank: string | null;
            cohesion_points: number | null;
            loot_received_count: number | null;
          }>
        | null;
      error: { message?: string } | null;
    };
    if (membersError) {
      setError(membersError.message || "Impossible de charger les membres.");
      setIsAuthReady(true);
      return;
    }
    setMembers(
      (data ?? []).map((member) => ({
        userId: member.user_id,
        ingameName: member.ingame_name,
        roleRank: member.role_rank,
        participationPoints: member.cohesion_points ?? 0,
        lootReceivedCount: member.loot_received_count ?? 0,
      })),
    );
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSaveThreshold = async () => {
    if (!guildId) {
      return;
    }
    const parsed = Number(thresholdInput);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setThresholdError("Le seuil doit être un nombre supérieur ou égal à 1.");
      return;
    }
    setThresholdError(null);
    setIsSavingThreshold(true);
    const supabase = createClient();
    if (!supabase) {
      setThresholdError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsSavingThreshold(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("guild_settings")
      .update({
        participation_threshold: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("guild_id", guildId);
    if (updateError) {
      setThresholdError(
        updateError.message || "Impossible de modifier le seuil.",
      );
      setIsSavingThreshold(false);
      return;
    }
    setParticipationThreshold(parsed);
    setIsSavingThreshold(false);
  };

  const openWishlist = async (member: MemberEntry) => {
    setSelectedMember(member);
    setWishlist([]);
    setWishlistError(null);
    setWishlistLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setWishlistError("Supabase n'est pas configuré (URL / ANON KEY).");
      setWishlistLoading(false);
      return;
    }
    const { data, error: wishlistFetchError } = (await supabase
      .from("gear_wishlist")
      .select("id,item_name,slot_name,item_priority")
      .eq("user_id", member.userId)
      .order("item_priority", { ascending: true })) as {
      data:
        | Array<{
            id: string;
            item_name: string;
            slot_name: string;
            item_priority: number;
          }>
        | null;
      error: { message?: string } | null;
    };
    if (wishlistFetchError) {
      setWishlistError(
        wishlistFetchError.message || "Impossible de charger la wishlist.",
      );
      setWishlistLoading(false);
      return;
    }
    setWishlist(
      (data ?? []).map((entry) => ({
        id: entry.id,
        itemName: entry.item_name,
        slotName: entry.slot_name,
        priority: entry.item_priority,
      })),
    );
    setWishlistLoading(false);
  };

  const closeWishlist = () => {
    setSelectedMember(null);
    setWishlist([]);
    setWishlistError(null);
    setWishlistLoading(false);
  };

  const rankedMembers = useMemo(() => members, [members]);

  if (!isAuthReady) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-10 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
          Vérification
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-200">
          Chargement de votre accès...
        </h1>
      </div>
    );
  }

  const isThresholdDirty =
    thresholdInput.trim() !== String(participationThreshold);

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-red-500/40 bg-zinc-950 px-6 py-10 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.4em] text-red-300/80">
          Accès refusé
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-red-200">
          Cette zone est réservée aux Officiers
        </h1>
        <p className="mt-2 text-sm text-red-200/70">
          Votre compte n&apos;a pas les droits nécessaires.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-amber-400/40 bg-surface/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-200/70">
              Éligibilité des membres
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
              Classement Participation
            </h1>
            <p className="mt-2 text-sm text-text/70">
              1 raid helper participé = 1 point de participation.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-400/40 bg-black/40 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-amber-200 sm:items-end">
            <span>
              Seuil : {participationThreshold} point
              {participationThreshold > 1 ? "s" : ""}
            </span>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={thresholdInput}
                onChange={(event) => setThresholdInput(event.target.value)}
                type="number"
                min={1}
                className="w-full rounded-full border border-amber-400/40 bg-black/40 px-3 py-2 text-xs text-amber-100 outline-none sm:w-32"
              />
              {isThresholdDirty ? (
                <button
                  type="button"
                  onClick={handleSaveThreshold}
                  disabled={isSavingThreshold}
                  className="rounded-full border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingThreshold ? "Sauvegarde..." : "Appliquer"}
                </button>
              ) : null}
            </div>
            {thresholdError ? (
              <span className="text-[10px] uppercase tracking-[0.2em] text-red-200">
                {thresholdError}
              </span>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
      </header>

      <section className="mt-8 space-y-4">
        {rankedMembers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-8 text-sm text-text/60">
            Aucun membre à afficher pour le moment.
          </div>
        ) : (
          rankedMembers.map((member, index) => {
            const rankBadge = getRankBadge(index);
            const isEligible =
              member.participationPoints >= participationThreshold;
            return (
              <div
                key={member.userId}
                className="group rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/70 via-black/80 to-zinc-900/70 px-5 py-5 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-amber-400/40"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-lg font-semibold text-text">
                      {rankBadge ? (
                        <rankBadge.icon className={`h-5 w-5 ${rankBadge.color}`} />
                      ) : (
                        <span className="text-sm text-text/60">#{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold text-text">
                          {member.ingameName}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em] ${getRoleStyle(
                            member.roleRank,
                          )}`}
                        >
                          {member.roleRank ?? "Soldat"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-text/50">
                        <span className="flex items-center gap-2">
                          <Swords className="h-4 w-4 text-emerald-300" />
                          {member.participationPoints} points
                        </span>
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          {member.lootReceivedCount} loots reçus
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <div
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em]",
                        isEligible
                          ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/40 bg-red-500/10 text-red-200",
                      ].join(" ")}
                    >
                      {isEligible ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Crown className="h-3.5 w-3.5" />
                      )}
                      {isEligible ? "Éligible au roll" : "Non éligible"}
                    </div>
                    <button
                      type="button"
                      onClick={() => openWishlist(member)}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
                    >
                      <Eye className="h-4 w-4" />
                      Voir la Wishlist
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {selectedMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-3xl rounded-3xl border border-amber-400/40 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">
                  Wishlist de {selectedMember.ingameName}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  Éligibilité &amp; priorités
                </h2>
                <p className="mt-2 text-sm text-text/70">
                  {selectedMember.participationPoints} points de participation ·
                  Seuil {participationThreshold} point
                  {participationThreshold > 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWishlist}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6">
              {wishlistError ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {wishlistError}
                </div>
              ) : wishlistLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-text/60">
                  Chargement de la wishlist...
                </div>
              ) : wishlist.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-text/60">
                  Aucun item dans la wishlist pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlist.map((item) => {
                    const isEligible =
                      selectedMember.participationPoints >=
                      participationThreshold;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                            {slotLabelMap[item.slotName] ?? item.slotName}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-text">
                            {item.itemName}
                          </p>
                          <span className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                            Priorité {item.priority}
                          </span>
                        </div>
                        <div
                          className={[
                            "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em]",
                            isEligible
                              ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/40 bg-red-500/10 text-red-200",
                          ].join(" ")}
                        >
                          {isEligible ? "Éligible au roll" : "Non éligible"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
