"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Swords } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { PARTICIPATION_POINTS_PER_RAID } from "../../lib/game-constants";
import { getWeaponImage } from "../../lib/weapons";
import useRealtimeSubscription from "@/src/hooks/useRealtimeSubscription";

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
type BuildEntry = {
  id: string;
  name: string;
  role: string | null;
  archetype: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
};

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

const POST_EVENT_HIDE_MINUTES = 15;
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

const getEventImageUrl = (eventType: string) => {
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

const formatCountdown = (target: Date) => {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= -POST_EVENT_HIDE_MINUTES * 60 * 1000) {
    return null;
  }
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
  const [builds, setBuilds] = useState<BuildEntry[]>([]);
  const [selectedBuildByEvent, setSelectedBuildByEvent] = useState<
    Record<string, string>
  >({});
  const [isBuildPickerOpen, setIsBuildPickerOpen] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{
    eventId: string;
    status: SignupStatus;
  } | null>(null);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
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
    const supabase = createClient();
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

    const visibleEvents = (eventsData ?? []).filter(
      (event) => event.event_type !== "DPS",
    );
    if (visibleEvents.length > 0) {
      setEvents(
        visibleEvents.map((event) => ({
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

    const eventIds = visibleEvents.map((event) => event.id);
    if (eventIds.length === 0) {
      return;
    }
    const { data: signupData } = (await supabase
      .from("event_signups")
      .select("event_id,status,selected_build_id")
      .eq("user_id", sessionUser.id)
      .in("event_id", eventIds)) as {
      data:
        | Array<{
            event_id: string;
            status: SignupStatus;
          selected_build_id: string | null;
          }>
        | null;
    };

    const statusMap: Record<string, SignupStatus> = {};
    const buildMap: Record<string, string> = {};
    (signupData ?? []).forEach((signup) => {
      statusMap[signup.event_id] = signup.status as SignupStatus;
      if (signup.selected_build_id) {
        buildMap[signup.event_id] = signup.selected_build_id;
      }
    });
    setStatusByEvent(statusMap);
    setSelectedBuildByEvent(buildMap);

    const { data: buildsData } = (await supabase
      .from("player_builds")
      .select("id,build_name,role,archetype,main_weapon,off_weapon")
      .eq("user_id", sessionUser.id)
      .order("updated_at", { ascending: false })) as {
      data:
        | Array<{
            id: string;
            build_name: string;
            role: string | null;
            archetype: string | null;
            main_weapon: string | null;
            off_weapon: string | null;
          }>
        | null;
    };
    const mappedBuilds =
      buildsData?.map((build) => ({
        id: build.id,
        name: build.build_name,
        role: build.role,
        archetype: build.archetype,
        mainWeapon: build.main_weapon,
        offWeapon: build.off_weapon,
      })) ?? [];
    setBuilds(mappedBuilds);
    setProfileReady(mappedBuilds.length > 0);
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

  useRealtimeSubscription("events", loadEvents);

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [events]);

  const handleStatusChange = async (
    eventId: string,
    status: SignupStatus,
    buildId: string,
  ) => {
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
        "Créez au moins un build dans votre profil avant de vous inscrire.",
      );
      return;
    }
    if (!userId) {
      setError("Veuillez vous connecter pour vous inscrire aux événements.");
      return;
    }
    setStatusByEvent((prev) => ({ ...prev, [eventId]: status }));
    setSelectedBuildByEvent((prev) => ({ ...prev, [eventId]: buildId }));
    const supabase = createClient();
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
        .update({ status, selected_build_id: buildId })
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
        selected_build_id: buildId,
        created_at: new Date().toISOString(),
      });
      if (insertError) {
        setError(
          insertError.message || "Impossible de créer votre inscription.",
        );
      }
    }
  };

  const handleOpenBuildPicker = (eventId: string, status: SignupStatus) => {
    if (!profileReady) {
      setError(
        "Créez au moins un build dans votre profil avant de vous inscrire.",
      );
      return;
    }
    if (builds.length === 1) {
      handleStatusChange(eventId, status, builds[0].id);
      setError(null);
      return;
    }
    const preselected =
      selectedBuildByEvent[eventId] ?? builds[0]?.id ?? null;
    setSelectedBuildId(preselected);
    setPendingSignup({ eventId, status });
    setIsBuildPickerOpen(true);
    setError(null);
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
            Vous devez créer au moins un build dans votre profil pour vous
            inscrire aux événements.
          </p>
        ) : null}
      </header>

      <section className="mt-8 space-y-6">
        {sortedEvents.map((event) => {
          const eventDate = new Date(event.startTime);
          const status = statusByEvent[event.id];
          const countdownLabel = formatCountdown(eventDate);
          const eventImageUrl = getEventImageUrl(event.eventType);
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
                {eventImageUrl || countdownLabel ? (
                  <div className="flex flex-wrap items-start justify-end gap-3">
                    {eventImageUrl ? (
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1">
                        <Image
                          src={eventImageUrl}
                          alt={`Illustration ${event.eventType}`}
                          width={200}
                          height={110}
                          className="h-24 w-auto rounded-xl object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}
                    {countdownLabel ? (
                      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                          Compte à rebours
                        </p>
                        <p className="mt-2 text-lg font-semibold text-gold">
                          {countdownLabel}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-text/60">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                  +{PARTICIPATION_POINTS_PER_RAID} point
                  {PARTICIPATION_POINTS_PER_RAID > 1 ? "s" : ""} de participation
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
                      onClick={() => handleOpenBuildPicker(event.id, option.value)}
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

      {isBuildPickerOpen && pendingSignup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                  Inscription
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  Avec quel build participez-vous ?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBuildPickerOpen(false);
                  setPendingSignup(null);
                }}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {builds.map((build) => {
                const mainImage = getWeaponImage(build.mainWeapon ?? "");
                const offImage = getWeaponImage(build.offWeapon ?? "");
                const isSelected = selectedBuildId === build.id;
                return (
                  <button
                    key={build.id}
                    type="button"
                    onClick={() => setSelectedBuildId(build.id)}
                    className={[
                      "flex flex-col gap-4 rounded-2xl border px-4 py-4 text-left text-sm transition",
                      isSelected
                        ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                        : "border-white/10 bg-black/40 text-text/80 hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {build.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-text/50">
                          {build.role ?? "Rôle inconnu"}
                        </p>
                        {build.archetype ? (
                          <p className="mt-2 text-xs text-text/60">
                            {build.archetype}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-text/70">
                          {mainImage ? (
                            <Image
                              src={mainImage}
                              alt={build.mainWeapon ?? "Arme 1"}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-lg object-contain"
                              unoptimized
                            />
                          ) : (
                            <Swords className="h-4 w-4" />
                          )}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-text/70">
                          {offImage ? (
                            <Image
                              src={offImage}
                              alt={build.offWeapon ?? "Arme 2"}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-lg object-contain"
                              unoptimized
                            />
                          ) : (
                            <Swords className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsBuildPickerOpen(false);
                  setPendingSignup(null);
                }}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedBuildId}
                onClick={() => {
                  if (!pendingSignup || !selectedBuildId) {
                    return;
                  }
                  handleStatusChange(
                    pendingSignup.eventId,
                    pendingSignup.status,
                    selectedBuildId,
                  );
                  setIsBuildPickerOpen(false);
                  setPendingSignup(null);
                }}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Valider le build
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

