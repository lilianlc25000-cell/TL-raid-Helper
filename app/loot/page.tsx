"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DiceRoller from "../components/DiceRoller";
import { getItemImage, getSlotPlaceholder } from "../../lib/items";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAdminMode } from "../contexts/AdminContext";
import {
  DEFAULT_PARTICIPATION_THRESHOLD,
  TRAITS_BY_SLOT,
} from "../../lib/game-constants";

type ActiveLootSession = {
  id: string;
  itemName: string;
  isActive: boolean;
  category: "guild_raid" | "brocante";
  customName?: string | null;
  customTraits?: string[] | null;
  rarity?: "uncommon" | "rare" | "epic" | null;
  imageUrl?: string | null;
};

type RollEntry = {
  userId: string;
  playerName: string;
  rollValue: number;
  createdAt: string;
};

type ItemCategory = "armes" | "bagues" | "bracelets" | "ceintures" | "boucles";

const weaponFiles = [
  "arbalètes_aux_carreaux_enflammés_de_malakar.png",
  "arbalètes_de_l'éclipse_de_kowazan.png",
  "arc_long_du_fléau_du_grand_aélon.png",
  "bâton_incandescent_de_talus.png",
  "bâton_noueux_immolé_d'aridus.png",
  "bouclier_de_azhreil.png",
  "dagues_d'écorchure_de_minezerok.png",
  "dagues_de_la_lune_rouge_de_kowazan.png",
  "épée_des_cendres_tombées_de_nirma.png",
  "espadon_de_la_flamme_spirituelle_de_morokai.png",
  "espadon_du_cendre_héant_d'adentus.png",
  "lame_de_cautérisation_de_tchernobog.png",
  "lame_de_la_flamme_dansante_de_cornélius.png",
  "lame_du_colosse_rouge_de_junobote.png",
  "noyau_transcendant_de_talus.png",
  "ranseur_super_brûlant_de_junobote.png",
  "spectre_radieux_de_l'excavateur.png",
];

const ringFiles = ["anneau_du_sceau_de_davinci.png", "bague_de_l'agonie_brutale.png"];

const braceletFiles = ["bracelet_de_la_brise_infini.png"];

const beltFiles = ["ceinture_du_serment_inébranlable.png"];

const earringFiles = [
  "boucles_d'oreille_d'érudit_de_vénélux.png",
  "boucles_d'oreilles_des_deux_lunes.png",
];

