"use client";

import Link from "next/link";
import { CloudRain, Moon, Skull, Sun, Users } from "lucide-react";
import { useSolisiumTime } from "@/lib/solisium-time";

export default function Home() {
  const { isNight, timeRemaining } = useSolisiumTime();
  const stateLabel = isNight ? "Nuit" : "Jour";
  const bossCountdown = "01:42:18";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/40 px-5 py-10 text-center shadow-[0_0_60px_rgba(124,58,237,0.25)] backdrop-blur sm:px-10 sm:py-12">
        <div className="absolute inset-x-10 top-1/2 -z-10 h-24 -translate-y-1/2 rounded-full bg-primary/40 blur-3xl" />
        <p className="text-xs uppercase tracking-[0.35em] text-text/50 sm:tracking-[0.6em]">
          Raid Manager
        </p>
        <h1 className="mt-4 font-display text-4xl tracking-[0.08em] text-text sm:text-6xl">
          Throne &amp; Liberty
        </h1>
        <p className="mt-3 text-sm text-text/70 sm:text-base">
          Organisez vos raids, maîtrisez les cycles, et dominez les archboss.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/calendar"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.45)] transition hover:brightness-110"
          >
            S&apos;inscrire au prochain Raid
          </Link>
          <span className="text-xs uppercase tracking-[0.35em] text-gold">
            Premium Dark Fantasy
          </span>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Cycle Jour/Nuit</h2>
            <span className="relative rounded-full border border-white/10 bg-black/30 p-2 text-primary">
              {!isNight ? (
                <>
                  <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-amber-300/40" />
                  <span className="absolute -inset-2 -z-20 animate-spin-slow rounded-full bg-gradient-to-r from-amber-300/20 via-yellow-200/10 to-transparent blur-lg" />
                </>
              ) : null}
              {isNight ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5 text-amber-200" />
              )}
            </span>
          </div>
          <p className="mt-4 text-2xl font-semibold text-text">
            {stateLabel} - Reste {timeRemaining}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-text/50">
            Solisium
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Guilde</h2>
            <span className="rounded-full border border-white/10 bg-black/30 p-2 text-gold">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            Consulter les membres et leurs rôles.
          </p>
          <Link
            href="/guild"
            className="mt-6 inline-flex items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
          >
            Ouvrir la guilde
          </Link>
        </article>

        

        <article className="rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Statics PvP</h2>
            <span className="rounded-full border border-white/10 bg-black/30 p-2 text-primary">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            Statistiques et performances JcJ.
          </p>
          <Link
            href="/statics-pvp"
            className="mt-6 inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
          >
            Ouvrir
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Statics PvE</h2>
            <span className="rounded-full border border-white/10 bg-black/30 p-2 text-gold">
              <Skull className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            Statistiques et performances JcE.
          </p>
          <Link
            href="/statics-pve"
            className="mt-6 inline-flex items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
          >
            Ouvrir
          </Link>
        </article>
      </section>
    </div>
  );
}
