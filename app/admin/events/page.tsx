"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { createEvent } from "../../../lib/actions/events";
import { PARTICIPATION_POINTS_PER_RAID } from "../../../lib/game-constants";

type EventType =
  | "Raid de Guilde"
  | "Pierre de Faille"
  | "Château"
  | "Calanthia"
  | "War Game"
  | "Taxe"
  | "Raid Boss"
  | "Siège"
  | "War Games"
  | "Tax Delivery";
type Difficulty = "Normal" | "Difficile" | "Nightmare" | "Hard";
type EventEntry = {
  id: string;
  title: string;
  eventType: EventType;
  difficulty?: Difficulty;
  dateTime: string;
  participationReward: number;
  note?: string;
};

type ContentType = "PVE" | "PVP";

const EVENT_TYPES_BY_CONTENT: Record<ContentType, EventType[]> = {
  PVE: ["Raid de Guilde", "Calanthia"],
  PVP: ["Pierre de Faille", "Château", "War Game", "Taxe"],
};

const difficulties: Difficulty[] = ["Normal", "Difficile", "Nightmare"];

const requiresTitle = (type: EventType) =>
  type === "Pierre de Faille" || type === "Château" || type === "War Game";

const requiresAlliance = (type: EventType) =>
  type === "Château" || type === "Taxe";

const requiresDifficulty = (type: EventType) => type === "Calanthia";

const getDefaultTitle = (type: EventType) => type;

const PARIS_TIME_ZONE = "Europe/Paris";

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return (asUtc - date.getTime()) / 60000;
};

