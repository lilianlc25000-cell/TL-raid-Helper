"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gameItemsByCategory } from "@/lib/game-items";

type EligiblePlayer = {
  userId: string;
  ingameName: string;
  role: string | null;
  score: number;
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

const scoreBadgeStyle = (score: number) => {
  if (score === 0) return "border-emerald-400/60 bg-emerald-500/10 text-emerald-200";
  if (score === 1) return "border-amber-400/60 bg-amber-500/10 text-amber-200";
  return "border-red-400/60 bg-red-500/10 text-red-200";
};

export default function LootDistributor() {
  const params = useParams();
  const eventId = String(params?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

      const { data: historyRows } = guildId
        ? await supabase
            .from("loot_history")
            .select("user_id")
            .eq("guild_id", guildId)
            .in("user_id", Array.from(eligibleIds))
        : { data: [] };

      const scoreByUser = new Map<string, number>();
      (historyRows ?? []).forEach((row) => {
        const current = scoreByUser.get(row.user_id) ?? 0;
        scoreByUser.set(row.user_id, current + 1);
      });

      const mapped = Array.from(eligibleIds)
        .map((userId) => {
          const details = participantByUser.get(userId);
          const profile = details?.profile;
          const role = getEffectiveRole(details?.assignedRole ?? null, profile?.role ?? null);
          return {
            userId,
            ingameName: profile?.ingame_name ?? "Inconnu",
            role,
            score: scoreByUser.get(userId) ?? 0,
            checked: true,
          };
        })
        .sort((a, b) => a.score - b.score);

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
    const winner =
      candidates[Math.floor(Math.random() * candidates.length)];
    setWinnerId(winner.userId);
    setStatus(`Gagnant sélectionné : ${winner.ingameName}.`);
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

    setEligiblePlayers((prev) =>
      prev.map((player) =>
        player.userId === winner.userId
          ? { ...player, score: player.score + 1 }
          : player,
      ),
    );
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
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${scoreBadgeStyle(
                      player.score,
                    )}`}
                  >
                    Score {player.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRoulette}
          className="rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
        >
          🎲 Lancer la Roulette
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={isSaving}
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
