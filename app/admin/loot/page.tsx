"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import ItemSelector, { ItemOption } from "../../components/ItemSelector";
import BrocanteCreator from "../../../components/BrocanteCreator";
import { getItemImage, getSlotPlaceholder } from "../../../lib/items";
import {
  gameItemCategories,
  gameItemsByCategory,
  type GameItemCategory,
} from "../../../lib/game-items";
import { createClient } from "../../../lib/supabase/client";

type LootQueueItem = {
  id: string;
  itemName: string;
  isActive: boolean;
  imageUrl?: string | null;
  category?: "guild_raid" | "brocante" | null;
};

type WishlistCandidate = {
  userId: string;
  ingameName: string;
  cohesionPoints: number;
  lootReceivedCount: number;
  itemPriority: number | null;
  slotName: string | null;
  rollValue?: number;
  requestCreatedAt?: string | null;
};

type AssignmentState = {
  loot: LootQueueItem;
  candidates: WishlistCandidate[];
  isLoading: boolean;
  error: string | null;
};

const emptyAssignment: AssignmentState = {
  loot: { id: "", itemName: "", isActive: false },
  candidates: [],
  isLoading: false,
  error: null,
};


const mapGameItemsToOptions = (
  items: (typeof gameItemsByCategory)[GameItemCategory],
) =>
  items.map(
    (item): ItemOption => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      slot: item.category,
    }),
  );

