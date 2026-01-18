const mockLootRequests = [
  {
    joueur: "Nyxara",
    points_cohesion: 82,
    item_voulu: "Épée d'Améthyste",
    priority: 1,
  },
  {
    joueur: "Kael",
    points_cohesion: 43,
    item_voulu: "Arc de Brume",
    priority: 2,
  },
  {
    joueur: "Lyris",
    points_cohesion: 65,
    item_voulu: "Gants du Crépuscule",
    priority: 1,
  },
  {
    joueur: "Thoran",
    points_cohesion: 58,
    item_voulu: "Bouclier de l'Aurore",
    priority: 3,
  },
  {
    joueur: "Seraphine",
    points_cohesion: 37,
    item_voulu: "Amulette du Néant",
    priority: 1,
  },
];

const sortedLootRequests = [...mockLootRequests].sort((a, b) => {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  return b.points_cohesion - a.points_cohesion;
});

export default function LootTable() {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface/60 p-5 backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-text/50">
            Dimanche soir
          </p>
          <h2 className="mt-1 text-lg font-semibold text-text">
            Loot Eligibility
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-gold">
          Priorités
        </span>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-12 gap-3 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-text/50">
          <span className="col-span-4">Joueur</span>
          <span className="col-span-2 text-center">Cohésion</span>
          <span className="col-span-4">Item</span>
          <span className="col-span-2 text-right">Priorité</span>
        </div>
        <div className="divide-y divide-white/5">
          {sortedLootRequests.map((entry) => {
            const isEligible = entry.points_cohesion >= 50;
            return (
              <div
                key={`${entry.joueur}-${entry.item_voulu}`}
                className="grid grid-cols-12 gap-3 px-4 py-3 text-sm text-text/80"
              >
                <div className="col-span-4 flex flex-wrap items-center gap-2">
                  <span className={isEligible ? "text-emerald-300" : "text-red-400"}>
                    {entry.joueur}
                  </span>
                  {!isEligible && (
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-300">
                      Non Éligible
                    </span>
                  )}
                </div>
                <span className="col-span-2 text-center font-mono text-text/90">
                  {entry.points_cohesion}
                </span>
                <span className="col-span-4 text-text/90">
                  {entry.item_voulu}
                </span>
                <span className="col-span-2 text-right font-semibold text-gold">
                  P{entry.priority}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

