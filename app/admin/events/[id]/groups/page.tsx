"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  Crosshair,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Wand2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { getWeaponImage } from "../../../../../lib/weapons";

type PlayerCard = {
  userId: string;
  ingameName: string;
  role: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  status: "present" | "tentative";
  groupIndex: number | null;
};

type GroupState = {
  id: number;
  players: PlayerCard[];
};

const GROUP_SIZE = 6;

const roleStyles: Record<string, string> = {
  tank: "border-sky-500/50 bg-sky-500/10 text-sky-200",
  heal: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
  dps: "border-red-500/50 bg-red-500/10 text-red-200",
};

const getRoleLabel = (role: string | null) => {
  if (!role) return "Inconnu";
  const normalized = role.toLowerCase();
  if (normalized.includes("tank")) return "Tank";
  if (normalized.includes("heal") || normalized.includes("soin")) return "Heal";
  if (normalized.includes("dps")) return "DPS";
  return role;
};

const getRoleStyle = (role: string | null) => {
  if (!role) return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  const normalized = role.toLowerCase();
  if (normalized.includes("tank")) return roleStyles.tank;
  if (normalized.includes("heal") || normalized.includes("soin"))
    return roleStyles.heal;
  if (normalized.includes("dps")) return roleStyles.dps;
  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
};

const getWeaponIcon = (weaponName?: string | null) => {
  if (!weaponName) return Swords;
  const normalized = weaponName.toLowerCase();
  if (normalized.includes("bouclier") || normalized.includes("shield")) {
    return Shield;
  }
  if (normalized.includes("arc") || normalized.includes("arbal")) {
    return Crosshair;
  }
  if (normalized.includes("bâton") || normalized.includes("baton")) {
    return Wand2;
  }
  if (
    normalized.includes("épée") ||
    normalized.includes("epee") ||
    normalized.includes("espadon") ||
    normalized.includes("lame") ||
    normalized.includes("dagues")
  ) {
    return Sword;
  }
  return Sparkles;
};

