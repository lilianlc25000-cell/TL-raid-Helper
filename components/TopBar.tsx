"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import NotificationCenter from "./NotificationCenter";

export default function TopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-text/70 transition hover:text-text"
            aria-label="Messages"
          >
            <Mail className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-base tracking-[0.16em] text-gold sm:text-lg sm:tracking-[0.2em]">
            <span>TL Raid</span>
            <span className="hidden sm:inline"> Manager</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationCenter />
          <Link
            href="/login"
            className="whitespace-nowrap rounded-full border border-white/10 bg-surface/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-text/80 transition hover:text-text sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.25em]"
          >
            Connexion
          </Link>
        </div>
      </div>
    </header>
  );
}