const toDisplayName = (filename: string) => {
  const base = filename.replace(/\.png$/i, "").replace(/_/g, " ");
  const words = base.split(" ");
  return words
    .map((word, index) => {
      if (index === 0 || index === words.length - 1) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
};

const categoryConfig: Record<
  ItemCategory,
  { label: string; files: string[]; slotName: string }
> = {
  armes: { label: "Arme", files: weaponFiles, slotName: "main_hand" },
  bagues: { label: "Anneau", files: ringFiles, slotName: "ring1" },
  bracelets: { label: "Bracelet", files: braceletFiles, slotName: "bracelet" },
  ceintures: { label: "Ceinture", files: beltFiles, slotName: "belt" },
  boucles: { label: "Boucles d'oreilles", files: earringFiles, slotName: "necklace" },
};

export default function PlayerLootPage() {
  const { isAdminMode } = useAdminMode();
  const [sessions, setSessions] = useState<ActiveLootSession[]>([]);
  const [activeTab, setActiveTab] = useState<"guild" | "brocante">("guild");
  const [eligibleItems, setEligibleItems] = useState<Set<string>>(new Set());
  const [rollsByItem, setRollsByItem] = useState<Record<string, number>>({});
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ItemCategory | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [pickerImageErrors, setPickerImageErrors] = useState<
    Record<string, boolean>
  >({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [participationPoints, setParticipationPoints] = useState<number>(0);
  const [participationThreshold, setParticipationThreshold] = useState<number>(
    DEFAULT_PARTICIPATION_THRESHOLD,
  );
  const [selectedTraitByItem, setSelectedTraitByItem] = useState<
    Record<string, string>
  >({});
  const [rollsModal, setRollsModal] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [rollsBySession, setRollsBySession] = useState<
    Record<string, RollEntry[]>
  >({});
  const [rollsLoading, setRollsLoading] = useState(false);
  const [rollsError, setRollsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
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
        setError("Veuillez vous connecter pour participer aux loots.");
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
    const loadGuildId = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id,cohesion_points")
        .eq("user_id", userId)
        .maybeSingle()) as {
        data: { guild_id?: string | null; cohesion_points?: number | null } | null;
      };
      setGuildId(profile?.guild_id ?? null);
      setParticipationPoints(profile?.cohesion_points ?? 0);
      setParticipationThreshold(DEFAULT_PARTICIPATION_THRESHOLD);
    };
    void loadGuildId();

    const loadSessions = async () => {
      setIsLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoading(false);
        return;
      }

      const { data: sessionsData, error: sessionError } = await supabase
        .from("active_loot_sessions")
        .select(
          "id,item_name,is_active,category,custom_name,custom_traits,rarity,image_url",
        )
        .eq("is_active", true);

      if (sessionError) {
        setError("Impossible de charger les sessions de loot.");
        setIsLoading(false);
        return;
      }

      const mappedSessions = (sessionsData ?? []).map((session) => ({
        id: session.id,
        itemName: session.item_name,
        isActive: session.is_active,
        category: (session.category as "guild_raid" | "brocante") ?? "guild_raid",
        customName: session.custom_name ?? null,
        customTraits: Array.isArray(session.custom_traits)
          ? (session.custom_traits as string[])
          : null,
        rarity: (session.rarity as "uncommon" | "rare" | "epic") ?? null,
        imageUrl: (session.image_url as string | null) ?? null,
      }));
      setSessions(mappedSessions);

      if (mappedSessions.length === 0) {
        setEligibleItems(new Set());
        setRollsByItem({});
        setIsLoading(false);
        return;
      }

      const guildSessions = mappedSessions.filter(
        (session) => session.category !== "brocante",
      );
      const itemNames = guildSessions.map((session) => session.itemName);
      const sessionIds = mappedSessions.map((session) => session.id);

      const { data: wishlistData } =
        itemNames.length > 0
          ? await supabase
              .from("gear_wishlist")
              .select("item_name,item_priority")
              .eq("user_id", userId)
              .eq("item_priority", 1)
              .in("item_name", itemNames)
          : { data: [] };

      const eligibleSet = new Set(
        (wishlistData ?? []).map((entry) => entry.item_name),
      );
      setEligibleItems(eligibleSet);

      const { data: rollsData } =
        sessionIds.length > 0
          ? await supabase
              .from("loot_rolls")
              .select("loot_session_id,roll_value")
              .eq("user_id", userId)
              .in("loot_session_id", sessionIds)
          : { data: [] };

      const rollMap: Record<string, number> = {};
      (rollsData ?? []).forEach((roll) => {
        if (!roll.loot_session_id) {
          return;
        }
        rollMap[roll.loot_session_id] = roll.roll_value;
      });
      setRollsByItem(rollMap);
      setIsLoading(false);
    };

    loadSessions();
  }, [userId]);

  useEffect(() => {
    if (!guildId) {
      return;
    }
    const loadThreshold = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }
      const { data } = await supabase
        .from("guild_settings")
        .select("participation_threshold")
        .eq("guild_id", guildId)
        .maybeSingle();
      setParticipationThreshold(
        data?.participation_threshold ?? DEFAULT_PARTICIPATION_THRESHOLD,
      );
    };
    void loadThreshold();
  }, [guildId]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    const normalized = itemSearch.trim().toLowerCase();
    return categoryConfig[selectedCategory].files
      .map((file) => ({
        file,
        name: toDisplayName(file),
      }))
      .filter((item) =>
        normalized ? item.name.toLowerCase().includes(normalized) : true,
      );
  }, [selectedCategory, itemSearch]);

  const handlePublishLoot = async (itemName: string, slotName: string) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    if (!guildId) {
      setError("Aucune guilde active.");
      return;
    }
    await supabase.from("active_loot_sessions").insert({
      item_name: itemName,
      is_active: true,
      guild_id: guildId,
    });
    setIsPickerOpen(false);
    setSelectedCategory(null);
    setItemSearch("");
    setPickerImageErrors({});
    const { data: sessionsData } = await supabase
      .from("active_loot_sessions")
      .select(
        "id,item_name,is_active,category,custom_name,custom_traits,rarity,image_url",
      )
      .eq("is_active", true);
    const mappedSessions = (sessionsData ?? []).map((session) => ({
      id: session.id,
      itemName: session.item_name,
      isActive: session.is_active,
      category: (session.category as "guild_raid" | "brocante") ?? "guild_raid",
      customName: session.custom_name ?? null,
      customTraits: Array.isArray(session.custom_traits)
        ? (session.custom_traits as string[])
        : null,
      rarity: (session.rarity as "uncommon" | "rare" | "epic") ?? null,
      imageUrl: (session.image_url as string | null) ?? null,
    }));
    setSessions(mappedSessions);
  };

  const handleSubmitRoll = async (rollValue: number) => {
    if (!selectedItem || !userId) {
      return;
    }
    const session = sessions.find((item) => item.id === selectedItem.id);
    const isBrocante = session?.category === "brocante";
    const hasWishlist = eligibleItems.has(selectedItem.name);
    const hasEnoughPoints = participationPoints >= participationThreshold;
    if (!isBrocante && (!hasWishlist || !hasEnoughPoints)) {
      setError(
        !hasWishlist
          ? "Non éligible : l'objet n'est pas dans votre wishlist."
          : "Non éligible : pas assez de points de participation.",
      );
      setSelectedItem(null);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setSelectedItem(null);
      return;
    }
    if (!guildId) {
      setError("Aucune guilde active.");
      return;
    }
    await supabase.from("loot_rolls").insert({
      user_id: userId,
      guild_id: guildId,
      item_name: selectedItem.name,
      roll_value: rollValue,
      loot_session_id: selectedItem.id,
    });
    setRollsByItem((prev) => ({ ...prev, [selectedItem.id]: rollValue }));
    setSelectedItem(null);
  };

  const handleAddTrait = async (session: ActiveLootSession) => {
    const trait = selectedTraitByItem[session.id];
    if (!trait) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const existing = Array.isArray(session.customTraits)
      ? session.customTraits
      : [];
    if (existing.includes(trait)) {
      return;
    }
    const nextTraits = [...existing, trait];
    const { error: updateError } = await supabase
      .from("active_loot_sessions")
      .update({ custom_traits: nextTraits })
      .eq("id", session.id);
    if (updateError) {
      setError(
        `Impossible d'ajouter le trait: ${updateError.message || "Erreur inconnue."}`,
      );
      return;
    }
    setSessions((prev) =>
      prev.map((item) =>
        item.id === session.id ? { ...item, customTraits: nextTraits } : item,
      ),
    );
    setSelectedTraitByItem((prev) => ({ ...prev, [session.id]: "" }));
  };

  const loadRolls = async (session: ActiveLootSession, title: string) => {
    if (!userId) {
      return;
    }
    setRollsError(null);
    setRollsModal({ id: session.id, title });
    if (rollsBySession[session.id]) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setRollsError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setRollsLoading(true);
    const { data, error: fetchError } = (await supabase
      .from("loot_rolls")
      .select("user_id,roll_value,created_at")
      .eq("loot_session_id", session.id)) as {
      data:
        | Array<{
            user_id: string;
            roll_value: number;
            created_at: string;
          }>
        | null;
      error: { message?: string } | null;
    };
    if (fetchError) {
      setRollsError(fetchError.message || "Impossible de charger les rolls.");
      setRollsLoading(false);
      return;
    }
    const rows = data ?? [];
    const userIds = rows.map((row) => row.user_id).filter(Boolean);
    const { data: profilesData } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id,ingame_name")
          .in("user_id", userIds)
      : { data: [] };
    const nameMap = new Map(
      (profilesData ?? []).map((profile) => [profile.user_id, profile.ingame_name]),
    );
    const rolls = rows
      .map((row) => ({
        userId: row.user_id,
        playerName: nameMap.get(row.user_id) ?? "Membre",
        rollValue: row.roll_value,
        createdAt: row.created_at,
      }))
      .sort((a, b) => b.rollValue - a.rollValue);
    setRollsBySession((prev) => ({ ...prev, [session.id]: rolls }));
    setRollsLoading(false);
  };

  const guildSessions = sessions.filter(
    (session) => session.category !== "brocante",
  );
  const brocanteSessions = sessions.filter(
    (session) => session.category === "brocante",
  );
  const activeItems = activeTab === "brocante" ? brocanteSessions : guildSessions;
  const hasActiveSessions = activeItems.length > 0;

  const rarityStyles: Record<
    "uncommon" | "rare" | "epic",
    { card: string; title: string; border: string; glow: string; badge: string }
  > = {
    uncommon: {
      card: "from-emerald-950/80 via-emerald-950/40 to-zinc-950/80",
      title: "text-emerald-200",
      border: "border-emerald-500/40",
      glow: "shadow-[0_0_35px_rgba(16,185,129,0.25)]",
      badge: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
    },
    rare: {
      card: "from-sky-950/80 via-sky-950/40 to-zinc-950/80",
      title: "text-sky-200",
      border: "border-sky-500/40",
      glow: "shadow-[0_0_35px_rgba(59,130,246,0.28)]",
      badge: "border-sky-400/50 bg-sky-500/10 text-sky-200",
    },
    epic: {
      card: "from-violet-900/70 via-violet-900/40 to-zinc-950/80",
      title: "text-violet-100",
      border: "border-violet-400/60",
      glow: "shadow-[0_0_45px_rgba(168,85,247,0.35)]",
      badge: "border-violet-400/40 bg-violet-500/10 text-violet-100",
    },
  };

  const getRarityConfig = (rarity?: ActiveLootSession["rarity"]) =>
    rarity && rarityStyles[rarity] ? rarityStyles[rarity] : rarityStyles.epic;

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-5 py-5 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-6">
        <p className="text-xs uppercase tracking-[0.25em] text-text/60 sm:tracking-[0.4em]">
          Live Loot
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-text sm:text-3xl sm:tracking-[0.15em]">
          Salle du butin
        </h1>
        <p className="mt-2 text-sm text-text/60">
          Choisissez un onglet pour accéder aux loots de raid ou à la brocante.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
      </header>

      <section className="mt-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "guild", label: "🏛️ Trésor de Guilde" },
            { key: "brocante", label: "⚖️ La Brocante" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "guild" | "brocante")}
              className={[
                "rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition sm:text-xs sm:tracking-[0.25em]",
                activeTab === tab.key
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-surface/60 text-text/50 hover:border-amber-400/40 hover:text-amber-100",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isAdminMode ? (
          <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-zinc-950 to-black/80 px-6 py-6 shadow-[0_0_35px_rgba(251,191,36,0.18)] backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70 sm:tracking-[0.3em]">
                  Mode Admin
                </p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-100">
                  Sélection de l&apos;item
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="w-full rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 sm:w-auto"
              >
                Ajouter un loot
              </button>
            </div>

            <div className="mt-5">
              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                  Aucun loot publié pour le moment.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-200"
                    >
                      <span className="min-w-0 truncate">{session.itemName}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
                        Actif
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-8 text-sm text-text/60">
            Chargement des distributions...
          </div>
        ) : !hasActiveSessions ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-8 text-sm text-text/60">
            {activeTab === "brocante"
              ? "Aucune brocante ouverte actuellement."
              : "Aucune distribution de loot en cours."}
          </div>
        ) : (
          activeItems.map((session) => {
            const isBrocante = session.category === "brocante";
            const hasEnoughPoints = participationPoints >= participationThreshold;
            const isEligible = isBrocante
              ? true
              : eligibleItems.has(session.itemName) && hasEnoughPoints;
            const rollResult = rollsByItem[session.id];
            const title = session.customName?.trim() || session.itemName;
            const rarityConfig = isBrocante ? getRarityConfig("epic") : null;
            const traits =
              session.customTraits?.filter((trait) => Boolean(trait)) ?? [];
            const allTraits = Array.from(
              new Map(
                Object.values(TRAITS_BY_SLOT)
                  .flat()
                  .map((trait) => [trait.trim().toLowerCase(), trait.trim()]),
              ).values(),
            ).sort((a, b) => a.localeCompare(b, "fr"));
            const selectedTrait = selectedTraitByItem[session.id] ?? "";
            return (
              <div
                key={session.id}
                className={[
                  "group rounded-3xl border bg-gradient-to-br px-5 py-6 backdrop-blur transition hover:scale-[1.01] sm:px-6",
                  isBrocante
                    ? [
                        rarityConfig?.border,
                        rarityConfig?.card,
                        "shadow-[0_0_10px_rgba(168,85,247,0.18)]",
                        "animate-[brocante-glow_6s_ease-in-out_infinite]",
                      ].join(" ")
                    : "border-white/10 from-zinc-900/70 via-zinc-950 to-black/80 shadow-[0_0_35px_rgba(124,58,237,0.15)]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/40 shadow-[0_0_25px_rgba(251,191,36,0.15)]">
                    <Image
                      src={
                        imageErrors[session.itemName]
                          ? getSlotPlaceholder("main_hand")
                          : session.imageUrl || getItemImage(session.itemName)
                      }
                      alt={title}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-md object-contain transition group-hover:scale-105"
                      unoptimized
                      onError={() =>
                        setImageErrors((prev) => ({
                          ...prev,
                          [session.itemName]: true,
                        }))
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.25em] text-text/50 sm:tracking-[0.3em]">
                      {isBrocante ? "La Brocante" : "Loot publié"}
                    </p>
                    <h2
                      className={[
                        "mt-2 break-words text-2xl font-semibold",
                        isBrocante
                          ? `font-serif ${rarityConfig?.title}`
                          : "text-text",
                      ].join(" ")}
                    >
                      {title}
                    </h2>
                    {isBrocante ? (
                      <div className="mt-3 space-y-2 text-sm text-zinc-200">
                        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-zinc-200/80">
                          <span className="text-amber-200/80">
                            Free For All - Ouvert à tous
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {traits.length > 0 ? (
                            traits.map((trait, index) => (
                              <div
                                key={`${session.id}-trait-${index}`}
                                className="text-amber-100/90"
                              >
                                <span className="text-zinc-100">{trait}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                              <span>Aucun trait renseigné.</span>
                              <select
                                value={selectedTrait}
                                onChange={(event) =>
                                  setSelectedTraitByItem((prev) => ({
                                    ...prev,
                                    [session.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200 sm:w-auto"
                              >
                                <option value="">Choisir un trait</option>
                                {allTraits.map((trait) => (
                                  <option key={`${session.id}-${trait}`} value={trait}>
                                    {trait}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAddTrait(session)}
                                disabled={!selectedTrait}
                                className="w-full rounded-full border border-amber-400/60 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                              >
                                Ajouter
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                    {typeof rollResult === "number" ? (
                      <div className="w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 sm:w-auto">
                        Votre résultat :{" "}
                        <span className="font-mono text-lg">
                          {rollResult}
                        </span>
                        <div className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-100/80">
                          En attente de validation
                        </div>
                      </div>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItem({ id: session.id, name: session.itemName })
                        }
                        className="w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 px-6 py-3 text-xs uppercase tracking-[0.2em] text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.35)] transition hover:border-amber-300 hover:text-amber-100 sm:w-auto sm:tracking-[0.3em]"
                      >
                        ROLL
                      </button>
                    ) : (
                      <div className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-text/50 sm:w-auto">
                        {eligibleItems.has(session.itemName)
                          ? `Non éligible (${participationThreshold} point${
                              participationThreshold > 1 ? "s" : ""
                            } requis)`
                          : "Non éligible (pas dans votre Wishlist)"}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => loadRolls(session, title)}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-text/70 transition hover:border-amber-400/40 hover:text-amber-100 sm:w-auto"
                    >
                      Voir les rolls
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <DiceRoller
        isOpen={Boolean(selectedItem)}
        itemName={selectedItem?.name ?? ""}
        playerName="Vous"
        requestId={selectedItem?.id ?? undefined}
        onClose={() => setSelectedItem(null)}
        onSubmitRoll={handleSubmitRoll}
      />

      {rollsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface/90 p-6 text-zinc-100 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Rolls
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  {rollsModal.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRollsModal(null);
                  setRollsError(null);
                }}
                className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {rollsError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {rollsError}
                </div>
              ) : rollsLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                  Chargement des rolls...
                </div>
              ) : (rollsBySession[rollsModal.id] ?? []).length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/60">
                  Aucun roll pour le moment.
                </div>
              ) : (
                (rollsBySession[rollsModal.id] ?? []).map((roll, index) => (
                  <div
                    key={`${roll.userId}-${roll.createdAt}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-text/40">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-text">
                        {roll.playerName}
                      </span>
                    </div>
                    <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 font-mono text-sm text-amber-200">
                      {roll.rollValue}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-surface/90 p-5 text-zinc-100 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50 sm:tracking-[0.3em]">
                  Ajout de loot
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  {selectedCategory
                    ? `Choisir un item : ${categoryConfig[selectedCategory].label}`
                    : "Choisir une catégorie"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPickerOpen(false);
                  setSelectedCategory(null);
                  setItemSearch("");
                  setPickerImageErrors({});
                }}
                className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            {!selectedCategory ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(Object.keys(categoryConfig) as ItemCategory[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left text-sm text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-100"
                  >
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Catégorie
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-100">
                      {categoryConfig[key].label}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Rechercher un item..."
                    className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(null);
                      setItemSearch("");
                    }}
                    className="text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-amber-200"
                  >
                    Changer de catégorie
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {filteredItems.map((item) => (
                    <button
                      key={item.file}
                      type="button"
                      onClick={() =>
                        handlePublishLoot(
                          item.name,
                          categoryConfig[selectedCategory].slotName,
                        )
                      }
                      className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left text-sm text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-100"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-black/60">
                        <Image
                          src={
                            pickerImageErrors[item.file]
                              ? getSlotPlaceholder(
                                  categoryConfig[selectedCategory].slotName,
                                )
                              : getItemImage(
                                  item.name,
                                  categoryConfig[selectedCategory].slotName,
                                )
                          }
                          alt={item.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 object-contain"
                          unoptimized
                          onError={() =>
                            setPickerImageErrors((prev) => ({
                              ...prev,
                              [item.file]: true,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {categoryConfig[selectedCategory].label}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
