"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DiceRollerProps = {
  isOpen: boolean;
  itemName: string;
  playerName?: string;
  requestId?: string;
  onClose: () => void;
  onSubmitRoll?: (rollValue: number) => Promise<void> | void;
};

const getRandomRoll = () => Math.floor(Math.random() * 99) + 1;

export default function DiceRoller({
  isOpen,
  itemName,
  playerName,
  requestId,
  onClose,
  onSubmitRoll,
}: DiceRollerProps) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const [noiseText, setNoiseText] = useState("00 00 00");
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const resetState = () => {
    setRolling(false);
    setResult(null);
    setDisplayValue(null);
    setNoiseText("00 00 00");
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      resetState();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, requestId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const glowClass = useMemo(() => {
    if (result === null) {
      return "dice-glow-neutral";
    }
    if (result > 90) {
      return "dice-glow-gold";
    }
    if (result > 70) {
      return "dice-glow-violet";
    }
    if (result < 20) {
      return "dice-glow-ash";
    }
    return "dice-glow-neutral";
  }, [result]);

  const handleRoll = async () => {
    if (rolling || result !== null) {
      return;
    }
    setRolling(true);
    intervalRef.current = window.setInterval(() => {
      setDisplayValue(getRandomRoll());
      setNoiseText(
        `${getRandomRoll().toString().padStart(2, "0")} ${getRandomRoll()
          .toString()
          .padStart(2, "0")} ${getRandomRoll().toString().padStart(2, "0")}`,
      );
    }, 60);

    timeoutRef.current = window.setTimeout(async () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      const finalRoll = getRandomRoll();
      setResult(finalRoll);
      setDisplayValue(finalRoll);
      setRolling(false);
      await onSubmitRoll?.(finalRoll);
    }, 2000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_45px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Roll demandé
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">
              {itemName || "Objet inconnu"}
            </h2>
            {playerName ? (
              <p className="mt-1 text-sm text-zinc-400">
                Destinataire : {playerName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={rolling}
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            Fermer
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div
            className={[
              "dice-orb",
              glowClass,
              rolling ? "dice-orb-spin" : "",
            ].join(" ")}
          />
          <div className="text-center">
            <div
              className={[
                "text-5xl font-mono tracking-[0.2em] text-zinc-100",
                rolling ? "dice-number-flicker" : "",
              ].join(" ")}
            >
              {displayValue === null
                ? "--"
                : displayValue.toString().padStart(2, "0")}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
              {rolling ? "Transmission..." : "Résultat final"}
            </div>
            <div className="dice-noise mt-3 font-mono text-xs text-zinc-500">
              {rolling ? noiseText : "00 00 00"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRoll}
          disabled={rolling || result !== null}
          className="mt-8 w-full rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {rolling
            ? "Lancer en cours..."
            : result !== null
              ? `Résultat : ${result}`
              : "LANCER LE DÉ (1-99)"}
        </button>
      </div>
    </div>
  );
}
