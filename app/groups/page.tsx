"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Wand2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { getWeaponImage } from "../../lib/weapons";

type GroupMember = {
  userId: string;
  ingameName: string;
  role: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  groupIndex: number | null;
};

type GroupCard = {
  id: number;
  members: GroupMember[];
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

type PublishedEvent = {
  id: string;
  title: string;
  startTime: string;
};

export default function PlayerGroupsPage() {
  const [groups, setGroups] = useState<GroupCard[]>(
    Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      members: [],
    })),
  );
  const [publishedEvents, setPublishedEvents] = useState<PublishedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<PublishedEvent | null>(null);
  const [playerGroup, setPlayerGroup] = useState<number | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatMembers = useMemo(
    () => groups.flatMap((group) => group.members),
    [groups],
  );

  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (isMounted) {
          setError("Supabase n'est pas configuré (URL / ANON KEY).");
          setIsLoadingEvents(false);
        }
        return;
      }
      setIsLoadingEvents(true);
      setError(null);
      const { data: events } = await supabase
        .from("events")
        .select("id,title,start_time")
        .eq("are_groups_published", true)
        .order("start_time", { ascending: false });
      if (!isMounted) {
        return;
      }
      setPublishedEvents(
        (events ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          startTime: event.start_time,
        })),
      );
      setIsLoadingEvents(false);
    };
    loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadGroups = async (event: PublishedEvent) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setSelectedEvent(event);
    setIsLoadingGroups(true);
    setError(null);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id ?? null;

    const { data: signups, error: signupsError } = (await supabase
      .from("event_signups")
      .select(
        "user_id,group_index,selected_build_id,profiles(ingame_name,role,main_weapon,off_weapon),player_builds(id,build_name,role,main_weapon,off_weapon)",
      )
      .eq("event_id", event.id)) as {
      data:
        | Array<{
            user_id: string;
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
              main_weapon: string | null;
              off_weapon: string | null;
            } | null;
          }>
        | null;
      error: { message?: string } | null;
    };

    if (signupsError) {
      setError(signupsError.message || "Impossible de charger les groupes.");
      setIsLoadingGroups(false);
      return;
    }

    const nextGroups = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      members: [] as GroupMember[],
    }));

    (signups ?? []).forEach((entry) => {
      if (!entry.group_index) {
        return;
      }
      if (entry.group_index < 1 || entry.group_index > 6) {
        return;
      }
      const profile = Array.isArray(entry.profiles)
        ? entry.profiles[0]
        : entry.profiles;
      const build = Array.isArray(entry.player_builds)
        ? entry.player_builds[0]
        : entry.player_builds;
      const member: GroupMember = {
        userId: entry.user_id,
        ingameName: profile?.ingame_name ?? "Inconnu",
        role: build?.role ?? profile?.role ?? null,
        mainWeapon: build?.main_weapon ?? profile?.main_weapon ?? null,
        offWeapon: build?.off_weapon ?? profile?.off_weapon ?? null,
        groupIndex: entry.group_index,
      };
      nextGroups[entry.group_index - 1].members.push(member);
    });

    setGroups(nextGroups);
    if (userId) {
      const found = nextGroups.find((group) =>
        group.members.some((member) => member.userId === userId),
      );
      setPlayerGroup(found?.id ?? null);
    }
    setIsLoadingGroups(false);
  };

  if (isLoadingEvents) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Chargement des événements publiés...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!publishedEvents.length) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6 text-sm text-zinc-400">
          Aucun groupe publié pour le moment.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-5 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 sm:tracking-[0.3em]">
            Mes Groupes
          </p>
          <h1 className="mt-2 text-xl font-semibold text-zinc-100 sm:text-2xl">
            Événements publiés
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Choisissez un événement pour afficher les groupes.
          </p>
        </header>

        <div className="space-y-4">
          {publishedEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-zinc-100">
                  {event.title}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(event.startTime).toLocaleString("fr-FR", {
                    timeZone: "Europe/Paris",
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadGroups(event)}
                className="w-full rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 sm:w-auto"
              >
                Voir les groupes
              </button>
            </div>
          ))}
        </div>

        {selectedEvent ? (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words">
                Groupes · {selectedEvent.title}
              </span>
              {isLoadingGroups ? (
                <span className="text-zinc-500">Chargement...</span>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => {
                const isHighlighted = playerGroup === group.id;
                return (
                  <div
                    key={group.id}
                    className={[
                      "rounded-lg border px-4 py-4",
                      isHighlighted
                        ? "border-gold bg-amber-500/10 shadow-[0_0_20px_rgba(214,178,74,0.35)]"
                        : "border-zinc-800 bg-zinc-950/60",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
                      <span>Groupe {group.id}</span>
                      <span className="font-mono text-zinc-400">
                        {group.members.length}/6
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.members.length === 0 ? (
                        <div className="rounded-md border border-zinc-900 px-3 py-4 text-xs text-zinc-500">
                          Aucun joueur assigné.
                        </div>
                      ) : (
                        group.members.map((member) => (
                          <PlayerCard key={member.userId} member={member} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PlayerCard({ member }: { member: GroupMember }) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const RoleBadgeStyle = getRoleStyle(member.role);
  const roleLabel = getRoleLabel(member.role);
  const MainIcon = getWeaponIcon(member.mainWeapon);
  const OffIcon = getWeaponIcon(member.offWeapon);
  const mainKey = `${member.userId}-main`;
  const offKey = `${member.userId}-off`;
  const mainImage = getWeaponImage(member.mainWeapon);
  const offImage = getWeaponImage(member.offWeapon);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-900 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-200">
      <div className="min-w-0">
        <div className="truncate font-semibold text-zinc-100">
          {member.ingameName}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
          <span className={`rounded-full border px-2 py-0.5 ${RoleBadgeStyle}`}>
            {roleLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-200">
          {mainImage && !imageErrors[mainKey] ? (
            <Image
              src={mainImage}
              alt={member.mainWeapon ?? "Arme principale"}
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
              alt={member.offWeapon ?? "Arme secondaire"}
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
      </div>
    </div>
  );
}
