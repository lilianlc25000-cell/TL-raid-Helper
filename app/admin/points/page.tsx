"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { PARTICIPATION_POINTS_PER_RAID } from "../../../lib/game-constants";

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  difficulty: string | null;
  start_time: string;
  cohesion_reward: number;
  status: string;
  is_points_distributed: boolean;
};

export default function AdminPointsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        .select(
          "id,title,event_type,difficulty,start_time,cohesion_reward,status,is_points_distributed",
        )
        .in("status", ["active", "completed"])
        .eq("is_points_distributed", false)
        .order("start_time", { ascending: false });

      if (fetchError) {
        setError("Impossible de charger les événements.");
        setIsLoading(false);
        return;
      }

      setEvents(data ?? []);
      setIsLoading(false);
    };

    loadEvents();
  }, []);

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-4 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-text/60">
          Distribution des points de participation
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-text sm:text-3xl">
          Raids terminés
        </h1>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
      </header>

      <section className="mt-6 space-y-4 sm:mt-8">
        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-4 py-6 text-sm text-text/60 sm:px-6 sm:py-8">
            Chargement des événements...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-4 py-6 text-sm text-text/60 sm:px-6 sm:py-8">
            Aucun raid à distribuer pour le moment.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-3xl border border-white/10 bg-surface/70 px-4 py-5 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur sm:px-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                    {event.event_type}
                    {event.difficulty ? ` · ${event.difficulty}` : ""}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-text sm:text-xl">
                    {event.title}
                  </h2>
                  <p className="mt-2 text-sm text-text/70">
                    {new Date(event.start_time).toLocaleString("fr-FR", {
                      timeZone: "Europe/Paris",
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
                    +{PARTICIPATION_POINTS_PER_RAID} point
                    {PARTICIPATION_POINTS_PER_RAID > 1 ? "s" : ""} de
                    participation
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-text/50">
                    Statut: {event.status}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex">
                <Link
                  href={`/admin/events/${event.id}/manage`}
                  className="w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-center text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 sm:w-auto"
                >
                  Clôturer &amp; Distribuer
                </Link>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