export default function RaidGroupsPage() {
  const params = useParams();
  const eventId = String(params?.id ?? "");

  const [eventTitle, setEventTitle] = useState<string>("Événement");
  const [reserve, setReserve] = useState<PlayerCard[]>([]);
  const [groups, setGroups] = useState<GroupState[]>(
    Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      players: [],
    })),
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerCard | null>(null);
  const [groupPickerId, setGroupPickerId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const allPlayers = useMemo(
    () => [
      ...reserve,
      ...groups.flatMap((group) => group.players),
    ],
    [reserve, groups],
  );

  useEffect(() => {
    const loadData = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setLoadError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoading(false);
        return;
      }
      setLoadError(null);
      setIsLoading(true);

      const { data: event } = await supabase
        .from("events")
        .select("title")
        .eq("id", eventId)
        .maybeSingle();
      setEventTitle(event?.title ?? "Événement");

      const { data, error } = (await supabase
        .from("event_signups")
        .select("user_id,status,group_index,profiles(ingame_name,role,main_weapon,off_weapon)")
        .eq("event_id", eventId)
        .in("status", ["present", "tentative"])) as {
        data:
          | Array<{
              user_id: string;
              status: "present" | "tentative";
              group_index: number | null;
              profiles: {
                ingame_name: string;
                role: string | null;
                main_weapon: string | null;
                off_weapon: string | null;
              } | null;
            }>
          | null;
        error: { message?: string } | null;
      };

      if (error) {
        setLoadError(
          error.message || "Impossible de charger les inscriptions.",
        );
        setIsLoading(false);
        return;
      }

      const nextGroups = Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        players: [] as PlayerCard[],
      }));
      const nextReserve: PlayerCard[] = [];

      (data ?? []).forEach((entry) => {
        const profile = Array.isArray(entry.profiles)
          ? entry.profiles[0]
          : entry.profiles;
        const card: PlayerCard = {
          userId: entry.user_id,
          ingameName: profile?.ingame_name ?? "Inconnu",
          role: profile?.role ?? null,
          mainWeapon: profile?.main_weapon ?? null,
          offWeapon: profile?.off_weapon ?? null,
          status: entry.status,
          groupIndex: entry.group_index,
        };
        if (entry.group_index && entry.group_index >= 1 && entry.group_index <= 6) {
          nextGroups[entry.group_index - 1].players.push(card);
        } else {
          nextReserve.push(card);
        }
      });

      setGroups(nextGroups);
      setReserve(nextReserve);
      setIsLoading(false);
    };

    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const removeFromGroups = (playerId: string) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        players: group.players.filter((player) => player.userId !== playerId),
      })),
    );
  };

  const handleSelect = (player: PlayerCard) => {
    setSelectedPlayer((current) =>
      current?.userId === player.userId ? null : player,
    );
    setGroupPickerId(null);
    setActionError(null);
  };

  const moveToReserve = (player: PlayerCard) => {
    removeFromGroups(player.userId);
    setReserve((prev) => {
      const filtered = prev.filter((item) => item.userId !== player.userId);
      return [player, ...filtered];
    });
    setSelectedPlayer(null);
    setGroupPickerId(null);
  };

  const moveToGroup = (groupId: number) => {
    if (!selectedPlayer) {
      setActionError("Sélectionnez d'abord un joueur.");
      return;
    }
    setActionError(null);
    removeFromGroups(selectedPlayer.userId);
    setReserve((prev) =>
      prev.filter((item) => item.userId !== selectedPlayer.userId),
    );
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const next = group.players.filter(
          (player) => player.userId !== selectedPlayer.userId,
        );
        return {
          ...group,
          players: [...next, { ...selectedPlayer, groupIndex: groupId }],
        };
      }),
    );
    setSelectedPlayer(null);
    setGroupPickerId(null);
  };

  const movePlayerToGroup = (player: PlayerCard, groupId: number) => {
    setActionError(null);
    removeFromGroups(player.userId);
    setReserve((prev) => prev.filter((item) => item.userId !== player.userId));
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const next = group.players.filter(
          (member) => member.userId !== player.userId,
        );
        return {
          ...group,
          players: [...next, { ...player, groupIndex: groupId }],
        };
      }),
    );
    setSelectedPlayer(null);
    setGroupPickerId(null);
  };

  const handleSave = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setActionError(null);

    const updates = [
      ...reserve.map((player) => ({
        user_id: player.userId,
        group_index: null as number | null,
      })),
      ...groups.flatMap((group) =>
        group.players.map((player) => ({
          user_id: player.userId,
          group_index: group.id,
        })),
      ),
    ];

    await Promise.all(
      updates.map((entry) =>
        supabase
          .from("event_signups")
          .update({ group_index: entry.group_index })
          .eq("event_id", eventId)
          .eq("user_id", entry.user_id),
      ),
    );

    setIsSaving(false);
  };

  const handlePublish = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsPublishing(true);
    setActionError(null);

    await supabase
      .from("events")
      .update({ are_groups_published: true })
      .eq("id", eventId);

    const notifications = allPlayers
      .filter((player) => player.groupIndex !== null)
      .map((player) => ({
        user_id: player.userId,
        type: "raid_groups_published",
        message: `Les groupes de "${eventTitle}" sont désormais disponibles.`,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: notifyError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (notifyError) {
        setActionError(
          notifyError.message || "Impossible d'envoyer les notifications.",
        );
        setIsPublishing(false);
        return;
      }
    }

    setIsPublishing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Chargement des groupes...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Squad Builder
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
            Construction des groupes — {eventTitle}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Cliquez un joueur puis choisissez un groupe.
          </p>
        </header>

        {actionError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-4 text-sm text-red-200">
            {actionError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-5 py-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
              <span>Réserve / Banc</span>
              <span className="font-mono text-zinc-400">
                {reserve.length.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {reserve.length === 0 ? (
                <div className="rounded-md border border-zinc-900 px-4 py-6 text-sm text-zinc-500">
                  Tous les joueurs sont assignés.
                </div>
              ) : (
                reserve.map((player) => (
                  <PlayerCard
                    key={player.userId}
                    player={player}
                    selected={selectedPlayer?.userId === player.userId}
                    onSelect={() => handleSelect(player)}
                    showGroupPicker={groupPickerId === player.userId}
                    onToggleGroupPicker={() =>
                      setGroupPickerId((prev) =>
                        prev === player.userId ? null : player.userId,
                      )
                    }
                    onAssignGroup={(groupId) => movePlayerToGroup(player, groupId)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-4"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <span>Groupe {group.id}</span>
                  <span className="font-mono text-zinc-400">
                    {group.players.length}/{GROUP_SIZE}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => moveToGroup(group.id)}
                  className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-300 transition hover:border-amber-400/60 hover:text-amber-100"
                >
                  Ajouter le joueur sélectionné
                </button>
                <div className="mt-4 space-y-3">
                  {group.players.length === 0 ? (
                    <div className="rounded-md border border-zinc-900 px-3 py-4 text-xs text-zinc-500">
                      Aucun joueur assigné.
                    </div>
                  ) : (
                    group.players.map((player) => (
                      <PlayerCard
                        key={player.userId}
                        player={player}
                        selected={selectedPlayer?.userId === player.userId}
                        onSelect={() => handleSelect(player)}
                        onRemove={() => moveToReserve(player)}
                        showGroupPicker={groupPickerId === player.userId}
                        onToggleGroupPicker={() =>
                          setGroupPickerId((prev) =>
                            prev === player.userId ? null : player.userId,
                          )
                        }
                        onAssignGroup={(groupId) => movePlayerToGroup(player, groupId)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Sauvegarde..." : "Sauvegarder les groupes"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing ? "Publication..." : "Publier les groupes"}
          </button>
        </div>
      </section>
    </div>
  );
}

type PlayerCardProps = {
  player: PlayerCard;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  showGroupPicker?: boolean;
  onToggleGroupPicker?: () => void;
  onAssignGroup?: (groupId: number) => void;
};

function PlayerCard({
  player,
  selected,
  onSelect,
  onRemove,
  showGroupPicker,
  onToggleGroupPicker,
  onAssignGroup,
}: PlayerCardProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const RoleBadgeStyle = getRoleStyle(player.role);
  const roleLabel = getRoleLabel(player.role);
  const MainIcon = getWeaponIcon(player.mainWeapon);
  const OffIcon = getWeaponIcon(player.offWeapon);
  const mainKey = `${player.userId}-main`;
  const offKey = `${player.userId}-off`;
  const mainImage = getWeaponImage(player.mainWeapon);
  const offImage = getWeaponImage(player.offWeapon);

  return (
    <div
      className={[
        "flex items-center justify-between rounded-lg border bg-zinc-950/50 px-3 py-3 text-sm transition",
        selected ? "border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.25)]" : "border-zinc-900",
      ].join(" ")}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onSelect();
        }
      }}
    >
      <div>
        <div className="font-semibold text-zinc-100">{player.ingameName}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
          <span className={`rounded-full border px-2 py-0.5 ${RoleBadgeStyle}`}>
            {roleLabel}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            {player.status === "present" ? "Présent" : "Tentative"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-200">
          {mainImage && !imageErrors[mainKey] ? (
            <Image
              src={mainImage}
              alt={player.mainWeapon ?? "Arme principale"}
              width={36}
              height={36}
              className="h-8 w-8 rounded-md object-contain"
              unoptimized
              onError={() =>
                setImageErrors((prev) => ({
                  ...prev,
                  [mainKey]: true,
                }))
              }
            />
          ) : (
            <MainIcon className="h-4 w-4" />
          )}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-200">
          {offImage && !imageErrors[offKey] ? (
            <Image
              src={offImage}
              alt={player.offWeapon ?? "Arme secondaire"}
              width={36}
              height={36}
              className="h-8 w-8 rounded-md object-contain"
              unoptimized
              onError={() =>
                setImageErrors((prev) => ({
                  ...prev,
                  [offKey]: true,
                }))
              }
            />
          ) : (
            <OffIcon className="h-4 w-4" />
          )}
        </span>
        {onToggleGroupPicker ? (
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleGroupPicker();
              }}
              className="rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200 transition hover:border-amber-300"
            >
              Ajouter
            </button>
            {showGroupPicker ? (
              <div className="absolute right-0 top-full z-10 mt-2 grid w-40 grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
                {Array.from({ length: 6 }, (_, index) => index + 1).map(
                  (groupId) => (
                    <button
                      key={groupId}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAssignGroup?.(groupId);
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-100"
                    >
                      G{groupId}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300 transition hover:border-amber-400/60 hover:text-amber-100"
          >
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}
