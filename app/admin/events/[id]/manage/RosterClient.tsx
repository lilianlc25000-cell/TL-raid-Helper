"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Crosshair,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Wand2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getWeaponImage } from "@/lib/weapons";

type SignupEntry = {
  userId: string;
  ingameName: string;
  role: string | null;
  archetype: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  status: "present" | "tentative" | "bench";
};

type RosterClientProps = {
  eventId: string;
  eventTitle: string;
  signups: SignupEntry[];
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

const getClassName = (mainWeapon: string | null, offWeapon: string | null) => {
  if (!mainWeapon || !offWeapon) {
    return "Classe inconnue";
  }
  return `${mainWeapon} / ${offWeapon}`;
};

export default function RosterClient({
  eventId,
  eventTitle,
  signups,
}: RosterClientProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const sortedSignups = useMemo(() => {
    return [...signups].sort((a, b) => a.ingameName.localeCompare(b.ingameName));
  }, [signups]);

  const handlePublishGroups = async () => {
    const supabase = createClient();
    if (!supabase) {
      setActionError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsPublishing(true);
    setActionError(null);

    const { error } = await supabase
      .from("events")
      .update({ are_groups_published: true })
      .eq("id", eventId);

    if (error) {
      setActionError(
        error.message || "Impossible de publier les groupes.",
      );
      setIsPublishing(false);
      return;
    }

    const { data: groupedPlayers } = (await supabase
      .from("event_signups")
      .select("user_id,group_index")
      .eq("event_id", eventId)) as {
      data:
        | Array<{
            user_id: string;
            group_index: number | null;
          }>
        | null;
    };
    const notifyIds =
      groupedPlayers?.filter((player) => player.group_index !== null) ?? [];
    if (notifyIds.length > 0) {
      const { error: notifyError } = await supabase.from("notifications").insert(
        notifyIds.map((player) => ({
          user_id: player.user_id,
          type: "raid_groups_published",
          message: `Les groupes de "${eventTitle}" sont désormais disponibles.`,
          is_read: false,
        })),
      );
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
        .select("raid_channel_id,group_channel_id")
        .eq("owner_id", ownerId)
        .maybeSingle();

      const targetChannelId =
        guildConfig?.group_channel_id ?? guildConfig?.raid_channel_id;
      if (targetChannelId) {
        const groupIndexByUser = new Map(
          (groupedPlayers ?? [])
            .filter((player) => player.group_index !== null)
            .map((player) => [player.user_id, player.group_index as number]),
        );
        const grouped = new Map<number, SignupEntry[]>();
        signups.forEach((player) => {
          const index = groupIndexByUser.get(player.userId);
          if (!index) {
            return;
          }
          const list = grouped.get(index) ?? [];
          list.push(player);
          grouped.set(index, list);
        });

        const fields = Array.from(grouped.entries())
          .sort(([a], [b]) => a - b)
          .map(([index, players]) => ({
            name: `Groupe ${index}`,
            value:
              players.length === 0
                ? "—"
                : players
                    .map(
                      (player) =>
                        `${player.ingameName} (${getRoleLabel(player.role)})`,
                    )
                    .join("\n"),
            inline: false,
          }));

        const { error: discordError } = await supabase.functions.invoke(
          "discord-notify",
          {
          body: {
              channel_id: targetChannelId,
            embed: {
              title: `📋 Groupes - ${eventTitle}`,
              description: "Les groupes sont publiés. Préparez-vous !",
              fields,
              color: 0x00ff00,
            },
            replace: {
                match_title_prefix: "📋 Groupes -",
              limit: 25,
            },
          },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          },
        );
        if (discordError) {
          setActionError(
            discordError.message || "Impossible d'annoncer les groupes sur Discord.",
          );
        }
      }
    }

    setIsPublishing(false);
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-text/60">
          Gérer l&apos;événement
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
          {eventTitle}
        </h1>
        <p className="mt-2 text-sm text-text/60">
          Liste complète des inscrits avec classe, rôle et armes.
        </p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-[0.3em] text-text/60">
            Inscrits
          </h2>
          {sortedSignups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/60">
              Aucun inscrit pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSignups.map((player) => {
                const roleLabel = getRoleLabel(player.role);
                const RoleIcon = getWeaponIcon(player.mainWeapon);
                const OffIcon = getWeaponIcon(player.offWeapon);
                const mainKey = `${player.userId}-main`;
                const offKey = `${player.userId}-off`;
                const mainImage = getWeaponImage(player.mainWeapon);
                const offImage = getWeaponImage(player.offWeapon);
                return (
                  <div
                    key={player.userId}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {player.ingameName}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full border px-2 py-1 ${getRoleStyle(player.role)}`}>
                          {roleLabel}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-text/70">
                          {getClassName(player.mainWeapon, player.offWeapon)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-text/50">
                          Sous-classe: {player.archetype || "Non définie"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-text/50">
                          {player.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-text/70">
                        {mainImage && !imageErrors[mainKey] ? (
                          <Image
                            src={mainImage}
                            alt={player.mainWeapon ?? "Arme principale"}
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-lg object-contain"
                            unoptimized
                            onError={() =>
                              setImageErrors((prev) => ({
                                ...prev,
                                [mainKey]: true,
                              }))
                            }
                          />
                        ) : (
                          <RoleIcon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-text/70">
                        {offImage && !imageErrors[offKey] ? (
                          <Image
                            src={offImage}
                            alt={player.offWeapon ?? "Arme secondaire"}
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-lg object-contain"
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
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <h2 className="text-xs uppercase tracking-[0.3em] text-text/60">
            Actions
          </h2>
          {actionError ? (
            <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {actionError}
            </div>
          ) : null}
          <Link
            href={`/admin/events/${eventId}/groups`}
            className="block rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-center text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
          >
            Créer les groupes
          </Link>
          <Link
            href={`/admin/events/${eventId}/close`}
            className="block rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-3 text-center text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
          >
            Clôturer l&apos;event
          </Link>
          <button
            type="button"
            onClick={handlePublishGroups}
            disabled={isPublishing}
            className="w-full rounded-full border border-sky-400/60 bg-sky-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing ? "Publication..." : "Publier les groupes"}
          </button>
        </div>
      </section>
    </div>
  );
}
