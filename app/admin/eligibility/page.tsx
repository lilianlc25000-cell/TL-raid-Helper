"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { usePermission } from "../../../lib/hooks/usePermission";

type WeaponOption = {
  name: string;
  imageUrl: string;
  wishlistName: string;
};

type EligibleMember = {
  userId: string;
  ingameName: string;
  lootCount: number;
  participationPoints: number;
  activityPoints: number;
};

type EligibilityCriteria =
  | "loot_received"
  | "participation_points"
  | "activity_points";

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

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export default function EligibilityDashboardPage() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [weaponOptions, setWeaponOptions] = useState<WeaponOption[]>([]);
  const [selectedWeapon, setSelectedWeapon] = useState<string>("");
  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [isLoadingWeapons, setIsLoadingWeapons] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [criteria, setCriteria] = useState<EligibilityCriteria[]>([]);
  const [weaponDropdownOpen, setWeaponDropdownOpen] = useState(false);

  const rightHand = usePermission("right_hand");

  const loadAccess = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsAuthReady(true);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setIsAuthReady(true);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("guild_id")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { guild_id?: string | null } | null;
    };
    const resolvedGuildId = profile?.guild_id ?? null;
    setGuildId(resolvedGuildId);
    if (!resolvedGuildId) {
      setError("Aucune guilde active.");
      setIsAuthReady(true);
      return;
    }
    const { data: membership } = (await supabase
      .from("guild_members")
      .select("role_rank")
      .eq("guild_id", resolvedGuildId)
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null } | null;
    };
    const rank = (membership?.role_rank ?? "").toLowerCase();
    setIsAdmin(rank === "admin" || rank === "owner" || rightHand.allowed);
    const { data: guild } = await supabase
      .from("guilds")
      .select("owner_id")
      .eq("id", resolvedGuildId)
      .maybeSingle();
    if (guild?.owner_id) {
      const { data: config } = await supabase
        .from("guild_configs")
        .select("eligibility_criteria")
        .eq("owner_id", guild.owner_id)
        .maybeSingle();
      const configured = (config?.eligibility_criteria ?? []) as EligibilityCriteria[];
      setCriteria(configured.length > 0 ? configured : ["loot_received"]);
    } else {
      setCriteria(["loot_received"]);
    }
    setIsAuthReady(true);
  }, [rightHand.allowed]);

  const loadWeapons = useCallback(async () => {
    if (!guildId) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsLoadingWeapons(true);
    setError(null);
    const { data: memberRows, error: membersError } = (await supabase
      .from("guild_members")
      .select("user_id")
      .eq("guild_id", guildId)) as {
      data: Array<{ user_id: string }> | null;
      error: { message?: string } | null;
    };
    if (membersError) {
      setError(membersError.message || "Impossible de charger les membres.");
      setIsLoadingWeapons(false);
      return;
    }
    const memberIds = (memberRows ?? []).map((row) => row.user_id);
    if (memberIds.length === 0) {
      setWeaponOptions([]);
      setIsLoadingWeapons(false);
      return;
    }
    const { data: wishlistRows } = (await supabase
      .from("gear_wishlist")
      .select("item_name")
      .in("user_id", memberIds)
      .eq("item_priority", 1)
      .in("slot_name", ["main_hand", "off_hand"])) as {
      data: Array<{ item_name: string | null }> | null;
    };
    const wishlistNames = new Set(
      (wishlistRows ?? [])
        .map((row) => row.item_name)
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => normalizeName(name)),
    );
    const wishlistByNormalized = new Map(
      (wishlistRows ?? [])
        .map((row) => row.item_name)
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => [normalizeName(name), name]),
    );
    const catalog = weaponFiles.map((file) => ({
      name: toDisplayName(file),
      imageUrl: `/items/armes/${file}`,
    }));
    const filtered = catalog
      .filter((item) => wishlistNames.has(normalizeName(item.name)))
      .map((item) => ({
        ...item,
        wishlistName:
          wishlistByNormalized.get(normalizeName(item.name)) ?? item.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    setWeaponOptions(filtered);
    setIsLoadingWeapons(false);
  }, [guildId]);

  const loadEligibleMembers = useCallback(async () => {
    if (!guildId || !selectedWeapon.trim()) {
      setEligibleMembers([]);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsLoadingMembers(true);
    setError(null);
    const { data: memberRows, error: membersError } = (await supabase
      .from("guild_members")
      .select("user_id")
      .eq("guild_id", guildId)) as {
      data: Array<{ user_id: string }> | null;
      error: { message?: string } | null;
    };
    if (membersError) {
      setError(membersError.message || "Impossible de charger les membres.");
      setIsLoadingMembers(false);
      return;
    }
    const memberIds = (memberRows ?? []).map((row) => row.user_id);
    if (memberIds.length === 0) {
      setEligibleMembers([]);
      setIsLoadingMembers(false);
      return;
    }
    const { data: wishlistRows } = (await supabase
      .from("gear_wishlist")
      .select("user_id")
      .in("user_id", memberIds)
      .eq("item_name", selectedWeapon)
      .eq("item_priority", 1)
      .in("slot_name", ["main_hand", "off_hand"])) as {
      data: Array<{ user_id: string }> | null;
    };
    const eligibleIds = Array.from(
      new Set((wishlistRows ?? []).map((row) => row.user_id)),
    );
    if (eligibleIds.length === 0) {
      setEligibleMembers([]);
      setIsLoadingMembers(false);
      return;
    }
    const { data: profilesData } = (await supabase
      .from("profiles")
      .select("user_id,ingame_name,cohesion_points,activity_points")
      .in("user_id", eligibleIds)) as {
      data: Array<{
        user_id: string;
        ingame_name: string | null;
        cohesion_points: number | null;
        activity_points: number | null;
      }> | null;
    };
    const { data: historyRows } = await supabase
      .from("loot_history")
      .select("user_id")
      .eq("guild_id", guildId)
      .in("user_id", eligibleIds);
    const scoreByUser = new Map<string, number>();
    (historyRows ?? []).forEach((row) => {
      const current = scoreByUser.get(row.user_id) ?? 0;
      scoreByUser.set(row.user_id, current + 1);
    });
    const profileById = new Map(
      (profilesData ?? []).map((profile) => [profile.user_id, profile]),
    );
    const mapped = eligibleIds.map((userId) => {
      const profile = profileById.get(userId);
      return {
        userId,
        ingameName: profile?.ingame_name ?? "Inconnu",
        lootCount: scoreByUser.get(userId) ?? 0,
        participationPoints: profile?.cohesion_points ?? 0,
        activityPoints: profile?.activity_points ?? 0,
      };
    });
    mapped.sort((a, b) => {
      const activeCriteria =
        criteria.length > 0 ? criteria : (["loot_received"] as EligibilityCriteria[]);
      for (const criterion of activeCriteria) {
        if (criterion === "loot_received") {
          if (a.lootCount !== b.lootCount) {
            return a.lootCount - b.lootCount;
          }
        }
        if (criterion === "participation_points") {
          if (a.participationPoints !== b.participationPoints) {
            return b.participationPoints - a.participationPoints;
          }
        }
        if (criterion === "activity_points") {
          if (a.activityPoints !== b.activityPoints) {
            return b.activityPoints - a.activityPoints;
          }
        }
      }
      return a.ingameName.localeCompare(b.ingameName, "fr");
    });
    setEligibleMembers(mapped);
    setIsLoadingMembers(false);
  }, [guildId, selectedWeapon]);

  useEffect(() => {
    if (rightHand.loading) {
      return;
    }
    loadAccess();
  }, [loadAccess, rightHand.loading]);

  useEffect(() => {
    if (!guildId || !isAdmin) {
      return;
    }
    loadWeapons();
  }, [guildId, isAdmin, loadWeapons]);

  useEffect(() => {
    if (!guildId || !isAdmin) {
      return;
    }
    loadEligibleMembers();
  }, [guildId, isAdmin, selectedWeapon, loadEligibleMembers]);

  const selectedWeaponLabel = useMemo(
    () =>
      weaponOptions.find((weapon) => weapon.wishlistName === selectedWeapon)
        ?.name,
    [weaponOptions, selectedWeapon],
  );

  if (!isAuthReady || rightHand.loading) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-white/10 bg-surface/70 px-6 py-10 text-text/70 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        Chargement...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-red-500/40 bg-red-950/30 px-6 py-10 text-red-200 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        Accès réservé aux admins.
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-text/60">
            Tableau d&apos;éligibilité
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Priorités loot par item
          </h1>
          <p className="mt-2 text-sm text-text/60">
            Le classement dépend des critères activés dans les paramètres.
          </p>
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Sélection de l&apos;arme
          </p>
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-4 text-sm text-red-200">
              {error}
            </div>
          ) : isLoadingWeapons ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
              Chargement des armes...
            </div>
          ) : weaponOptions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
              Aucune arme trouvée dans les wishlists.
            </div>
          ) : (
            <div className="relative mt-4">
              <button
                type="button"
                onClick={() => setWeaponDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-text/70 transition hover:border-white/20"
              >
                <span>
                  {selectedWeapon || "Choisir une arme"}
                </span>
                <span className="text-xs uppercase tracking-[0.2em]">
                  {weaponDropdownOpen ? "Fermer" : "Ouvrir"}
                </span>
              </button>
              {weaponDropdownOpen ? (
                <div className="absolute z-10 mt-2 max-h-[320px] w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-[0_0_25px_rgba(0,0,0,0.45)]">
                  {weaponOptions.map((weapon) => (
                    <button
                      key={weapon.name}
                      type="button"
                      onClick={() => {
                        setSelectedWeapon(weapon.wishlistName);
                        setWeaponDropdownOpen(false);
                      }}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                        weapon.wishlistName === selectedWeapon
                          ? "bg-amber-400/10 text-amber-100"
                          : "text-text/70 hover:bg-white/5",
                      ].join(" ")}
                    >
                      <Image
                        src={weapon.imageUrl}
                        alt={weapon.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-lg object-contain"
                        unoptimized
                      />
                      <span>{weapon.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Priorités {selectedWeaponLabel ? `· ${selectedWeaponLabel}` : ""}
          </p>
          {isLoadingMembers ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
              Chargement des membres...
            </div>
          ) : selectedWeapon ? (
            eligibleMembers.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
                Aucun membre n&apos;a cette arme en wishlist.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {eligibleMembers.map((member, index) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-text/70"
                  >
                    <div>
                      <div className="font-semibold text-text">
                        {member.ingameName}
                      </div>
                      <div className="text-xs text-text/50">
                        Priorité #{index + 1}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {criteria.includes("loot_received") ? (
                        <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 uppercase tracking-[0.2em] text-emerald-200">
                          Loots {member.lootCount}
                        </span>
                      ) : null}
                      {criteria.includes("participation_points") ? (
                        <span className="rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 uppercase tracking-[0.2em] text-sky-200">
                          Participation {member.participationPoints}
                        </span>
                      ) : null}
                      {criteria.includes("activity_points") ? (
                        <span className="rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 uppercase tracking-[0.2em] text-amber-200">
                          Activité {member.activityPoints}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
              Sélectionnez une arme pour afficher les priorités.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
