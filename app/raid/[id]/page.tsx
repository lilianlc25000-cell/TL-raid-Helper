"use client";

import {
  BowArrow,
  ClipboardCopy,
  Crosshair,
  Shield,
  Sword,
  UserCog,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

type Role = "Tank" | "DPS" | "Heal";

type Player = {
  id: string;
  pseudo: string;
  cp: number;
  primary: string;
  secondary: string;
  role: Role;
};

const raidInfo = {
  title: "Archboss Tevent",
  time: "Dim 19 Jan - 21:00",
  countdown: "Début dans 01:12:45",
};

const roster: Player[] = [
  {
    id: "p1",
    pseudo: "Nyxara",
    cp: 18900,
    primary: "Greatsword",
    secondary: "Dagger",
    role: "DPS",
  },
  {
    id: "p2",
    pseudo: "Kael",
    cp: 20450,
    primary: "SnS",
    secondary: "Wand",
    role: "Tank",
  },
  {
    id: "p3",
    pseudo: "Lyris",
    cp: 17110,
    primary: "Wand",
    secondary: "Bow",
    role: "DPS",
  },
  {
    id: "p4",
    pseudo: "Thoran",
    cp: 15840,
    primary: "SnS",
    secondary: "Greatsword",
    role: "Tank",
  },
  {
    id: "p5",
    pseudo: "Seraphine",
    cp: 17600,
    primary: "Wand",
    secondary: "Staff",
    role: "Heal",
  },
  {
    id: "p6",
    pseudo: "Eryndor",
    cp: 16220,
    primary: "Bow",
    secondary: "Dagger",
    role: "DPS",
  },
];

const initialPool = roster.map((player) => ({ ...player }));

type PartySlot = {
  id: string;
  label: string;
  members: Player[];
};

const initialParties: PartySlot[] = [
  { id: "g1", label: "Groupe 1", members: [] },
  { id: "g2", label: "Groupe 2", members: [] },
  { id: "g3", label: "Groupe 3", members: [] },
  { id: "g4", label: "Groupe 4", members: [] },
];

const weaponIcon = (weapon: string) => {
  if (weapon === "Wand" || weapon === "Staff") {
    return WandSparkles;
  }
  if (weapon === "Bow" || weapon === "Crossbow") {
    return BowArrow;
  }
  if (weapon === "SnS") {
    return Shield;
  }
  if (weapon === "Dagger") {
    return Crosshair;
  }
  return Sword;
};

export default function RaidDetailPage() {
  const [action, setAction] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [pool, setPool] = useState<Player[]>(initialPool);
  const [parties, setParties] = useState<PartySlot[]>(initialParties);

  const groupedRoster = useMemo(() => {
    const base = {
      Tank: [] as Array<Player & { offSpec: boolean }>,
      DPS: [] as Array<Player & { offSpec: boolean }>,
      Heal: [] as Array<Player & { offSpec: boolean }>,
    };

    roster.forEach((player) => {
      const isWandBow =
        (player.primary === "Wand" && player.secondary === "Bow") ||
        (player.primary === "Bow" && player.secondary === "Wand");

      const role: Role = isWandBow ? "Heal" : player.role;
      base[role].push({ ...player, offSpec: isWandBow });
    });

    return base;
  }, []);

  const selectedPlayer = pool.find((player) => player.id === selectedPlayerId) ?? null;

  const handleAssignToParty = (partyId: string) => {
    if (!selectedPlayer) {
      return;
    }

    setPool((prev) => prev.filter((player) => player.id !== selectedPlayer.id));
    setParties((prev) =>
      prev.map((party) =>
        party.id === partyId
          ? { ...party, members: [...party.members, selectedPlayer] }
          : party
      )
    );
    setSelectedPlayerId(null);
  };

  const publishStrategy = async () => {
    const content = parties
      .map((party) => {
        const members =
          party.members.length === 0
            ? "—"
            : party.members.map((member) => member.pseudo).join(", ");
        return `${party.label}: ${members}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(content);
      setAction("Strat copiée");
    } catch {
      setAction("Copie impossible");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-36">
      <header className="rounded-3xl border border-white/10 bg-surface/50 px-6 py-8 shadow-[0_0_50px_rgba(0,0,0,0.35)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-text/50">
          Mission Briefing
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-[0.12em] text-text sm:text-4xl">
          {raidInfo.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm uppercase tracking-[0.3em] text-text/60">
          <span>{raidInfo.time}</span>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
            {raidInfo.countdown}
          </span>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        {(["Tank", "DPS", "Heal"] as Role[]).map((role) => (
          <div
            key={role}
            className="rounded-2xl border border-white/10 bg-surface/50 p-4 backdrop-blur"
          >
            <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
              {role}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {groupedRoster[role].map((player) => {
                const PrimaryIcon = weaponIcon(player.primary);
                const SecondaryIcon = weaponIcon(player.secondary);
                return (
                  <div
                    key={player.id}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-text/80"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-text/70">
                          <PrimaryIcon className="h-3.5 w-3.5 text-primary" />
                          <SecondaryIcon className="h-3.5 w-3.5 text-gold" />
                        </span>
                        <span className="font-semibold text-text">
                          {player.pseudo}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-text/60">
                        {player.cp} CP
                      </span>
                    </div>
                    {player.offSpec && (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-amber-300">
                        DPS Off-spec
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="fixed inset-x-0 bottom-20 z-40 px-4 sm:sticky sm:bottom-6">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-surface/80 px-4 py-4 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-text/50">
            Zone d&apos;action
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setAction("Inscrit en Tank")}
              className="rounded-2xl bg-sky-500/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
            >
              Tank
            </button>
            <button
              type="button"
              onClick={() => setAction("Inscrit en DPS")}
              className="rounded-2xl bg-red-500/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
            >
              DPS
            </button>
            <button
              type="button"
              onClick={() => setAction("Inscrit en Heal")}
              className="rounded-2xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
            >
              Heal
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
            <button
              type="button"
              onClick={() => setAction("Banc de touche")}
              className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-text/70 transition hover:text-text"
            >
              Banc de touche
            </button>
            <button
              type="button"
              onClick={() => setAction("Absence")}
              className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-text/70 transition hover:text-text"
            >
              Absence
            </button>
            {action && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-primary">
                {action}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setAdminMode((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:text-text"
            >
              <UserCog className="h-4 w-4" />
              Mode Admin
            </button>
            <span className="text-[10px] uppercase tracking-[0.3em] text-text/50">
              Vue officiers
            </span>
          </div>
        </div>
      </section>

      {adminMode && (
        <section className="rounded-3xl border border-white/10 bg-surface/50 px-6 py-8 backdrop-blur">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                Composition
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text">
                Interface Officiers
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => setAction("Présences validées")}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-emerald-300 transition hover:text-emerald-200"
              >
                Valider les Présences
              </button>
              <button
                type="button"
                onClick={publishStrategy}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-text/70 transition hover:text-text"
              >
                <ClipboardCopy className="h-4 w-4" />
                Publier la Strat
              </button>
            </div>
          </header>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                Pool d&apos;inscrits
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {pool.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      selectedPlayerId === player.id
                        ? "border-primary/60 bg-primary/10 text-text"
                        : "border-white/10 bg-black/40 text-text/70 hover:text-text"
                    }`}
                  >
                    <span className="font-semibold">{player.pseudo}</span>
                    <span className="font-mono text-xs">{player.cp} CP</span>
                  </button>
                ))}
                {pool.length === 0 && (
                  <p className="text-xs text-text/50">
                    Aucun inscrit en attente.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {parties.map((party) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => handleAssignToParty(party.id)}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-primary/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                      {party.label}
                    </span>
                    <span className="text-[10px] text-text/40">
                      {party.members.length} membres
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-text/70">
                    {party.members.length === 0 ? (
                      <span className="text-text/40">Slot disponible</span>
                    ) : (
                      party.members.map((member) => (
                        <span key={member.id}>{member.pseudo}</span>
                      ))
                    )}
                  </div>
                  {selectedPlayer && (
                    <span className="text-[11px] uppercase tracking-[0.2em] text-primary">
                      Assigner {selectedPlayer.pseudo}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

