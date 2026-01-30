"use client";

import type { DragEvent } from "react";
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
import { createClient } from "../../../../../lib/supabase/client";
import { usePermission } from "../../../../../lib/hooks/usePermission";
import { getWeaponImage } from "../../../../../lib/weapons";

type PlayerCard = {
  userId: string;
  ingameName: string;
  role: string | null;
  assignedRole: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  status: "present" | "tentative" | "bench" | "absent";
  groupIndex: number | null;
};

type PlayerBuild = {
  id: string;
  buildName: string;
  role: string | null;
  archetype: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
};

type GroupState = {
  id: number;
  players: PlayerCard[];
};

const GROUP_SIZE = 6;
const PVP_EVENT_TYPES = ["Pierre de Faille", "Château", "War Game", "Taxe"];
const PVE_EVENT_TYPES = ["Raid de Guilde", "Calanthia"];
const PARIS_TIME_ZONE = "Europe/Paris";
const normalizeEventType = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
const EVENT_IMAGE_BY_TYPE: Record<string, string> = {
  calanthia:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Calanthia.png",
  chateau:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Chateau.png",
  pierrefaille:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Pierre_de_faille.png",
  raiddeguilde:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Raid_de_guilde.png",
  raidboss:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Raid_de_guilde.png",
  siege:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Chateau.png",
  taxe:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Taxe.png",
  taxdelivery:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Taxe.png",
  wargame:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/War_game.png",
  wargames:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/War_game.png",
};

const getEventImageUrl = (eventType: string | null) => {
  if (!eventType) return undefined;
  const normalized = normalizeEventType(eventType);
  if (!normalized) return undefined;
  if (EVENT_IMAGE_BY_TYPE[normalized]) {
    return EVENT_IMAGE_BY_TYPE[normalized];
  }
  const matchKey = Object.keys(EVENT_IMAGE_BY_TYPE).find((key) =>
    normalized.includes(key),
  );
  return matchKey ? EVENT_IMAGE_BY_TYPE[matchKey] : undefined;
};
const EVENT_DAYS = [
  { key: "lundi", label: "📆-Lundi" },
  { key: "mardi", label: "📆-Mardi" },
  { key: "mercredi", label: "📆-Mercredi" },
  { key: "jeudi", label: "📆-Jeudi" },
  { key: "vendredi", label: "📆-Vendredi" },
  { key: "samedi", label: "📆-Samedi" },
  { key: "dimanche", label: "📆-Dimanche" },
];

const getWeekdayKey = (startTime: string) =>
  new Date(startTime)
    .toLocaleDateString("fr-FR", {
      timeZone: PARIS_TIME_ZONE,
      weekday: "long",
    })
    .toLowerCase();

const weekdayToDiscordCategory = (weekday: string) => {
  const normalized = weekday
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  const match = EVENT_DAYS.find((day) => day.key === normalized);
  return match?.label ?? null;
};

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

const getEffectiveRole = (player: PlayerCard) =>
  player.assignedRole ?? player.role;

const getRoleStyle = (role: string | null) => {
  if (!role) return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  const normalized = role.toLowerCase();
  if (normalized.includes("tank")) return roleStyles.tank;
  if (normalized.includes("heal") || normalized.includes("soin"))
    return roleStyles.heal;
  if (normalized.includes("dps")) return roleStyles.dps;
  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
};

const getStatusLabel = (status: PlayerCard["status"]) => {
  if (status === "present") return "Présent";
  if (status === "tentative") return "Tentative";
  if (status === "bench") return "Banc";
  if (status === "absent") return "Absent";
  return "Inconnu";
};