export default function LootDistributionPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"catalogue" | "brocante">(
    "catalogue",
  );
  const [queue, setQueue] = useState<LootQueueItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<GameItemCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [assignment, setAssignment] = useState<AssignmentState>(emptyAssignment);
  const [currentGuildId, setCurrentGuildId] = useState<string | null>(null);
  const [rollCountsByLootId, setRollCountsByLootId] = useState<
    Record<string, number>
  >({});
  const [lootSystem, setLootSystem] = useState<
    "fcfs" | "roll" | "council"
  >("council");

  const loadAdminRole = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setAuthError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsAuthReady(true);
      return;
    }
    setAuthError(null);
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
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
    setCurrentGuildId(profile?.guild_id ?? null);
    setIsAdmin(
      profile?.role_rank === "admin" || profile?.role_rank === "conseiller",
    );
    setIsAuthReady(true);
  }, []);

  const loadQueue = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setQueueError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    if (!currentGuildId) {
      setQueue([]);
      setIsQueueLoading(false);
      return;
    }
    setIsQueueLoading(true);
    setQueueError(null);
    const { data, error } = await supabase
      .from("active_loot_sessions")
      .select("id,item_name,is_active,image_url,category")
      .eq("guild_id", currentGuildId)
      .order("id", { ascending: false });
    if (error) {
      setQueueError(
        `Impossible de charger la file de loots: ${error.message || "Erreur inconnue."}`,
      );
      setIsQueueLoading(false);
      return;
    }
    const mapped = (data ?? [])
      .map((row) => ({
        id: row.id,
        itemName: row.item_name,
        isActive: row.is_active,
        imageUrl: (row as { image_url?: string | null }).image_url ?? null,
        category: (row as { category?: "guild_raid" | "brocante" | null })
          .category,
      }))
      .filter((row) => Boolean(row.id));
    setQueue(mapped);
    if (mapped.length > 0) {
      const sessionIds = mapped.map((row) => row.id);
      const { data: rollsData } = await supabase
        .from("loot_rolls")
        .select("loot_session_id,roll_value")
        .in("loot_session_id", sessionIds);
      const counts: Record<string, number> = {};
      (rollsData ?? []).forEach((row) => {
        const id = row.loot_session_id as string | null;
        if (!id) {
          return;
        }
        const isRoll = (row as { roll_value?: number | null }).roll_value ?? 0;
        if (lootSystem === "roll") {
          if (isRoll > 0) {
            counts[id] = (counts[id] ?? 0) + 1;
          }
        } else if (isRoll === 0) {
          counts[id] = (counts[id] ?? 0) + 1;
        }
      });
      setRollCountsByLootId(counts);
    } else {
      setRollCountsByLootId({});
    }
    setIsQueueLoading(false);
  }, [currentGuildId, lootSystem]);

  useEffect(() => {
    if (!currentGuildId) {
      return;
    }
    const loadLootSystem = async () => {
      const supabase = createClient();
      if (!supabase) {
        return;
      }
      const { data: guild } = await supabase
        .from("guilds")
        .select("owner_id")
        .eq("id", currentGuildId)
        .maybeSingle();
      if (!guild?.owner_id) {
        setLootSystem("council");
        return;
      }
      const { data: config } = await supabase
        .from("guild_configs")
        .select("loot_system")
        .eq("owner_id", guild.owner_id)
        .maybeSingle();
      const system =
        (config?.loot_system as "fcfs" | "roll" | "council" | null) ??
        "council";
      setLootSystem(system);
    };
    void loadLootSystem();
  }, [currentGuildId]);

  const openAddModal = () => {
    setSelectedCategory(null);
    setSelectedItem(null);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setSelectedCategory(null);
    setSelectedItem(null);
  };

  const handleAddLoot = async () => {
    if (!selectedItem) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setQueueError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    if (!currentGuildId) {
      setQueueError("Aucune guilde active.");
      return;
    }
    setIsAdding(true);
    const { error } = await supabase.from("active_loot_sessions").insert({
      item_name: selectedItem.name,
      is_active: false,
      guild_id: currentGuildId,
    });
    if (error) {
      setQueueError(
        `Impossible d'ajouter le loot: ${error.message || "Erreur inconnue."}`,
      );
      setIsAdding(false);
      return;
    }
    setIsAdding(false);
    closeAddModal();
    await loadQueue();
  };

  const handleOpenRolls = async (lootId: string) => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    await supabase
      .from("active_loot_sessions")
      .update({ is_active: true })
      .eq("id", lootId);
    await loadQueue();


  };

  const handleDeleteLoot = async (lootId: string) => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("active_loot_sessions")
      .delete()
      .eq("id", lootId);
    if (error) {
      setQueueError(
        `Impossible de supprimer le loot: ${error.message || "Erreur inconnue."}`,
      );
      return;
    }
    await loadQueue();
  };

  const loadCandidates = useCallback(async (loot: LootQueueItem) => {
    const supabase = createClient();
    if (!supabase) {
      setAssignment((prev) => ({
        ...prev,
        isLoading: false,
        error: "Supabase n'est pas configuré (URL / ANON KEY).",
      }));
      return;
    }
    setAssignment({ loot, candidates: [], isLoading: true, error: null });
    const { data: rollsData, error: rollsError } = (await supabase
      .from("loot_rolls")
      .select("user_id,roll_value,created_at")
      .eq("loot_session_id", loot.id)) as {
      data:
        | Array<{
            user_id: string;
            roll_value: number;
            created_at: string;
          }>
        | null;
      error: { message?: string } | null;
    };
    if (rollsError) {
      setAssignment({
        loot,
        candidates: [],
        isLoading: false,
        error: "Impossible de récupérer les demandes.",
      });
      return;
    }
    const isRollMode = lootSystem === "roll";
    const filteredRolls = (rollsData ?? []).filter((roll) =>
      isRollMode ? roll.roll_value > 0 : roll.roll_value === 0,
    );
    const userIds = Array.from(
      new Set(filteredRolls.map((roll) => roll.user_id).filter(Boolean)),
    );
    if (userIds.length === 0) {
      setAssignment({
        loot,
        candidates: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    const { data: profilesData } = (await supabase
      .from("profiles")
      .select("user_id,ingame_name,cohesion_points,loot_received_count")
      .in("user_id", userIds)) as {
      data:
        | Array<{
            user_id: string;
            ingame_name: string;
            cohesion_points: number;
            loot_received_count: number;
          }>
        | null;
    };

    const { data: wishlistData } = (await supabase
      .from("gear_wishlist")
      .select("user_id,item_priority,slot_name")
      .eq("item_name", loot.itemName)
      .in("user_id", userIds)) as {
      data:
        | Array<{
            user_id: string;
            item_priority: number;
            slot_name: string;
          }>
        | null;
    };

    const profileMap = new Map(
      (profilesData ?? []).map((profile) => [profile.user_id, profile]),
    );
    const wishlistMap = new Map(
      (wishlistData ?? []).map((row) => [row.user_id, row]),
    );

    const mapped = filteredRolls.map((roll) => {
      const profile = profileMap.get(roll.user_id);
      const wishlist = wishlistMap.get(roll.user_id);
      return {
        userId: roll.user_id,
        ingameName: profile?.ingame_name ?? "Inconnu",
        cohesionPoints: profile?.cohesion_points ?? 0,
        lootReceivedCount: profile?.loot_received_count ?? 0,
        itemPriority: wishlist?.item_priority ?? null,
        slotName: wishlist?.slot_name ?? null,
        rollValue: isRollMode ? roll.roll_value : undefined,
        requestCreatedAt: roll.created_at ?? null,
      };
    });
    setAssignment({
      loot,
      candidates: mapped,
      isLoading: false,
      error: null,
    });
  }, [lootSystem]);

  const handleAssign = async (candidate: WishlistCandidate) => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    if (assignment.loot.category !== "brocante") {
      await supabase
        .from("profiles")
        .update({
          loot_received_count: candidate.lootReceivedCount + 1,
        })
        .eq("user_id", candidate.userId);
    }
    await supabase
      .from("active_loot_sessions")
      .delete()
      .eq("id", assignment.loot.id);
    setAssignment(emptyAssignment);
    await loadQueue();
  };

  useEffect(() => {
    loadAdminRole();
    loadQueue();
  }, [loadAdminRole, loadQueue]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const channel = supabase
      .channel("loot-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_loot_sessions" },
        () => {
          void loadQueue();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadQueue]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadAdminRole();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadAdminRole]);

  const filteredQueue = useMemo(() => {
    if (activeTab === "brocante") {
      return queue.filter((loot) => loot.category === "brocante");
    }
    return queue.filter((loot) => loot.category !== "brocante");
  }, [activeTab, queue]);

  const pendingLoots = useMemo(
    () => filteredQueue.filter((loot) => !loot.isActive),
    [filteredQueue],
  );
  const activeLoots = useMemo(
    () => filteredQueue.filter((loot) => loot.isActive),
    [filteredQueue],
  );
  const sortedActiveLoots = useMemo(() => {
    return [...activeLoots].sort(
      (a, b) =>
        (rollCountsByLootId[b.id] ?? 0) - (rollCountsByLootId[a.id] ?? 0),
    );
  }, [activeLoots, rollCountsByLootId]);

  const selectedCategoryConfig = selectedCategory
    ? gameItemCategories.find((category) => category.key === selectedCategory)
    : null;

  const availableItems = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    return mapGameItemsToOptions(gameItemsByCategory[selectedCategory]);
  }, [selectedCategory]);

  const sortedCandidates = useMemo(() => {
    const isRollMode = lootSystem === "roll";
    const isBrocante = assignment.loot.category === "brocante";
    return [...assignment.candidates].sort((a, b) => {
      if (isRollMode) {
        const rollA = a.rollValue ?? 0;
        const rollB = b.rollValue ?? 0;
        if (rollA !== rollB) {
          return rollB - rollA;
        }
        const lootDiff = a.lootReceivedCount - b.lootReceivedCount;
        if (lootDiff !== 0) {
          return lootDiff;
        }
        return b.cohesionPoints - a.cohesionPoints;
      }

      if (isBrocante) {
        const dateA = a.requestCreatedAt
          ? new Date(a.requestCreatedAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const dateB = b.requestCreatedAt
          ? new Date(b.requestCreatedAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      }

      const priorityA = a.itemPriority ?? 99;
      const priorityB = b.itemPriority ?? 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const lootDiff = a.lootReceivedCount - b.lootReceivedCount;
      if (lootDiff !== 0) {
        return lootDiff;
      }
      return b.cohesionPoints - a.cohesionPoints;
    });
  }, [assignment.candidates, assignment.loot.category, lootSystem]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Chargement du profil...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            File d&apos;attente des loots
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
            Distribution de Loots
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {authError
              ? authError
              : "Ajoutez des objets et ouvrez les rolls au moment voulu."}
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "catalogue", label: "Catalogue de Raid" },
            { key: "brocante", label: "Catalogue de Brocante" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "catalogue" | "brocante")}
              className={[
                "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition",
                activeTab === tab.key
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-amber-400/40 hover:text-amber-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "brocante" ? (
          <BrocanteCreator isAdmin={isAdmin} onCreated={loadQueue} />
        ) : null}
        {activeTab === "catalogue" ? (
          isAdmin ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Commandes admin
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ajoutez un loot, ouvrez la distribution ou attribuez-le.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="rounded-md border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
                >
                  Ajouter un loot à distribuer
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-900 bg-zinc-950/50 px-6 py-5 text-sm text-zinc-500">
              Zone réservée aux officiers. Vous pouvez uniquement voir les loots
              en cours de distribution.
            </div>
          )
        ) : null}

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
            <span>Loots ouverts</span>
            <span className="font-mono text-zinc-400">
              {activeLoots.length.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {sortedActiveLoots.length === 0 ? (
              <div className="rounded-md border border-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
                Aucun loot actif.
              </div>
            ) : (
              sortedActiveLoots.map((loot) => {
                const imageSrc = imageErrors[loot.id]
                  ? getSlotPlaceholder("main_hand")
                  : loot.imageUrl || getItemImage(loot.itemName);
                return (
                  <div
                    key={loot.id}
                    className="flex flex-col gap-3 rounded-md border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70">
                        <Image
                          src={imageSrc}
                          alt={loot.itemName}
                          width={88}
                          height={88}
                          className="h-[88px] w-[88px] rounded-xl object-contain"
                          unoptimized
                          onError={() =>
                            setImageErrors((prev) => ({
                              ...prev,
                              [loot.id]: true,
                            }))
                          }
                        />
                      </div>
                        <div>
                        <div className="text-base font-medium text-zinc-100">
                          {loot.itemName}
                        </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300">
                            <span>
                              {lootSystem === "roll"
                                ? "Rolls ouverts"
                                : "Demandes ouvertes"}
                            </span>
                            <span className="rounded-full border border-emerald-400/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                              {(rollCountsByLootId[loot.id] ?? 0).toString()}{" "}
                              {lootSystem === "roll" ? "rolls" : "demandes"}
                            </span>
                          </div>
                      </div>
                    </div>
                    {isAdmin ? (
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          onClick={() => loadCandidates(loot)}
                          className="w-full rounded-md border border-emerald-600 bg-emerald-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500 sm:w-auto"
                        >
                          Attribuer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLoot(loot.id)}
                          className="w-full rounded-md border border-red-500/60 bg-red-950/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-400 sm:w-auto"
                        >
                          Supprimer
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {isAdmin ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-5">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
              <span>Loots en attente</span>
              <span className="font-mono text-zinc-400">
                {pendingLoots.length.toString().padStart(2, "0")}
              </span>
            </div>
            {isQueueLoading ? (
              <div className="rounded-md border border-zinc-900 px-4 py-6 text-sm text-zinc-500">
                Chargement...
              </div>
            ) : queueError ? (
              <div className="rounded-md border border-red-500/40 bg-red-950/30 px-4 py-6 text-sm text-red-200">
                {queueError}
              </div>
            ) : pendingLoots.length === 0 ? (
              <div className="rounded-md border border-zinc-900 px-4 py-6 text-sm text-zinc-500">
                Aucun loot en attente.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingLoots.map((loot) => {
                  const imageSrc = imageErrors[loot.id]
                    ? getSlotPlaceholder("main_hand")
                    : loot.imageUrl || getItemImage(loot.itemName);
                  return (
                    <div
                      key={loot.id}
                      className="flex flex-col gap-3 rounded-md border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70">
                          <Image
                            src={imageSrc}
                            alt={loot.itemName}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-md object-contain"
                            unoptimized
                            onError={() =>
                              setImageErrors((prev) => ({
                                ...prev,
                                [loot.id]: true,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-100">
                            {loot.itemName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            En attente de publication
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenRolls(loot.id)}
                          className="w-full rounded-md border border-sky-500/60 bg-sky-950/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-400 sm:w-auto"
                        >
                          {lootSystem === "roll"
                            ? "Ouvrir les rolls"
                            : "Ouvrir la distribution"}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadCandidates(loot)}
                          className="w-full rounded-md border border-emerald-600 bg-emerald-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500 sm:w-auto"
                        >
                          Attribuer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLoot(loot.id)}
                          className="w-full rounded-md border border-red-500/60 bg-red-950/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-400 sm:w-auto"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Sélection
                </p>
                <h2 className="text-xl font-semibold text-zinc-100">
                  Ajouter un loot à distribuer
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {gameItemCategories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category.key);
                    setSelectedItem(null);
                  }}
                  className={[
                    "rounded-xl border px-4 py-3 text-left text-sm transition",
                    selectedCategory === category.key
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-100"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-amber-400/40",
                  ].join(" ")}
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Catégorie
                  </div>
                  <div className="mt-2 text-lg font-semibold text-zinc-100">
                    {category.label}
                  </div>
                </button>
              ))}
            </div>

            {selectedCategory && selectedCategoryConfig ? (
              <div className="mt-6">
                <ItemSelector
                  slotName={selectedCategoryConfig.label}
                  slotKey={selectedCategoryConfig.slotKey}
                  items={availableItems}
                  onSelect={(item) => setSelectedItem(item)}
                />
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {selectedItem
                  ? `Sélectionné : ${selectedItem.name}`
                  : "Choisissez un item à publier."}
              </p>
              <button
                type="button"
                onClick={handleAddLoot}
                disabled={!selectedItem || isAdding}
                className="rounded-md border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignment.loot.id ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Attribution
                </p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-100">
                  Attribuer {assignment.loot.itemName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAssignment(emptyAssignment)}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4">
              {assignment.isLoading ? (
                <div className="rounded-md border border-zinc-900 px-4 py-6 text-sm text-zinc-500">
                  Chargement des candidats...
                </div>
              ) : assignment.error ? (
                <div className="rounded-md border border-red-500/40 bg-red-950/30 px-4 py-6 text-sm text-red-200">
                  {assignment.error}
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="rounded-md border border-zinc-900 px-4 py-6 text-sm text-zinc-500">
                  {lootSystem === "roll"
                    ? "Aucun roll pour cet item."
                    : "Aucune demande pour cet item."}
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedCandidates.map((candidate) => (
                    <div
                      key={candidate.userId}
                      className="flex flex-col gap-3 rounded-md border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold text-zinc-100">
                          {candidate.ingameName}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {candidate.lootReceivedCount} loots reçus ·{" "}
                          {candidate.cohesionPoints} points de participation
                        </div>
                        {candidate.itemPriority ? (
                          <div className="text-xs text-emerald-300">
                            ✅ Wishlist · Priorité {candidate.itemPriority}
                          </div>
                        ) : assignment.loot.category !== "brocante" ? (
                          <div className="text-xs text-amber-300">
                            ⚠️ Pas dans la wishlist
                          </div>
                        ) : null}
                      </div>
                      {candidate.rollValue !== undefined ? (
                        <span className="rounded-full border border-amber-400/60 bg-amber-950/40 px-3 py-1 text-sm font-semibold text-amber-200">
                          🎲 {candidate.rollValue}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleAssign(candidate)}
                        className="rounded-md border border-emerald-600 bg-emerald-950 px-3 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500"
                      >
                        Attribuer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
