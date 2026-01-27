"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { usePermission } from "../../../lib/hooks/usePermission";

type WeaponOption = {
  name: string;
};

type EligibleMember = {
  userId: string;
  ingameName: string;
  score: number;
};

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
    const uniqueNames = Array.from(
      new Set(
        (wishlistRows ?? [])
          .map((row) => row.item_name)
          .filter((name): name is string => Boolean(name && name.trim())),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr"));
    setWeaponOptions(uniqueNames.map((name) => ({ name })));
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
      .select("user_id,ingame_name")
      .in("user_id", eligibleIds)) as {
      data: Array<{ user_id: string; ingame_name: string | null }> | null;
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
    const nameById = new Map(
      (profilesData ?? []).map((profile) => [
        profile.user_id,
        profile.ingame_name ?? "Inconnu",
      ]),
    );
    const mapped = eligibleIds
      .map((userId) => ({
        userId,
        ingameName: nameById.get(userId) ?? "Inconnu",
        score: scoreByUser.get(userId) ?? 0,
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score;
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
    () => weaponOptions.find((weapon) => weapon.name === selectedWeapon)?.name,
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
            Le score correspond au nombre de loots déjà reçus.
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
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {weaponOptions.map((weapon) => (
                <button
                  key={weapon.name}
                  type="button"
                  onClick={() => setSelectedWeapon(weapon.name)}
                  className={[
                    "rounded-2xl border px-3 py-2 text-left text-sm transition",
                    weapon.name === selectedWeapon
                      ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                      : "border-white/10 bg-black/30 text-text/70 hover:border-white/20",
                  ].join(" ")}
                >
                  {weapon.name}
                </button>
              ))}
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
                    <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Score {member.score}
                    </span>
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