const getRoleBucket = (role: string | null) => {
  if (!role) return "dps";
  const normalized = role.toLowerCase();
  if (normalized.includes("tank")) return "tank";
  if (normalized.includes("heal") || normalized.includes("soin")) return "heal";
  if (normalized.includes("dps")) return "dps";
  return "dps";
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

const normalizeWeaponName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const WEAPON_EMOJI_BY_KEY: Record<string, string> = {
  orbe: "<:orbe:1465385386661646542>",
  baguette: "<:baguette:1465385271481729074>",
  baton: "<:baton:1465385290225946832>",
  epee_bouclier: "<:epee_bouclier:1465385331414274272>",
  dagues: "<:dagues:1465385307850408108>",
  lance: "<:lance:1465385368701374635>",
  espadon: "<:espadon:1465385351915770031>",
  arc_long: "<:arc_long:1465385252628201636>",
  arbalete: "<:arbalete:1465385200354590720>",
};

const getWeaponEmoji = (weaponName?: string | null) => {
  if (!weaponName) return "";
  const normalized = normalizeWeaponName(weaponName);
  if (normalized.includes("arbal")) return WEAPON_EMOJI_BY_KEY.arbalete;
  if (normalized.includes("arc")) return WEAPON_EMOJI_BY_KEY.arc_long;
  if (normalized.includes("baguette")) return WEAPON_EMOJI_BY_KEY.baguette;
  if (normalized.includes("baton") || normalized.includes("bton"))
    return WEAPON_EMOJI_BY_KEY.baton;
  if (normalized.includes("dague")) return WEAPON_EMOJI_BY_KEY.dagues;
  if (normalized.includes("espadon")) return WEAPON_EMOJI_BY_KEY.espadon;
  if (normalized.includes("lance")) return WEAPON_EMOJI_BY_KEY.lance;
  if (normalized.includes("orbe")) return WEAPON_EMOJI_BY_KEY.orbe;
  if (normalized.includes("bouclier") || normalized.includes("epee"))
    return WEAPON_EMOJI_BY_KEY.epee_bouclier;
  return "";
};

export default function RaidGroupsPage() {
  const params = useParams();
  const eventId = String(params?.id ?? "");

  const [eventTitle, setEventTitle] = useState<string>("Événement");
  const [eventStartTime, setEventStartTime] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
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
  const [roleEditMode, setRoleEditMode] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "present" | "tentative" | "bench" | "absent"
  >("present");
  const [roleEditPlayer, setRoleEditPlayer] = useState<PlayerCard | null>(null);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(
    null,
  );
  const [buildsByUser, setBuildsByUser] = useState<Map<string, PlayerBuild[]>>(
    new Map(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverReserve, setDragOverReserve] = useState(false);
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null);
  const managePve = usePermission("manage_pve");
  const managePvp = usePermission("manage_pvp");
  const permissionsReady = !managePve.loading && !managePvp.loading;
  const isPveEvent = eventType ? PVE_EVENT_TYPES.includes(eventType) : false;
  const isPvpEvent = eventType ? PVP_EVENT_TYPES.includes(eventType) : false;
  const canManageEvent =
    permissionsReady &&
    ((isPveEvent && managePve.allowed) ||
      (isPvpEvent && managePvp.allowed) ||
      (!isPveEvent && !isPvpEvent));

  const allPlayers = useMemo(
    () => [
      ...reserve,
      ...groups.flatMap((group) => group.players),
    ],
    [reserve, groups],
  );

  const formattedEventDate = useMemo(() => {
    if (!eventStartTime) {
      return "Date inconnue";
    }
    const date = new Date(eventStartTime);
    if (Number.isNaN(date.getTime())) {
      return "Date inconnue";
    }
    return date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  }, [eventStartTime]);

  const getPlayerById = (playerId: string) =>
    allPlayers.find((player) => player.userId === playerId) ?? null;

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoadError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsLoading(false);
        return;
      }
      setLoadError(null);
      setIsLoading(true);

      const { data: event } = await supabase
        .from("events")
        .select("title,are_groups_published,event_type,start_time")
        .eq("id", eventId)
        .maybeSingle();
      setEventTitle(event?.title ?? "Événement");
      setEventStartTime(event?.start_time ?? null);
      setEventType(event?.event_type ?? null);
      const published = Boolean(event?.are_groups_published);
      setIsPublished(published);
      setIsDirty(false);

      const { data, error } = (await supabase
        .from("event_signups")
        .select(
        "user_id,status,assigned_role,group_index,selected_build_id,profiles(ingame_name,role,main_weapon,off_weapon),player_builds(id,build_name,role,archetype,main_weapon,off_weapon)",
        )
        .eq("event_id", eventId)
        .in("status", ["present", "tentative", "bench", "absent"])) as {
        data:
          | Array<{
              user_id: string;
              status: "present" | "tentative" | "bench" | "absent";
          assigned_role: string | null;
              group_index: number | null;
              selected_build_id: string | null;
              profiles: {
                ingame_name: string;
                role: string | null;
                main_weapon: string | null;
                off_weapon: string | null;
              } | null;
              player_builds: {
                id: string;
                build_name: string;
                role: string | null;
                archetype: string | null;
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
      let nextReserve: PlayerCard[] = [];
      const hasExistingGroups = (data ?? []).some(
        (entry) => entry.group_index !== null,
      );
      let didAutoAssign = false;

    const userIds = new Set<string>();
    (data ?? []).forEach((entry) => {
        const profile = Array.isArray(entry.profiles)
          ? entry.profiles[0]
          : entry.profiles;
        const build = Array.isArray(entry.player_builds)
          ? entry.player_builds[0]
          : entry.player_builds;
        const card: PlayerCard = {
          userId: entry.user_id,
          ingameName: profile?.ingame_name ?? "Inconnu",
          role: build?.role ?? profile?.role ?? null,
        assignedRole: entry.assigned_role ?? null,
          mainWeapon: build?.main_weapon ?? profile?.main_weapon ?? null,
          offWeapon: build?.off_weapon ?? profile?.off_weapon ?? null,
          status: entry.status,
          groupIndex: entry.group_index,
        };
      userIds.add(entry.user_id);
        if (entry.group_index && entry.group_index >= 1 && entry.group_index <= 6) {
          nextGroups[entry.group_index - 1].players.push(card);
        } else {
          nextReserve.push(card);
        }
      });

    if (userIds.size > 0) {
      const { data: builds } = await supabase
        .from("player_builds")
        .select("id,user_id,build_name,role,archetype,main_weapon,off_weapon")
        .in("user_id", Array.from(userIds));
      const nextBuilds = new Map<string, PlayerBuild[]>();
      (builds ?? []).forEach((build) => {
        const list = nextBuilds.get(build.user_id) ?? [];
        list.push({
          id: build.id,
          buildName: build.build_name,
          role: build.role ?? null,
          archetype: build.archetype ?? null,
          mainWeapon: build.main_weapon ?? null,
          offWeapon: build.off_weapon ?? null,
        });
        nextBuilds.set(build.user_id, list);
      });
      setBuildsByUser(nextBuilds);
    } else {
      setBuildsByUser(new Map());
    }

      const eventType = event?.event_type ?? "";
      const contentMode = PVP_EVENT_TYPES.includes(eventType)
        ? "pvp"
        : PVE_EVENT_TYPES.includes(eventType)
          ? "pve"
          : null;

      if (
        !published &&
        !hasExistingGroups &&
        nextReserve.length &&
        contentMode
      ) {
        const { data: staticsTeams } = await supabase
          .from("statics_teams")
          .select("user_id,team_index")
          .eq("mode", contentMode);
        if (staticsTeams && staticsTeams.length > 0) {
          const teamByUser = new Map(
            staticsTeams.map((row) => [row.user_id, row.team_index]),
          );
          const presentCounts = new Map<number, number>();
          nextReserve
            .filter((player) => player.status === "present")
            .forEach((player) => {
              const teamIndex = teamByUser.get(player.userId);
              if (teamIndex && teamIndex >= 1 && teamIndex <= 6) {
                presentCounts.set(
                  teamIndex,
                  (presentCounts.get(teamIndex) ?? 0) + 1,
                );
              }
            });
          const remainingReserve: PlayerCard[] = [];
          nextReserve.forEach((player) => {
            const teamIndex = teamByUser.get(player.userId);
            const hasTeam =
              teamIndex && teamIndex >= 1 && teamIndex <= 6
                ? (presentCounts.get(teamIndex) ?? 0) > 1
                : false;
            if (player.status === "present" && hasTeam) {
              nextGroups[teamIndex - 1].players.push({
                ...player,
                groupIndex: teamIndex,
              });
              didAutoAssign = true;
            } else {
              remainingReserve.push(player);
            }
          });
          nextReserve = remainingReserve;
        }
      }

      setGroups(nextGroups);
      setReserve(nextReserve);
      setIsDirty(didAutoAssign);
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

  const markDirty = () => {
    setIsDirty(true);
    if (isPublished) {
      setIsPublished(false);
    }
  };

  const handleSelect = (player: PlayerCard) => {
    if (roleEditMode) {
      setRoleEditPlayer(player);
      return;
    }
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
    markDirty();
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
    markDirty();
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
    markDirty();
    setSelectedPlayer(null);
    setGroupPickerId(null);
  };

  const handleAssignRole = async (player: PlayerCard, role: string | null) => {
    const supabase = createClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setRoleUpdatingUserId(player.userId);
    setActionError(null);
    const { error } = await supabase
      .from("event_signups")
      .update({ assigned_role: role })
      .eq("event_id", eventId)
      .eq("user_id", player.userId);
    if (error) {
      setActionError(
        error.message || "Impossible de modifier le rôle assigné.",
      );
      setRoleUpdatingUserId(null);
      return;
    }
    const updatePlayer = (list: PlayerCard[]) =>
      list.map((entry) =>
        entry.userId === player.userId
          ? { ...entry, assignedRole: role }
          : entry,
      );
    setReserve((prev) => updatePlayer(prev));
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        players: updatePlayer(group.players),
      })),
    );
    setRoleUpdatingUserId(null);
    setRoleEditPlayer(null);
  };

  const handleDropOnGroup = (groupId: number) => (
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setDragOverGroupId(null);
    const playerId =
      event.dataTransfer.getData("text/plain") || draggedPlayerId;
    if (!playerId) {
      return;
    }
    const player = getPlayerById(playerId);
    if (!player) {
      return;
    }
    movePlayerToGroup(player, groupId);
    setDraggedPlayerId(null);
  };

  const handleDropOnReserve = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverReserve(false);
    const playerId =
      event.dataTransfer.getData("text/plain") || draggedPlayerId;
    if (!playerId) {
      return;
    }
    const player = getPlayerById(playerId);
    if (!player) {
      return;
    }
    moveToReserve(player);
    setDraggedPlayerId(null);
  };

  const persistGroups = async () => {
    const supabase = createClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return false;
    }
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

    const results = await Promise.all(
      updates.map((entry) =>
        supabase
          .from("event_signups")
          .update({ group_index: entry.group_index })
          .eq("event_id", eventId)
          .eq("user_id", entry.user_id),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setActionError(
        failed.error.message || "Impossible de sauvegarder les groupes.",
      );
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const saved = await persistGroups();
    setIsSaving(false);
    if (saved) {
      setIsDirty(false);
    }
  };

  const handlePublish = async () => {
    const supabase = createClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsPublishing(true);
    setActionError(null);

    const saved = await persistGroups();
    if (!saved) {
      setIsPublishing(false);
      return;
    }

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

    const { data: authData } = await supabase.auth.getUser();
    const ownerId = authData.user?.id ?? null;
    if (ownerId) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data: guildConfig } = await supabase
        .from("guild_configs")
        .select("raid_channel_id,group_channel_id,discord_guild_id")
        .eq("owner_id", ownerId)
        .maybeSingle();

      const dayCategory = eventStartTime
        ? weekdayToDiscordCategory(getWeekdayKey(eventStartTime))
        : null;
      const targetChannelId =
        dayCategory
          ? undefined
          : guildConfig?.group_channel_id ?? guildConfig?.raid_channel_id;
      if (
        (!dayCategory && !targetChannelId) ||
        (dayCategory && !guildConfig?.discord_guild_id)
      ) {
        setActionError("Aucun salon Discord configuré pour publier les groupes.");
        setIsPublishing(false);
        return;
      }

      const timestamp = eventStartTime
        ? Math.floor(new Date(eventStartTime).getTime() / 1000)
        : null;
      const buildGroupField = (group: GroupState) => {
        if (group.players.length === 0) {
          return {
            name: `Groupe ${group.id}`,
            value: "—",
            inline: true,
          };
        }
        const tanks: string[] = [];
        const dps: string[] = [];
        const heals: string[] = [];
        group.players.forEach((player) => {
          const effectiveRole = getEffectiveRole(player);
          const bucket = getRoleBucket(effectiveRole);
          const mainEmoji = getWeaponEmoji(player.mainWeapon);
          const offEmoji = getWeaponEmoji(player.offWeapon);
          const emojis = [mainEmoji, offEmoji].filter(Boolean).join(" ");
          const emojiPrefix = emojis ? `${emojis} ` : "";
          const line = `${emojiPrefix}${player.ingameName}`;
          if (bucket === "tank") {
            tanks.push(line);
          } else if (bucket === "heal") {
            heals.push(line);
          } else {
            dps.push(line);
          }
        });
        const sections = [
          { title: "🛡️ Tanks", entries: tanks },
          { title: "⚔️ DPS", entries: dps },
          { title: "🌿 Heals", entries: heals },
        ]
          .filter((section) => section.entries.length > 0)
          .map(
            (section) =>
              `**— ${section.title} —**\n${section.entries
                .map((line) => `- ${line}`)
                .join("\n")}`,
          )
          .join("\n");
        return {
          name: `Groupe ${group.id}`,
          value: sections || "—",
          inline: true,
        };
      };

      const fields = groups.flatMap((group, index) => {
        const groupField = buildGroupField(group);
        const isSecondInPair = index % 2 === 1;
        const isLast = index === groups.length - 1;
        const pairSeparator = !isLast && isSecondInPair;

        const withColumnGap = isSecondInPair
          ? [groupField]
          : [groupField, { name: "\u200B", value: "\u200B", inline: true }];
        return pairSeparator
          ? [
              ...withColumnGap,
              { name: "\u200B", value: "\u200B", inline: false },
            ]
          : withColumnGap;
      });

      const imageUrl = getEventImageUrl(eventType);
      const { error: discordError } = await supabase.functions.invoke(
        "discord-notify",
        {
          body: {
            channel_id: targetChannelId,
            guild_id: dayCategory ? guildConfig?.discord_guild_id ?? undefined : undefined,
            channel_name: dayCategory ? "👥-groupe" : undefined,
            parent_name: dayCategory ?? undefined,
            content: timestamp ? `⏳ Départ <t:${timestamp}:R>` : undefined,
            embed: {
              title: `⚔️ **${eventTitle.toUpperCase()}** ⚔️`,
              description: timestamp
                ? `Événement : <t:${timestamp}:F>\nLes groupes sont publiés. Préparez-vous !`
                : `Événement : ${formattedEventDate}\nLes groupes sont publiés. Préparez-vous !`,
              fields,
              color: 0xffa600,
              image: imageUrl ? { url: imageUrl } : undefined,
            },
            replace: {
              match_title_prefix: "⚔️",
              limit: 25,
            },
          },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
      );
      if (discordError) {
        setActionError(
          discordError.message ||
            "Impossible d'annoncer les groupes sur Discord.",
        );
        setIsPublishing(false);
        return;
      }
    }

    setIsPublished(true);
    setIsDirty(false);
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
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
          <p className="text-xs uppercase tracking-[0.35em] text-text/50">
            Squad Builder
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl tracking-[0.15em] text-text">
              Construction des groupes — {eventTitle}
            </h1>
            <button
              type="button"
              onClick={() => {
                setRoleEditMode((prev) => !prev);
                setRoleEditPlayer(null);
                setSelectedPlayer(null);
              }}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                roleEditMode
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/40 text-text/70 hover:border-white/30"
              }`}
            >
              Modifier le rôle
            </button>
          </div>
          <p className="mt-2 text-sm text-text/70">
            {roleEditMode
              ? "Cliquez sur un joueur pour modifier son rôle."
              : "Glissez les joueurs pour composer les groupes."}
          </p>
        </header>

        {actionError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-6 py-4 text-sm text-red-200">
            {actionError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
          <div
            className={[
              "rounded-3xl border bg-surface/60 px-5 py-5 shadow-[0_0_20px_rgba(0,0,0,0.35)] backdrop-blur transition",
              dragOverReserve
                ? "border-sky-400/70 bg-sky-400/10 shadow-[0_0_25px_rgba(56,189,248,0.35)]"
                : "border-white/10",
            ].join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverReserve(true);
            }}
            onDragLeave={() => setDragOverReserve(false)}
            onDrop={handleDropOnReserve}
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-text/50">
              <span>Réserve / Banc</span>
              <span className="font-mono text-text/50">
                {reserve
                  .filter((player) => player.status === statusFilter)
                  .length.toString()
                  .padStart(2, "0")}
              </span>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-text/70 transition hover:border-white/20 hover:text-text"
              >
                Filtrer les inscrits
              </button>
              {isFilterOpen ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { value: "present", label: "Présents" },
                    { value: "tentative", label: "Tentatives" },
                    { value: "bench", label: "Banc" },
                    { value: "absent", label: "Absents" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(
                          option.value as "present" | "tentative" | "bench" | "absent",
                        );
                        setIsFilterOpen(false);
                      }}
                      className={[
                        "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition",
                        statusFilter === option.value
                          ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                          : "border-white/10 bg-black/40 text-text/60 hover:border-white/20 hover:text-text",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {reserve.filter((player) => player.status === statusFilter).length ===
              0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-text/60">
                  Tous les joueurs sont assignés.
                </div>
              ) : (
                reserve
                  .filter((player) => player.status === statusFilter)
                  .map((player) => (
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
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", player.userId);
                      setDraggedPlayerId(player.userId);
                    }}
                    onDragEnd={() => setDraggedPlayerId(null)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className={[
                  "rounded-3xl border bg-surface/60 px-4 py-4 shadow-[0_0_18px_rgba(0,0,0,0.3)] backdrop-blur transition",
                  dragOverGroupId === group.id
                    ? "border-amber-400/70 bg-amber-400/10 shadow-[0_0_22px_rgba(251,191,36,0.35)]"
                    : "border-white/10",
                ].join(" ")}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverGroupId(group.id);
                }}
                onDragLeave={() =>
                  setDragOverGroupId((prev) => (prev === group.id ? null : prev))
                }
                onDrop={handleDropOnGroup(group.id)}
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-text/50">
                  <span>Groupe {group.id}</span>
                  <span className="font-mono text-text/50">
                    {group.players.length}/{GROUP_SIZE}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {group.players.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-4 text-xs text-text/60">
                      Aucun joueur assigné.
                    </div>
                  ) : (
                    group.players.map((player) => (
                      <PlayerCard
                        key={player.userId}
                        player={player}
                        selected={selectedPlayer?.userId === player.userId}
                        onSelect={() => handleSelect(player)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", player.userId);
                          setDraggedPlayerId(player.userId);
                        }}
                        onDragEnd={() => setDraggedPlayerId(null)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isDirty || !isPublished ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!permissionsReady ? (
              <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/60">
                Chargement des permissions...
              </div>
            ) : canManageEvent ? (
              <>
                {isDirty ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Sauvegarde..." : "Sauvegarder les groupes"}
                  </button>
                ) : null}
                {!isPublished ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPublishing ? "Publication..." : "Publier les groupes"}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200">
                Accès restreint pour ce type d&apos;événement.
              </div>
            )}
          </div>
        ) : null}
      </section>
      {roleEditPlayer ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 py-10">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-[0_0_35px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text">
                  Modifier le rôle
                </h2>
                <p className="mt-1 text-sm text-text/60">
                  Choisissez un build pour {roleEditPlayer.ingameName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleEditPlayer(null)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={roleUpdatingUserId === roleEditPlayer.userId}
                onClick={() => handleAssignRole(roleEditPlayer, null)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-text/70 transition hover:border-white/30 disabled:opacity-60"
              >
                Rôle par défaut
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {(buildsByUser.get(roleEditPlayer.userId) ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
                  Aucun build enregistré pour ce joueur.
                </div>
              ) : (
                (buildsByUser.get(roleEditPlayer.userId) ?? []).map((build) => (
                  <button
                    key={build.id}
                    type="button"
                    disabled={
                      roleUpdatingUserId === roleEditPlayer.userId ||
                      !build.role
                    }
                    onClick={() =>
                      handleAssignRole(roleEditPlayer, build.role)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-left text-sm text-text/70 transition hover:border-amber-400/60 disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text">
                          {build.buildName || "Build sans nom"}
                        </div>
                        <div className="mt-1 text-xs text-text/50">
                          {getRoleLabel(build.role)} ·{" "}
                          {build.archetype || "Archétype inconnu"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text/60">
                        <span>{build.mainWeapon || "?"}</span>
                        <span>·</span>
                        <span>{build.offWeapon || "?"}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PlayerCardProps = {
  player: PlayerCard;
  selected: boolean;
  onSelect: () => void;
  showGroupPicker?: boolean;
  onToggleGroupPicker?: () => void;
  onAssignGroup?: (groupId: number) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
};

function PlayerCard({
  player,
  selected,
  onSelect,
  showGroupPicker,
  onToggleGroupPicker,
  onAssignGroup,
  onDragStart,
  onDragEnd,
}: PlayerCardProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const effectiveRole = getEffectiveRole(player);
  const isForcedRole = player.assignedRole !== null;
  const RoleBadgeStyle = isForcedRole
    ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
    : getRoleStyle(effectiveRole);
  const roleLabel = getRoleLabel(effectiveRole);
  const MainIcon = getWeaponIcon(player.mainWeapon);
  const OffIcon = getWeaponIcon(player.offWeapon);
  const mainKey = `${player.userId}-main`;
  const offKey = `${player.userId}-off`;
  const mainImage = getWeaponImage(player.mainWeapon);
  const offImage = getWeaponImage(player.offWeapon);

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-2xl border bg-black/40 px-3 py-3 text-sm transition sm:flex-row sm:items-center sm:justify-between",
        selected
          ? "border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
          : "border-white/10",
      ].join(" ")}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => onDragStart?.(event)}
      onDragEnd={() => onDragEnd?.()}
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
            {isForcedRole ? (
              <span className="ml-1" aria-label="Rôle forcé">
                👮
              </span>
            ) : null}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            {getStatusLabel(player.status)}
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
      </div>
    </div>
  );
}
