"use client";

import { TRAITS_BY_SLOT } from "../../../lib/game-constants";

export default function LootTraitsPage() {
  const allTraits = Array.from(
    new Set(Object.values(TRAITS_BY_SLOT).flat()),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-text/60">
          Traits Throne and Liberty
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.12em] text-text">
          Liste des traits possibles
        </h1>
        <p className="mt-2 text-sm text-text/60">
          Référence des traits pour les items de la Brocante.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.25)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.25em] text-text/60">
          Tous les traits
        </p>
        <div className="mt-4 grid gap-3 text-sm text-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
          {allTraits.map((trait) => (
            <div key={trait} className="flex items-center gap-2">
              <span className="text-amber-200">◆</span>
              <span>{trait}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
