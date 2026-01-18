"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getItemImage, getSlotPlaceholder } from "../../../../lib/items";
import { distributeLoot } from "../../../../lib/actions/loot";

type RollEntry = {
  id: string;
  userId: string;
  ingameName: string;
  rollValue: number;
  lootReceivedCount: number;
  mainWeapon?: string | null;
  offWeapon?: string | null;
};

type RollManagerClientProps = {
  itemId: string;
  itemName: string;
  rolls: RollEntry[];
};

const formatClassName = (mainWeapon?: string | null, offWeapon?: string | null) => {
  if (!mainWeapon || !offWeapon) {
    return "Classe inconnue";
  }
  return `${mainWeapon} / ${offWeapon}`;
};

export default function RollManagerClient({
  itemId,
  itemName,
  rolls,
}: RollManagerClientProps) {
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const sortedRolls = useMemo(() => {
    return [...rolls].sort((a, b) => {
      if (b.rollValue !== a.rollValue) {
        return b.rollValue - a.rollValue;
      }
      return a.lootReceivedCount - b.lootReceivedCount;
    });
  }, [rolls]);

  const imageSrc = imageError
    ? getSlotPlaceholder("main_hand")
    : getItemImage(itemName);

  const handleAssign = (entry: RollEntry) => {
    const confirmed = window.confirm(
      `Confirmer le don de ${itemName} à ${entry.ingameName} ?`,
    );
    if (!confirmed) {
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const result = await distributeLoot(entry.userId, itemId);
      if (!result.ok) {
        setErrorMessage(result.error ?? "Une erreur est survenue.");
        return;
      }
      router.push("/admin/loot");
    });
  };

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Gestion du roll
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70">
            <Image
              src={imageSrc}
              alt={itemName}
              width={64}
              height={64}
              className="h-16 w-16 rounded-md object-contain"
              unoptimized
              onError={() => setImageError(true)}
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">{itemName}</h1>
            <p className="text-sm text-zinc-500">
              Classement par score de dé, puis par loots reçus.
            </p>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-5">
        <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
          <span>Participants</span>
          <span className="font-mono text-zinc-400">
            {sortedRolls.length.toString().padStart(2, "0")}
          </span>
        </div>
        {sortedRolls.length === 0 ? (
          <div className="rounded-md border border-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
            Aucun lancer enregistré pour cet item.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRolls.map((entry, index) => (
              <div
                key={entry.id}
                className="flex flex-col gap-4 rounded-md border border-zinc-900 bg-zinc-950/40 px-4 py-4 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300">
                    {index + 1}
                    <span className="sr-only">ème</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      {entry.ingameName}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatClassName(entry.mainWeapon, entry.offWeapon)} ·{" "}
                      {entry.lootReceivedCount} loots reçus
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-amber-400/60 bg-amber-950/40 px-3 py-1 text-sm font-semibold text-amber-200">
                    🎲 {entry.rollValue}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAssign(entry)}
                    disabled={isPending}
                    className="rounded-md border border-emerald-600 bg-emerald-950 px-3 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Attribution..." : "Attribuer le loot"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
