"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StaticsWarRoom from "@/app/components/StaticsWarRoom";

export default function StaticsPveWarRoomPage() {
  return (
    <div className="min-h-screen text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-text/60">
            Statics
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
            War Room PvE
          </h1>
        </div>
        <Link
          href="/statics-pve"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </header>

      <StaticsWarRoom mode="pve" />
    </div>
  );
}
