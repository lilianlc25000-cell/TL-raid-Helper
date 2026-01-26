"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gameItemsByCategory } from "@/lib/game-items";
import { motion } from "framer-motion";

type EligiblePlayer = {
  userId: string;
  ingameName: string;
  role: string | null;
  checked: boolean;
};

type ParticipantRow = {
  user_id: string;
  assigned_role: string | null;
  guild_id: string | null;
  profiles:
    | {
        ingame_name: string;
        role: string | null;
        guild_id: string | null;
      }
    | Array<{
        ingame_name: string;
        role: string | null;
        guild_id: string | null;
      }>
    | null;
};

const getEffectiveRole = (assignedRole: string | null, role: string | null) =>
  assignedRole ?? role;

const CARD_WIDTH = 140;
const CONTAINER_WIDTH = 480;

export default function LootDistributor() {
  const params = useParams();
  const eventId = String(params?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winner, setWinner] = useState<EligiblePlayer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [stripItems, setStripItems] = useState<EligiblePlayer[]>([]);
  const [animationX, setAnimationX] = useState(0);
  const [animationSeed, setAnimationSeed] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const itemOptions = useMemo(
    () =>
      Object.values(gameItemsByCategory)
        .flat()
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b, "fr")),
    [],
  );

  useEffect(() => {
    if (!eventId || !itemName.trim()) {
      setEligiblePlayers([]);
      setWinnerId(null);
      setWinner(null);
      setStripItems([]);
      setIsSpinning(false);
      setTargetIndex(null);
      return;
    }

    const loadEligible = async () => {
      const supabase = createClient();
      if (!supabase) {
        setStatus("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      setIsLoading(true);
      setStatus(null);
      setWinnerId(null);
      setWinner(null);
      setStripItems([]);
      setIsSpinning(false);
      setTargetIndex(null);

      const { data: participantsData, error: participantsError } =
        (await supabase
          .from("event_signups")
          .select("user_id,assigned_role,guild_id,profiles(ingame_name,role,guild_id)")
          .eq("event_id", eventId)
          .eq("status", "present")) as {
          data: ParticipantRow[] | null;
          error: { message?: string } | null;
        };

      if (participantsError) {
        setStatus(
          participantsError.message ||
            "Impossible de charger les participants.",
        );
        setIsLoading(false);
        return;
      }

      const participants = participantsData ?? [];
      if (participants.length === 0) {
        setEligiblePlayers([]);
        setIsLoading(false);
        return;
      }

      const guildId =
        participants.find((row) => row.guild_id)?.guild_id ??
        (Array.isArray(participants[0].profiles)
          ? participants[0].profiles[0]?.guild_id
          : participants[0].profiles?.guild_id) ??
        null;

      const participantByUser = new Map(
        participants.map((row) => [
          row.user_id,
          {
            assignedRole: row.assigned_role ?? null,
            profile: Array.isArray(row.profiles)
              ? row.profiles[0]
              : row.profiles,
          },
        ]),
      );

      const userIds = participants.map((row) => row.user_id);
      const { data: wishlistRows } = await supabase
        .from("gear_wishlist")
        .select("user_id")
        .eq("item_name", itemName)
        .in("user_id", userIds);

      const eligibleIds = new Set(
        (wishlistRows ?? []).map((row) => row.user_id),
      );

      if (eligibleIds.size === 0) {
        setEligiblePlayers([]);
        setIsLoading(false);
        return;
      }

      const mapped = Array.from(eligibleIds)
        .map((userId) => {
          const details = participantByUser.get(userId);
          const profile = details?.profile;
          const role = getEffectiveRole(details?.assignedRole ?? null, profile?.role ?? null);
          return {
            userId,
            ingameName: profile?.ingame_name ?? "Inconnu",
            role,
            checked: true,
          };
        })
        .sort((a, b) => a.ingameName.localeCompare(b.ingameName, "fr"));

      setEligiblePlayers(mapped);
      setIsLoading(false);
    };

    void loadEligible();
  }, [eventId, itemName]);

  const handleToggle = (userId: string) => {
    setEligiblePlayers((prev) =>
      prev.map((player) =>
        player.userId === userId
          ? { ...player, checked: !player.checked }
          : player,
      ),
    );
  };

  const handleRoulette = () => {
    const candidates = eligiblePlayers.filter((player) => player.checked);
    if (candidates.length === 0) {
      setStatus("Aucun joueur sélectionné pour la roulette.");
      return;
    }
    const selectedWinner =
      candidates[Math.floor(Math.random() * candidates.length)];
    const repeatCount = 32;
    const baseStrip = Array.from({ length: repeatCount }).flatMap(
      () => candidates,
    );
    const targetIndex = Math.max(baseStrip.length - 5, 0);
    const strip = baseStrip.map((item, index) =>
      index === targetIndex ? selectedWinner : item,
    );
    const distance =
      targetIndex * CARD_WIDTH - (CONTAINER_WIDTH / 2 - CARD_WIDTH / 2);
    setStripItems(strip);
    setWinner(selectedWinner);
    setWinnerId(selectedWinner.userId);
    setAnimationX(-distance);
    setAnimationSeed((prev) => prev + 1);
    setIsSpinning(true);
    setTargetIndex(targetIndex);
    setStatus(null);
  };

  const handleValidate = async () => {
    if (!winnerId || !itemName.trim()) {
      setStatus("Sélectionnez un gagnant avant de valider.");
      return;
    }
    const winner = eligiblePlayers.find((player) => player.userId === winnerId);
    if (!winner) {
      setStatus("Gagnant introuvable.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setStatus("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setStatus(null);

    const { data: signup } = await supabase
      .from("event_signups")
      .select("guild_id")
      .eq("event_id", eventId)
      .eq("user_id", winner.userId)
      .maybeSingle();

    const { error } = await supabase.from("loot_history").insert({
      item_name: itemName,
      user_id: winner.userId,
      guild_id: signup?.guild_id ?? null,
      raid_event_id: eventId,
      loot_method: "roulette",
    });

    if (error) {
      setStatus(error.message || "Impossible de sauvegarder le loot.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setStatus("Loot enregistré avec succès.");
  };

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-surface/50 px-6 py-6 backdrop-blur">
      <header className="border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-text/50">
          Distribution
        </p>
        <h2 className="mt-2 text-xl font-semibold text-text">
          Console de Distribution de Loot
        </h2>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Sélection de l&apos;objet
          </p>
          <input
            list="loot-items"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Ex: Espadon d'Adentus"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
          />
          <datalist id="loot-items">
            {itemOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <p className="mt-3 text-xs text-text/50">
            Tapez ou choisissez un item dans la liste.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Joueurs éligibles
          </p>
          {isLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Chargement des éligibles...
            </div>
          ) : eligiblePlayers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Aucun joueur éligible pour cet item.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {eligiblePlayers.map((player) => (
                <div
                  key={player.userId}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                    player.userId === winnerId
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-black/40 text-text/70"
                  }`}
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={player.checked}
                      onChange={() => handleToggle(player.userId)}
                      className="h-4 w-4 rounded border-white/20 bg-black/40"
                    />
                    <div>
                      <div className="font-semibold text-text">
                        {player.ingameName}
                      </div>
                      <div className="text-xs text-text/50">
                        {player.role ?? "Rôle inconnu"}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stripItems.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Animation de roulette
          </p>
          <div className="mt-4 flex items-center justify-center">
            <div
              className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40"
              style={{ width: `${CONTAINER_WIDTH}px` }}
            >
              <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-amber-400/70" />
              <motion.div
                key={animationSeed}
                className="flex"
                initial={{ x: 0 }}
                animate={{ x: animationX }}
                transition={{
                  duration: 4,
                  ease: [0.1, 0.9, 0.2, 1.0],
                }}
                onAnimationComplete={() => {
                  if (!isSpinning) {
                    return;
                  }
                  setIsSpinning(false);
                  if (winner) {
                    setStatus(`Gagnant sélectionné : ${winner.ingameName}.`);
                  }
                }}
              >
                {stripItems.map((player, index) => {
                  const isWinner =
                    !isSpinning &&
                    winnerId === player.userId &&
                    index === targetIndex;
                  return (
                    <div
                      key={`${player.userId}-${index}`}
                      style={{ width: `${CARD_WIDTH}px` }}
                      className="flex h-24 items-center justify-center"
                    >
                      <div
                        className={[
                          "w-[120px] rounded-xl border px-3 py-2 text-center text-sm transition",
                          isWinner
                            ? "scale-105 border-amber-400/80 bg-amber-400/10 text-amber-100"
                            : "border-white/10 bg-black/30 text-text/60",
                        ].join(" ")}
                      >
                        <div className="font-semibold">{player.ingameName}</div>
                        <div className="text-xs text-text/40">
                          {player.role ?? "Rôle inconnu"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
          <p className="mt-3 text-xs text-text/50">
            La ligne centrale indique l&apos;arrêt de la roulette.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRoulette}
          disabled={isSpinning}
          className="rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
        >
          {isSpinning ? "Roulette en cours..." : "🎲 Lancer la Roulette"}
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!winnerId || isSaving || isSpinning}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Sauvegarde..." : "Valider & Sauvegarder"}
        </button>
        {status ? (
          <span className="text-xs text-text/60">{status}</span>
        ) : null}
      </div>
    </div>
  );
}
