"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Settings } from "lucide-react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import NotificationCenter from "./NotificationCenter";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideComms = pathname === "/profile";
  const showBack = pathname !== "/login";

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    void syncUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void syncUser();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setUserId(null);
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-text/70 transition hover:text-text"
              aria-label="Retour"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          {hideComms ? null : (
            <Link
              href="/messages"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-text/70 transition hover:text-text"
              aria-label="Messages"
            >
              <Mail className="h-4 w-4" />
            </Link>
          )}
          <h1 className="font-display text-base tracking-[0.16em] text-gold sm:text-lg sm:tracking-[0.2em]">
            <span>TL Raid</span>
            <span className="hidden sm:inline"> Manager</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {hideComms ? null : <NotificationCenter />}
          {userId ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-text/70 transition hover:text-text"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-surface/95 p-2 text-xs uppercase tracking-[0.2em] text-text/80 shadow-[0_0_25px_rgba(0,0,0,0.45)] backdrop-blur">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs uppercase tracking-[0.2em] text-text/80 transition hover:bg-white/5 hover:text-text"
                  >
                    Se déconnecter
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="whitespace-nowrap rounded-full border border-white/10 bg-surface/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-text/80 transition hover:text-text sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.25em]"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

