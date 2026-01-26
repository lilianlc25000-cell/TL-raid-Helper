"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { gameItemsByCategory } from "@/lib/game-items";

type EligiblePlayer = {
  userId: string;
  ingameName: string;
  checked: boolean;
};

const weaponOptions = gameItemsByCategory.armes
  .map((item) => item.name)
  .sort((a, b) => a.localeCompare(b, "fr"));

export default function LootRoulettePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [itemName, setItemName] = useState("");
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinIndex, setSpinIndex] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsAuthReady(true);
      return () => {
        isMounted = false;
      };
    }
    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      const sessionUser = data.session?.user;
      if (!sessionUser?.id) {
        setError("Veuillez vous connecter pour accéder à la roulette.");
        setIsAuthReady(true);
        return;
      }
      setUserId(sessionUser.id);
    };
    syncUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const loadProfile = async () => {
      const supabase = createClient();
      if (!supabase) {
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("role_rank,guild_id")
        .eq("user_id", userId)
        .maybeSingle()) as {
        data: { role_rank?: string | null; guild_id?: string | null } | null;
      };
      setGuildId(profile?.guild_id ?? null);
      setIsAdmin(
        profile?.role_rank === "admin" || profile?.role_rank === "conseiller",
      );
      setIsAuthReady(true);
    };
    void loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!guildId || !itemName.trim()) {
      setEligiblePlayers([]);
      setWinnerId(null);
      setSpinIndex(null);
      return;
    }
    const loadEligible = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      setIsLoading(true);
      setError(null);
      setWinnerId(null);
      setSpinIndex(null);

      const { data: wishlistRows, error: wishlistError } = await supabase
        .from("gear_wishlist")
        .select("user_id")
        .eq("guild_id", guildId)
        .eq("item_name", itemName);

      if (wishlistError) {
        setError(
          wishlistError.message ||
            "Impossible de charger les wishlists pour cet item.",
        );
        setIsLoading(false);
        return;
      }

      const userIds = Array.from(
        new Set((wishlistRows ?? []).map((row) => row.user_id).filter(Boolean)),
      );
      if (userIds.length === 0) {
        setEligiblePlayers([]);
        setIsLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id,ingame_name")
        .in("user_id", userIds);

      const mapped = (profilesData ?? [])
        .map((profile) => ({
          userId: profile.user_id,
          ingameName: profile.ingame_name ?? "Inconnu",
          checked: true,
        }))
        .sort((a, b) => a.ingameName.localeCompare(b.ingameName, "fr"));

      setEligiblePlayers(mapped);
      setIsLoading(false);
    };

    void loadEligible();
  }, [guildId, itemName]);

  const handleToggle = (userIdValue: string) => {
    setEligiblePlayers((prev) =>
      prev.map((player) =>
        player.userId === userIdValue
          ? { ...player, checked: !player.checked }
          : player,
      ),
    );
  };

  const handleSpin = () => {
    const candidates = eligiblePlayers.filter((player) => player.checked);
    if (candidates.length === 0) {
      setError("Aucun joueur sélectionné pour la roulette.");
      return;
    }
    setError(null);
    setIsSpinning(true);
    setWinnerId(null);
    setSaveStatus(null);
    const durationMs = 2000;
    const intervalMs = 80;
    const start = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const index = Math.floor(elapsed / intervalMs) % candidates.length;
      setSpinIndex(index);
      if (elapsed >= durationMs) {
        window.clearInterval(timer);
        const winner =
          candidates[Math.floor(Math.random() * candidates.length)];
        setWinnerId(winner.userId);
        setSpinIndex(null);
        setIsSpinning(false);
      }
    }, intervalMs);
  };

  const handleSaveWinner = async () => {
    if (!winnerId || !itemName.trim()) {
      setError("Sélectionnez un gagnant avant de sauvegarder.");
      return;
    }
    if (!guildId) {
      setError("Aucune guilde active.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("loot_history").insert({
      item_name: itemName,
      user_id: winnerId,
      guild_id: guildId,
      raid_event_id: null,
      loot_method: "roulette",
    });
    if (insertError) {
      setError(insertError.message || "Impossible de sauvegarder le gagnant.");
      setIsSaving(false);
      return;
    }
    setSaveStatus("Gagnant sauvegardé dans l'historique.");
    setIsSaving(false);
  };

  const winner = useMemo(
    () => eligiblePlayers.find((player) => player.userId === winnerId) ?? null,
    [eligiblePlayers, winnerId],
  );

  if (!isAuthReady) {
    return (
      <div className="min-h-screen px-6 py-10 text-zinc-100">
        <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/60">
          Chargement...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-10 text-zinc-100">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          Accès réservé aux officiers.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-zinc-100">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-text/50">
            Roulette de loot
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Quel loot voulez-vous tirer au sort ?
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/admin/loot"
              className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
            >
              Retour à la gestion
            </Link>
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <label className="text-xs uppercase tracking-[0.25em] text-text/50">
            Sélection de l'arme
          </label>
          <input
            list="loot-items"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Ex: Espadon d'Adentus"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
          />
          <datalist id="loot-items">
            {weaponOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <p className="mt-3 text-xs text-text/50">
            Les armes correspondent à celles disponibles dans les wishlists.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Joueurs éligibles
          </p>
          {isLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Chargement des joueurs...
            </div>
          ) : eligiblePlayers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Aucun joueur éligible pour cet item.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {eligiblePlayers.map((player) => (
                <label
                  key={player.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-text/70"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={player.checked}
                      onChange={() => handleToggle(player.userId)}
                      className="h-4 w-4 rounded border-white/20 bg-black/40"
                    />
                    <span className="font-semibold text-text">
                      {player.ingameName}
                    </span>
                  </div>
                  {winnerId === player.userId ? (
                    <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Gagnant
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Roulette
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning || eligiblePlayers.length === 0}
              className="rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Lancer la roulette
            </button>
            {winner ? (
              <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                Gagnant : <span className="font-semibold">{winner.ingameName}</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-text/60">
                {isSpinning
                  ? "La roulette tourne..."
                  : "Choisissez l'arme pour lancer."}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/70">
            <p className="text-xs uppercase tracking-[0.2em] text-text/50">
              Animation
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {eligiblePlayers
                .filter((player) => player.checked)
                .map((player, index) => {
                  const isActive = spinIndex === index;
                  return (
                    <div
                      key={player.userId}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-amber-400/70 bg-amber-400/10 text-amber-100 animate-pulse"
                          : "border-white/10 bg-black/30 text-text/60"
                      }`}
                    >
                      {player.ingameName}
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveWinner}
              disabled={!winner || isSaving}
              className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Sauvegarde..." : "Valider & Sauvegarder"}
            </button>
            {saveStatus ? (
              <span className="text-xs text-emerald-200">{saveStatus}</span>
            ) : null}
          </div>
          {spinIndex !== null ? (
            <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {eligiblePlayers.filter((player) => player.checked)[spinIndex]
                ?.ingameName ?? ""}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
