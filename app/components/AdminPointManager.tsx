"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  role: "OFFICER" | "MEMBER" | "GUEST";
  name?: string;
};

type Participant = {
  id: string;
  name: string;
  classCode: string;
};

type RaidEvent = {
  id: string;
  title: string;
  completedAt: string;
  participants: Participant[];
};

const recentRaids: RaidEvent[] = [
  {
    id: "raid-2401",
    title: "Forteresse Obscure",
    completedAt: "11 Jan 2026",
    participants: [
      { id: "p-1", name: "Aedric", classCode: "PAL" },
      { id: "p-2", name: "Lyss", classCode: "ARC" },
      { id: "p-3", name: "Morn", classCode: "MAG" },
      { id: "p-4", name: "Haska", classCode: "DRU" },
      { id: "p-5", name: "Daleen", classCode: "WAR" },
      { id: "p-6", name: "Sorn", classCode: "PAL" },
      { id: "p-7", name: "Mira", classCode: "MAG" },
      { id: "p-8", name: "Kerr", classCode: "ARC" },
      { id: "p-9", name: "Jas", classCode: "DRU" },
      { id: "p-10", name: "Nox", classCode: "WAR" },
      { id: "p-11", name: "Erin", classCode: "ARC" },
      { id: "p-12", name: "Zaya", classCode: "PAL" },
      { id: "p-13", name: "Rell", classCode: "MAG" },
      { id: "p-14", name: "Perr", classCode: "DRU" },
      { id: "p-15", name: "Shai", classCode: "WAR" },
    ],
  },
  {
    id: "raid-2400",
    title: "Citadelle du Néant",
    completedAt: "07 Jan 2026",
    participants: [
      { id: "p-16", name: "Vorn", classCode: "PAL" },
      { id: "p-17", name: "Nerys", classCode: "ARC" },
      { id: "p-18", name: "Ivar", classCode: "MAG" },
      { id: "p-19", name: "Loka", classCode: "DRU" },
      { id: "p-20", name: "Bran", classCode: "WAR" },
      { id: "p-21", name: "Sela", classCode: "ARC" },
      { id: "p-22", name: "Oryn", classCode: "PAL" },
      { id: "p-23", name: "Mila", classCode: "MAG" },
      { id: "p-24", name: "Quen", classCode: "DRU" },
      { id: "p-25", name: "Drez", classCode: "WAR" },
      { id: "p-26", name: "Yara", classCode: "ARC" },
      { id: "p-27", name: "Tess", classCode: "PAL" },
      { id: "p-28", name: "Rho", classCode: "MAG" },
      { id: "p-29", name: "Lune", classCode: "DRU" },
      { id: "p-30", name: "Kast", classCode: "WAR" },
    ],
  },
  {
    id: "raid-2399",
    title: "Sanctuaire du Front",
    completedAt: "03 Jan 2026",
    participants: [
      { id: "p-31", name: "Gail", classCode: "PAL" },
      { id: "p-32", name: "Seth", classCode: "ARC" },
      { id: "p-33", name: "Orin", classCode: "MAG" },
      { id: "p-34", name: "Lara", classCode: "DRU" },
      { id: "p-35", name: "Tarn", classCode: "WAR" },
      { id: "p-36", name: "Myla", classCode: "ARC" },
      { id: "p-37", name: "Holt", classCode: "PAL" },
      { id: "p-38", name: "Vera", classCode: "MAG" },
      { id: "p-39", name: "Rin", classCode: "DRU" },
      { id: "p-40", name: "Cole", classCode: "WAR" },
      { id: "p-41", name: "Ira", classCode: "ARC" },
      { id: "p-42", name: "Sage", classCode: "PAL" },
      { id: "p-43", name: "Zed", classCode: "MAG" },
      { id: "p-44", name: "Bree", classCode: "DRU" },
      { id: "p-45", name: "Nayl", classCode: "WAR" },
    ],
  },
];

type AdminPointManagerProps = {
  user: User;
};

export default function AdminPointManager({ user }: AdminPointManagerProps) {
  const [selectedEventId, setSelectedEventId] = useState(
    recentRaids[0]?.id ?? "",
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => recentRaids.find((event) => event.id === selectedEventId),
    [selectedEventId],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const creditedCount = selectedEvent
    ? selectedEvent.participants.filter((p) => checkedIds.has(p.id)).length
    : 0;

  const toggleParticipant = (participantId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  const handleEventChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setSelectedEventId(nextId);
    const nextEvent = recentRaids.find((raid) => raid.id === nextId);
    setCheckedIds(new Set(nextEvent?.participants.map((p) => p.id) ?? []));
  };

  const handleValidate = () => {
    if (!selectedEvent || creditedCount === 0) {
      return;
    }
    setIsSaving(true);
    window.setTimeout(() => {
      setIsSaving(false);
      setToast(`Succès : ${creditedCount} joueurs crédités`);
    }, 800);
  };

  if (user.role !== "OFFICER") {
    return null;
  }

  return (
    <section className="relative w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_0_25px_rgba(0,0,0,0.4)]">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Registre Militaire
          </p>
          <h2 className="text-lg font-semibold text-zinc-100">
            Gestion des Points de Cohésion
          </h2>
        </div>
        <div className="text-right text-xs text-zinc-400">
          Officier
          <div className="font-mono text-sm text-zinc-200">
            {user.name ?? "Commandement"}
          </div>
        </div>
      </header>

      <div className="border-b border-zinc-800 px-6 py-4">
        <label className="mb-2 block text-sm text-zinc-400">
          Sélection de l&apos;event terminé
        </label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          value={selectedEventId}
          onChange={handleEventChange}
        >
          {recentRaids.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} · {event.completedAt}
            </option>
          ))}
        </select>
      </div>

      <div className="px-6 py-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
          <span>Participants</span>
          <span className="font-mono text-zinc-300">
            {creditedCount.toString().padStart(2, "0")} /{" "}
            {selectedEvent?.participants.length.toString().padStart(2, "0") ?? "00"}
          </span>
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-2">
          {selectedEvent?.participants.map((participant) => (
            <label
              key={participant.id}
              className="flex items-center justify-between border-b border-zinc-900 pb-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-zinc-500"
                  checked={checkedIds.has(participant.id)}
                  onChange={() => toggleParticipant(participant.id)}
                />
                <span className="text-zinc-100">{participant.name}</span>
              </div>
              <span className="font-mono text-xs text-zinc-500">
                {participant.classCode}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
        <div className="text-xs text-zinc-500">
          Mise à jour simulée : <span className="font-mono">profiles.cohesion_points</span>
        </div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={isSaving || creditedCount === 0}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Validation..." : "Valider les Présences (+10 pts)"}
        </button>
      </div>

      {toast ? (
        <div className="absolute right-6 top-6 rounded-md border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm text-emerald-200 shadow-lg">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

