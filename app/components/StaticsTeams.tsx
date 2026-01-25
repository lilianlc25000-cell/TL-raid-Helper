"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getWeaponImage } from "@/lib/weapons";

type Role = "Tank" | "Heal" | "DPS";

type TeamMember = {
  userId: string;
  name: string;
  role: Role;
  teamIndex: number;
  mainWeapon?: string | null;
  offWeapon?: string | null;
};

type TeamsState = Record<number, TeamMember[]>;

const ROLE_LIMITS_BY_MODE: Record<"pvp" | "pve", Record<Role, number>> = {
  pvp: { Tank: 2, Heal: 2, DPS: 3 },
  pve: { Tank: 1, Heal: 1, DPS: 4 },
};

const ROLE_ORDER: Role[] = ["Tank", "Heal", "DPS"];
const TOTAL_SLOTS = 6;

const buildEmptyTeams = () =>
  Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [index + 1, []]),
  ) as TeamsState;

export default function StaticsTeams({ mode }: { mode: "pvp" | "pve" }) {
  const [teams, setTeams] = useState<TeamsState>(buildEmptyTeams());
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [profile, setProfile] = useState<{
    userId: string;
    name: string;
    role: Role;
  } | null>(null);

  const loadTeams = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("statics_teams")
      .select("user_id,team_index,role,player_name")
      .eq("mode", mode);

    if (fetchError) {
      setError("Impossible de charger les teams.");
      return;
    }

    const userIds = (data ?? []).map((row) => row.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id,main_weapon,off_weapon")
          .in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.user_id,
        {
          mainWeapon: profile.main_weapon,
          offWeapon: profile.off_weapon,
        },
      ]),
    );

    const nextTeams = buildEmptyTeams();
    data?.forEach((row) => {
      const teamIndex = row.team_index ?? 0;
      if (!nextTeams[teamIndex]) {
        return;
      }
      const weapons = profileMap.get(row.user_id);
      nextTeams[teamIndex].push({
        userId: row.user_id,
        name: row.player_name ?? "Joueur",
        role: row.role as Role,
        teamIndex,
        mainWeapon: weapons?.mainWeapon ?? null,
        offWeapon: weapons?.offWeapon ?? null,
      });
    });
    setTeams(nextTeams);
  }, [mode]);

  const loadTeamNames = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const { data } = await supabase
      .from("statics_team_names")
      .select("team_index,name")
      .eq("mode", mode);
    const mapped: Record<number, string> = {};
    (data ?? []).forEach((row) => {
      if (row.team_index && row.name) {
        mapped[row.team_index] = row.name;
      }
    });
    setTeamNames(mapped);
  }, [mode]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    loadTeams();
    loadTeamNames();

    const channel = supabase
      .channel(`statics-teams-${mode}`)
      .on("broadcast", { event: "teams-updated" }, () => {
        loadTeams();
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statics_teams",
          filter: `mode=eq.${mode}`,
        },
        () => loadTeams(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statics_team_names",
          filter: `mode=eq.${mode}`,
        },
        () => loadTeamNames(),
      )
      .subscribe();

    const handleFocus = () => {
      loadTeams();
      loadTeamNames();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [loadTeams, loadTeamNames, mode]);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré.");
        setLoadingProfile(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("ingame_name,role")
        .eq("user_id", user.id)
        .single();
      const role = data?.role as Role | null;
      const roleLimits = ROLE_LIMITS_BY_MODE[mode];
      if (!data?.ingame_name || !role || !roleLimits[role]) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      setProfile({ userId: user.id, name: data.ingame_name, role });
      setLoadingProfile(false);
    };

    loadProfile();
  }, [mode]);

  const currentTeam = useMemo(() => {
    if (!profile) {
      return null;
    }
    const teamEntry = Object.entries(teams).find(([, members]) =>
      members.some((member) => member.userId === profile.userId),
    );
    return teamEntry ? Number(teamEntry[0]) : null;
  }, [profile, teams]);

  const handleJoinTeam = async (teamIndex: number) => {
    if (!profile) {
      setError(
        "Renseignez votre rôle dans le profil pour rejoindre une team.",
      );
      return;
    }

    setError(null);

    const members = teams[teamIndex] ?? [];
    const roleLimits = ROLE_LIMITS_BY_MODE[mode];
    const roleCount = members.filter(
      (member) => member.role === profile.role,
    ).length;
    const otherCount = members.length - roleCount;
    const maxForRole = Math.max(
      roleCount,
      Math.min(roleLimits[profile.role], TOTAL_SLOTS - otherCount),
    );
    if (roleCount >= maxForRole) {
      setError(`Cette team a déjà ${maxForRole} ${profile.role}.`);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }

    const { error: upsertError } = await supabase
      .from("statics_teams")
      .upsert(
        {
          mode,
          team_index: teamIndex,
          user_id: profile.userId,
          role: profile.role,
          player_name: profile.name,
        },
        { onConflict: "mode,user_id" },
      );

    if (upsertError) {
      setError("Impossible de rejoindre cette team.");
      return;
    }
    await supabase.channel(`statics-teams-${mode}`).send({
      type: "broadcast",
      event: "teams-updated",
      payload: { mode },
    });
    await loadTeams();
  };

  const handleLeaveTeam = async () => {
    if (!profile) {
      return;
    }
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    const { error: deleteError } = await supabase
      .from("statics_teams")
      .delete()
      .eq("mode", mode)
      .eq("user_id", profile.userId);
    if (deleteError) {
      setError("Impossible de quitter cette team.");
      return;
    }
    await supabase.channel(`statics-teams-${mode}`).send({
      type: "broadcast",
      event: "teams-updated",
      payload: { mode },
    });
    await loadTeams();
  };

  const handleSaveTeamName = async (teamIndex: number) => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setEditingTeam(null);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    const { error: upsertError } = await supabase
      .from("statics_team_names")
      .upsert(
        {
          mode,
          team_index: teamIndex,
          name: trimmed,
        },
        { onConflict: "mode,team_index" },
      );
    if (upsertError) {
      setError("Impossible de renommer la team.");
      return;
    }
    await supabase.channel(`statics-teams-${mode}`).send({
      type: "broadcast",
      event: "teams-updated",
      payload: { mode },
    });
    setTeamNames((prev) => ({ ...prev, [teamIndex]: trimmed }));
    setEditingTeam(null);
    setNameDraft("");
  };

  return (
    <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => {
        const teamIndex = index + 1;
        const members = teams[teamIndex] ?? [];
        const counts = {
          Tank: members.filter((member) => member.role === "Tank").length,
          Heal: members.filter((member) => member.role === "Heal").length,
          DPS: members.filter((member) => member.role === "DPS").length,
        };
        const roleLimits = ROLE_LIMITS_BY_MODE[mode];
        const maxByRole = ROLE_ORDER.reduce<Record<Role, number>>(
          (acc, role) => {
            const roleCount = counts[role];
            const otherCount = members.length - roleCount;
            acc[role] = Math.max(
              roleCount,
              Math.min(roleLimits[role], TOTAL_SLOTS - otherCount),
            );
            return acc;
          },
          { Tank: 0, Heal: 0, DPS: 0 },
        );
        const isCurrentTeam = currentTeam === teamIndex;
        const canJoin = Boolean(profile) && !isCurrentTeam;

        const getBarGradient = (role: Role, ratio: number) => {
          if (ratio >= 100) {
            return "linear-gradient(90deg, #34d399, #6ee7b7, #86efac)";
          }
          if (role === "DPS") {
            if (ratio >= 66) {
              return "linear-gradient(90deg, #f59e0b, #fb923c, #fbbf24)";
            }
            if (ratio >= 33) {
              return "linear-gradient(90deg, #ef4444, #f97316, #fb7185)";
            }
            return "linear-gradient(90deg, #b91c1c, #ef4444, #f87171)";
          }
          if (ratio >= 50) {
            return "linear-gradient(90deg, #f59e0b, #fb923c, #fbbf24)";
          }
          return "linear-gradient(90deg, #b45309, #f97316, #fdba74)";
        };

        return (
          <div
            key={`team-${teamIndex}`}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-5 py-6 shadow-[0_0_35px_rgba(0,0,0,0.45)] backdrop-blur sm:px-6"
          >
            <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl transition group-hover:bg-primary/30" />
            <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50 sm:tracking-[0.35em]">
                  Statics {mode.toUpperCase()}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {editingTeam === teamIndex ? (
                    <>
                      <input
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-sm text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTeamName(teamIndex)}
                        className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-300"
                      >
                        Sauver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeam(null);
                          setNameDraft("");
                        }}
                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300 transition hover:text-white"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="max-w-[12rem] truncate text-xl font-semibold text-text sm:max-w-none">
                        {teamNames[teamIndex] ?? `Team ${teamIndex}`}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeam(teamIndex);
                          setNameDraft(teamNames[teamIndex] ?? `Team ${teamIndex}`);
                        }}
                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300 transition hover:text-white"
                      >
                        Renommer
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isCurrentTeam ? (
                <button
                  type="button"
                  onClick={handleLeaveTeam}
                  className="w-full rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-400 sm:w-auto"
                >
                  Quitter
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canJoin}
                  onClick={() => handleJoinTeam(teamIndex)}
                  className="w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Rejoindre
                </button>
              )}
            </div>

            <div className="relative mt-5 grid gap-3">
              {ROLE_ORDER.map((role) => {
                const ratio =
                  maxByRole[role] === 0
                    ? 0
                    : Math.round((counts[role] / maxByRole[role]) * 100);
                const isRoleFull = counts[role] >= maxByRole[role];
                const barTone = (() => {
                  if (ratio >= 100) {
                    return "full";
                  }
                  if (role === "DPS") {
                    if (counts.DPS >= 2) {
                      return "mid";
                    }
                    if (counts.DPS >= 1) {
                      return "low";
                    }
                    return "base";
                  }
                  if (role === "Tank") {
                    return counts.Tank >= 1 ? "mid" : "base";
                  }
                  return counts.Heal >= 1 ? "mid" : "base";
                })();
                return (
                  <div
                    key={`${teamIndex}-${role}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isRoleFull
                        ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                        : "border-white/10 bg-black/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold ${
                          isRoleFull ? "text-emerald-200" : "text-text"
                        }`}
                      >
                        {role}
                      </span>
                      <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                        {counts[role]} / {maxByRole[role]}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isRoleFull || barTone === "full" ? "animate-pulse" : ""
                        }`}
                        style={{
                          width: `${ratio}%`,
                          backgroundImage: getBarGradient(role, ratio),
                        }}
                      />
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-text/60">
                      {members
                        .filter((member) => member.role === role)
                        .map((member) => (
                        <div
                            key={`${teamIndex}-${role}-${member.userId}`}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-black/50 px-3 py-2"
                          >
                          <span className="min-w-0 truncate">{member.name}</span>
                          <div className="flex items-center gap-2">
                            {member.mainWeapon &&
                            getWeaponImage(member.mainWeapon) ? (
                              <Image
                                src={getWeaponImage(member.mainWeapon)}
                                alt={member.mainWeapon}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-sm object-contain"
                              />
                            ) : null}
                            {member.offWeapon &&
                            getWeaponImage(member.offWeapon) ? (
                              <Image
                                src={getWeaponImage(member.offWeapon)}
                                alt={member.offWeapon}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-sm object-contain"
                              />
                            ) : null}
                          </div>
                          </div>
                        ))}
                      {members.filter((member) => member.role === role)
                        .length === 0 ? (
                        <div className="italic text-text/40">
                          Aucun joueur
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-text/40 sm:tracking-[0.3em]">
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                Min: 1/1/1
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                Max: {roleLimits.Tank}/{roleLimits.Heal}/{roleLimits.DPS}
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                6 joueurs
              </span>
            </div>
          </div>
        );
      })}

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-500/10 to-transparent px-6 py-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {!loadingProfile && !profile ? (
        <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-400/10 to-transparent px-6 py-4 text-sm text-amber-100">
          Renseignez votre rôle dans le profil pour rejoindre une team.
        </div>
      ) : null}
    </section>
  );
}