const parseParisDateTime = (value: string) => {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(baseUtc, PARIS_TIME_ZONE);
  return new Date(baseUtc.getTime() - offsetMinutes * 60000);
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [eventType, setEventType] = useState<EventType>("Raid de Guilde");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Normal");
  const [dateTime, setDateTime] = useState("");
  const [alliance, setAlliance] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("id,title,event_type,difficulty,start_time,description,cohesion_reward")
        .order("start_time", { ascending: true });

      if (fetchError) {
        setError("Impossible de charger les événements.");
        setIsLoading(false);
        return;
      }

      const visibleEvents = (data ?? []).filter(
        (event) => event.event_type !== "DPS",
      );
      if (visibleEvents.length > 0) {
        setEvents(
          visibleEvents.map((event) => ({
            id: event.id,
            title: event.title,
            eventType: event.event_type as EventType,
            difficulty: event.difficulty as Difficulty | null,
            dateTime: event.start_time,
            participationReward: event.cohesion_reward ?? PARTICIPATION_POINTS_PER_RAID,
            note: event.description ?? undefined,
          })),
        );
      }
      setIsLoading(false);
    };

    loadEvents();
  }, []);

  useEffect(() => {
    if (contentType) {
      const options = EVENT_TYPES_BY_CONTENT[contentType];
      if (!options.includes(eventType)) {
        setEventType(options[0]);
      }
    }
    if (!requiresTitle(eventType)) {
      setTitle("");
    }
    if (!requiresAlliance(eventType)) {
      setAlliance("");
    }
    if (!requiresDifficulty(eventType)) {
      setDifficulty("Normal");
    }
  }, [contentType, eventType]);

  const handleCreateEvent = async () => {
    const needsTitle = requiresTitle(eventType);
    const needsAlliance = requiresAlliance(eventType);
    const needsDifficulty = requiresDifficulty(eventType);

    if (!dateTime) {
      return;
    }
    if (needsTitle && !title.trim()) {
      return;
    }
    if (needsAlliance && !alliance.trim()) {
      return;
    }
    setIsModalOpen(false);

    const finalTitle = needsTitle ? title.trim() : getDefaultTitle(eventType);
    const combinedNote = [needsAlliance ? `Alliance: ${alliance.trim()}` : null, note.trim() || null]
      .filter(Boolean)
      .join("\n");

    const startTime = parseParisDateTime(dateTime).toISOString();

    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    const result = await createEvent({
      title: finalTitle,
      eventType,
      difficulty: needsDifficulty ? difficulty : null,
      startTime,
      description: combinedNote || null,
      baseUrl,
    });

    if (!result.ok || !result.event) {
      setError(result.error ?? "Impossible de créer l'événement.");
      return;
    }

    const newEvent: EventEntry = {
      id: result.event.id,
      title: result.event.title,
      eventType: result.event.event_type as EventType,
      difficulty: result.event.difficulty as Difficulty | null,
      dateTime: result.event.start_time,
      participationReward:
        result.event.cohesion_reward ?? PARTICIPATION_POINTS_PER_RAID,
      note: result.event.description ?? undefined,
    };
    setEvents((prev) => [newEvent, ...prev]);
    setTitle("");
    setDateTime("");
    setAlliance("");
    setNote("");

  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Supprimer cet événement ?")) {
      return;
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId,
    );
    if (!isUuid) {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    const { error: signupDeleteError } = await supabase
      .from("event_signups")
      .delete()
      .eq("event_id", eventId);

    if (signupDeleteError) {
      setError(`Impossible de supprimer les inscriptions (${signupDeleteError.message}).`);
      return;
    }

    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);
    if (deleteError) {
      setError(`Impossible de supprimer l'événement (${deleteError.message}).`);
      return;
    }
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  };

  const needsTitle = requiresTitle(eventType);
  const needsAlliance = requiresAlliance(eventType);
  const needsDifficulty = requiresDifficulty(eventType);
  const isCreateDisabled =
    !contentType ||
    !dateTime ||
    (needsTitle && !title.trim()) ||
    (needsAlliance && !alliance.trim());

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-text/60">
            Calendrier &amp; Raid Helper
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            Gestion du Calendrier
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsModalOpen(true);
            setContentType(null);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
        >
          <CalendarPlus className="h-4 w-4" />
          Créer un Événement
        </button>
      </header>

      <section className="mt-8">
        <div className="space-y-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-text/60">
            Événements à venir
          </h2>
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-8 text-sm text-text/60">
              Chargement des événements...
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-8 text-sm text-text/60">
              Aucun événement planifié.
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-surface/70 px-6 py-5 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                      {event.eventType}
                      {event.difficulty ? ` · ${event.difficulty}` : ""}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-text">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm text-text/70">
                      {new Date(event.dateTime).toLocaleString("fr-FR", {
                        timeZone: "Europe/Paris",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/events/${event.id}/manage`}
                      className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
                    >
                      Gérer
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(event.id)}
                      className="rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-text/60">
                  <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                    +{event.participationReward} point
                    {event.participationReward > 1 ? "s" : ""} de participation
                  </span>
                  {event.note ? (
                    <span className="text-text/50">{event.note}</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                  Création d&apos;événement
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  Nouveau Raid
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Quel contenu voulez-vous créer ?
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["PVE", "PVP"] as ContentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setContentType(type)}
                      className={[
                        "rounded-2xl border px-4 py-4 text-left text-sm uppercase tracking-[0.25em] transition",
                        contentType === type
                          ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                          : "border-white/10 bg-black/40 text-text/70 hover:border-white/20",
                      ].join(" ")}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {contentType ? (
                <>
                  <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                      Type
                    </span>
                    <select
                      value={eventType}
                      onChange={(event) =>
                        setEventType(event.target.value as EventType)
                      }
                      className="bg-transparent text-sm text-text outline-none"
                    >
                      {EVENT_TYPES_BY_CONTENT[contentType].map((type) => (
                        <option key={type} value={type} className="text-black">
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              {contentType && needsTitle ? (
                <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                    Titre
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Nom de l'événement"
                    className="bg-transparent text-sm text-text outline-none"
                  />
                </label>
              ) : null}

              {contentType && needsAlliance ? (
                <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                    Alliance
                  </span>
                  <input
                    value={alliance}
                    onChange={(event) => setAlliance(event.target.value)}
                    placeholder="Nom de l'alliance"
                    className="bg-transparent text-sm text-text outline-none"
                  />
                </label>
              ) : null}

              {contentType && needsDifficulty ? (
                <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                    Difficulté
                  </span>
                  <select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as Difficulty)
                    }
                    className="bg-transparent text-sm text-text outline-none"
                  >
                    {difficulties.map((level) => (
                      <option key={level} value={level} className="text-black">
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {contentType ? (
                <>
                  <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                      Date &amp; Heure (Paris)
                    </span>
                    <input
                      type="datetime-local"
                      value={dateTime}
                      onChange={(event) => setDateTime(event.target.value)}
                      className="bg-transparent text-sm text-text outline-none"
                    />
                  </label>

                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                      Points de participation
                    </p>
                    <p className="mt-2 text-sm text-emerald-100/80">
                      Chaque raid helper validé vaut{" "}
                      <span className="font-semibold text-emerald-100">
                        +{PARTICIPATION_POINTS_PER_RAID} point
                        {PARTICIPATION_POINTS_PER_RAID > 1 ? "s" : ""}
                      </span>{" "}
                      de participation.
                    </p>
                  </div>

                  <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                      Note / Commentaire
                    </span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Commentaire de l'admin..."
                      className="min-h-[90px] resize-none bg-transparent text-sm text-text outline-none"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateEvent}
                disabled={isCreateDisabled}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
