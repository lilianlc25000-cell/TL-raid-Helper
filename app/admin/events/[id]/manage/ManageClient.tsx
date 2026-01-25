"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { PARTICIPATION_POINTS_PER_RAID } from "@/lib/game-constants";

type SignupStatus = "present" | "tentative" | "bench";
type KnownStatus = SignupStatus | "absent" | "unknown";

type SignupEntry = {
  userId: string;
  ingameName: string;
  role: string | null;
  status: KnownStatus;
};

type EventSummary = {
  id: string;
  title: string;
  cohesionReward: number;
  isPointsDistributed: boolean;
};

type ActionState = {
  ok: boolean;
  message: string;
};

type ManageClientProps = {
  eventId: string;
  event: EventSummary;
  signups: SignupEntry[];
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Distribution..."
        : "Valider la présence et distribuer les points"}
    </button>
  );
}

export default function ManageClient({
  eventId,
  event,
  signups,
  action,
}: ManageClientProps) {
  const [signupsState, setSignupsState] = useState<SignupEntry[]>(signups);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState(action, {
    ok: false,
    message: "",
  });

  useEffect(() => {
    const loadSignups = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoadError("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      setLoadError(null);
      console.log("[manage] load signups eventId", eventId);
      const { data, error } = (await supabase
        .from("event_signups")
        .select(
          "user_id,status,selected_build_id,profiles(ingame_name,role),player_builds(id,build_name,role)",
        )
        .eq("event_id", eventId)) as {
        data:
          | Array<{
              user_id: string;
              status: string;
              selected_build_id: string | null;
              profiles: {
                ingame_name: string;
                role: string | null;
              } | null;
              player_builds: {
                id: string;
                build_name: string;
                role: string | null;
              } | null;
            }>
          | null;
        error: { message?: string } | null;
      };
      if (error) {
        console.log("[manage] signups error", error);
      } else {
        console.log("[manage] signups count", (data ?? []).length);
      }
      if (error) {
        setLoadError(
          error.message || "Impossible de charger les inscriptions.",
        );
        return;
      }
      const mapped =
        data?.map((signup) => {
          const profile = Array.isArray(signup.profiles)
            ? signup.profiles[0]
            : signup.profiles;
          const normalized = signup.status?.toLowerCase?.() ?? "unknown";
          const status: KnownStatus =
            normalized === "present" ||
            normalized === "tentative" ||
            normalized === "bench" ||
            normalized === "absent"
              ? (normalized as KnownStatus)
              : "unknown";
          const build = Array.isArray(signup.player_builds)
            ? signup.player_builds[0]
            : signup.player_builds;
          return {
            userId: signup.user_id,
            status,
            ingameName: profile?.ingame_name ?? "Inconnu",
            role: build?.role ?? profile?.role ?? null,
          };
        }) ?? [];
      setSignupsState(mapped);
    };

    if (eventId) {
      loadSignups();
    }
  }, [eventId]);

  const groupedSignups = useMemo(() => {
    const groups: Record<SignupStatus, SignupEntry[]> = {
      present: [],
      bench: [],
      tentative: [],
    };
    const others: SignupEntry[] = [];
    signupsState.forEach((signup) => {
      if (signup.status === "present") {
        groups.present.push(signup);
      } else if (signup.status === "bench") {
        groups.bench.push(signup);
      } else if (signup.status === "tentative") {
        groups.tentative.push(signup);
      } else {
        others.push(signup);
      }
    });
    return { groups, others };
  }, [signupsState]);

  const toggleAbsent = (userId: string) => {
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!state.ok) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.location.href = "/admin";
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [state.ok]);

  if (state.ok) {
    const successMessage =
      state.message || "Les points ont été distribués avec succès";
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-10 text-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
            Événement terminé
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-emerald-100">
            {successMessage}
          </h1>
          <p className="mt-3 text-sm text-emerald-200/80">
            Retour automatique à l&apos;accueil dans 3 secondes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-text/60">
          Fin d&apos;événement
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
          {event.title}
        </h1>
        <p className="mt-2 text-sm text-text/60">
          +{PARTICIPATION_POINTS_PER_RAID} point
          {PARTICIPATION_POINTS_PER_RAID > 1 ? "s" : ""} de participation par
          joueur présent.
        </p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        {loadError ? (
          <div className="lg:col-span-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        ) : null}
        {!loadError && signupsState.length === 0 ? (
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-400">
            Aucun inscrit pour cet événement (présent, tentative ou banc).
          </div>
        ) : null}
        <div className="space-y-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-text/60">
            Liste d&apos;appel
          </h2>
          {(Object.keys(groupedSignups.groups) as SignupStatus[]).map((status) => (
            <div
              key={status}
              className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-5 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  {status === "present"
                    ? "Présent"
                    : status === "bench"
                      ? "Banc"
                      : "Tentative"}
                </p>
                <span className="text-xs uppercase tracking-[0.2em] text-text/40">
                  {groupedSignups.groups[status].length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {groupedSignups.groups[status].map((player) => {
                  const isAbsent = absentIds.has(player.userId);
                  return (
                    <div
                      key={player.userId}
                      className={[
                        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition",
                        isAbsent ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs uppercase tracking-[0.2em] text-text/70">
                          {player.ingameName.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm text-text">
                            {player.ingameName}
                            {player.role ? (
                              <span className="text-xs text-text/50">
                                {" "}
                                · {player.role}
                              </span>
                            ) : null}
                          </p>
                          {!player.role ? (
                            <p className="text-xs uppercase tracking-[0.2em] text-text/50">
                              Rôle inconnu
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-red-200">
                        <input
                          type="checkbox"
                          checked={isAbsent}
                          onChange={() => toggleAbsent(player.userId)}
                          className="h-4 w-4 accent-red-500"
                        />
                        Marquer Absent / No-Show
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedSignups.others.length > 0 ? (
            <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 px-6 py-5 text-sm text-amber-100">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-200">
                Autres statuts détectés
              </p>
              <p className="mt-2 text-xs text-amber-100/80">
                Certains inscrits ont un statut différent de present/tentative/bench.
              </p>
              <div className="mt-3 space-y-2">
                {groupedSignups.others.map((player) => (
                  <div
                    key={player.userId}
                    className="flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2"
                  >
                    <span className="text-sm text-amber-50">
                      {player.ingameName}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-amber-200">
                      {player.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-text/60">
            Validation
          </p>
          <p className="mt-3 text-sm text-text/60">
            {event.isPointsDistributed
              ? "Les points ont déjà été distribués pour cet événement."
              : "Les absents ne recevront pas de points."}
          </p>
          {state.message ? (
            <p
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                state.ok
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/60 bg-red-500/10 text-red-200",
              ].join(" ")}
            >
              {state.message}
            </p>
          ) : null}

          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="eventId" value={event.id} />
            <input
              type="hidden"
              name="absentIds"
              value={JSON.stringify(Array.from(absentIds))}
            />
            <SubmitButton disabled={event.isPointsDistributed} />
          </form>
        </div>
      </section>
    </div>
  );
}
