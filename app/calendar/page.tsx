"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type EventEntry = {
  id: string;
  title: string;
  eventType: string;
  difficulty?: string | null;
  startTime: string;
  cohesionReward: number;
  description?: string | null;
};

type SignupStatus = "present" | "tentative" | "bench" | "absent";

const statusOptions: Array<{
  value: SignupStatus;
  label: string;
  color: string;
}> = [
  {
    value: "present",
    label: "🟢 Présent",
    color: "border-emerald-500 text-emerald-200",
  },
  {
    value: "tentative",
    label: "🟡 Tentative",
    color: "border-amber-400 text-amber-200",
  },
  {
    value: "bench",
    label: "🔵 Banc",
    color: "border-sky-400 text-sky-200",
  },
  {
    value: "absent",
    label: "🔴 Absent",
    color: "border-red-500 text-red-200",
  },
];

const formatCountdown = (target: Date) => {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return "En cours";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `Dans ${days}j ${hours}h`;
  }
  if (hours > 0) {
    return `Dans ${hours}h ${minutes}m`;
  }
  return `Dans ${minutes}m`;
};

export default function CalendarPage() {
  const [, forceTick] = useState(0);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [statusByEvent, setStatusByEvent] = useState<
    Record<string, SignupStatus>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      forceTick((tick) => tick + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const loadEvents = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const sessionUser = session.session?.user;
    if (!sessionUser?.id) {
      setError("Veuillez vous connecter pour vous inscrire aux événements.");
      return;
    }
    setUserId(sessionUser.id);

    const { data: eventsData, error: eventsError } = (await supabase
      .from("events")
      .select(
        "id,title,event_type,difficulty,start_time,cohesion_reward,description,status",
      )
      .in("status", ["planned", "active"])) as {
      data:
        | Array<{
            id: string;
            title: string;
            event_type: string;
            difficulty: string | null;
            start_time: string;
            cohesion_reward: number;
            description: string | null;
          }>
        | null;
      error: { message?: string } | null;
    };

    if (eventsError) {
      setError("Impossible de charger les événements.");
      return;
    }

    if (eventsData && eventsData.length > 0) {
      setEvents(
        eventsData.map((event) => ({
          id: event.id,
          title: event.title,
          eventType: event.event_type,
          difficulty: event.difficulty,
          startTime: event.start_time,
          cohesionReward: event.cohesion_reward ?? 0,
          description: event.description ?? undefined,
        })),
      );
    }

    const eventIds = (eventsData ?? []).map((event) => event.id);
    if (eventIds.length === 0) {
      return;
    }
    const { data: signupData } = (await supabase
      .from("event_signups")
      .select("event_id,status")
      .eq("user_id", sessionUser.id)
      .in("event_id", eventIds)) as {
      data:
        | Array<{
            event_id: string;
            status: SignupStatus;
          }>
        | null;
    };

    const statusMap: Record<string, SignupStatus> = {};
    (signupData ?? []).forEach((signup) => {
      statusMap[signup.event_id] = signup.status as SignupStatus;
    });
    setStatusByEvent(statusMap);

    const { data: profileData } = (await supabase
      .from("profiles")
      .select("ingame_name,role,main_weapon,off_weapon")
      .eq("user_id", sessionUser.id)
      .single()) as {
      data:
        | {
            ingame_name: string;
            role: string | null;
            main_weapon: string | null;
            off_weapon: string | null;
          }
        | null;
    };
    const hasRole = Boolean(profileData?.role);
    const hasClass = Boolean(profileData?.main_weapon && profileData?.off_weapon);
    setProfileReady(hasRole && hasClass);
  }, []);

  useEffect(() => {
    loadEvents();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadEvents();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadEvents]);

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [events]);

  const handleStatusChange = async (eventId: string, status: SignupStatus) => {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        eventId,
      );
    if (!isUuid) {
      setError("Cet événement n'est pas encore disponible.");
      return;
    }
    if (!profileReady) {
      setError(
        "Veuillez renseigner votre classe et votre rôle avant de vous inscrire.",
      );
      return;
    }
    if (!userId) {
      setError("Veuillez vous connecter pour vous inscrire aux événements.");
      return;
    }
    setStatusByEvent((prev) => ({ ...prev, [eventId]: status }));
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const { data: existing } = (await supabase
      .from("event_signups")
      .select("user_id")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .maybeSingle()) as { data: { user_id?: string } | null };

    if (existing?.user_id) {
      const { error: updateError } = await supabase
        .from("event_signups")
        .update({ status })
        .eq("user_id", userId)
        .eq("event_id", eventId);
      if (updateError) {
        setError(
          updateError.message ||
            "Impossible de mettre à jour votre inscription.",
        );
      }
    } else {
      const { error: insertError } = await supabase.from("event_signups").insert({
        user_id: userId,
        event_id: eventId,
        status,
        created_at: new Date().toISOString(),
      });
      if (insertError) {
        setError(
          insertError.message || "Impossible de créer votre inscription.",
        );
      }
    }
  };

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-5 py-5 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-6">
        <p className="text-xs uppercase tracking-[0.25em] text-text/60 sm:tracking-[0.4em]">
          Calendrier
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-text sm:text-3xl sm:tracking-[0.15em]">
          Prochains événements
        </h1>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
        {!profileReady ? (
          <p className="mt-3 text-sm text-amber-200">
            Vous devez compléter votre classe et votre rôle dans votre profil
            pour vous inscrire aux événements.
          </p>
        ) : null}
      </header>

      <section className="mt-8 space-y-6">
        {sortedEvents.map((event) => {
          const eventDate = new Date(event.startTime);
          const status = statusByEvent[event.id];
          return (
            <div
              key={event.id}
              className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                    {event.eventType}
                    {event.difficulty ? ` · ${event.difficulty}` : ""}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text">
                    {event.title}
                  </h2>
                  <p className="mt-2 text-sm text-text/70">
                    {eventDate.toLocaleString("fr-FR", {
                      timeZone: "Europe/Paris",
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                    Compte à rebours
                  </p>
                  <p className="mt-2 text-lg font-semibold text-gold">
                    {formatCountdown(eventDate)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-text/60">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                  +{event.cohesionReward} Points de Cohésion
                </span>
                {event.description ? (
                  <span className="text-text/50">{event.description}</span>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Inscription
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleStatusChange(event.id, option.value)}
                      className={[
                        "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition",
                        option.color,
                        status === option.value
                          ? "bg-white/10"
                          : "border-white/10 text-text/60 hover:text-text",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

