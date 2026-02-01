"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TacticalMap from "@/src/components/tactical-map/TacticalMap";

export default function AdminStrategyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const loadAdminRole = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role_rank")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null } | null;
    };
    const roleRank = (profile?.role_rank ?? "").toLowerCase();
    setIsAdmin(roleRank === "admin" || roleRank === "owner");
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    loadAdminRole();
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadAdminRole();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadAdminRole]);

  if (!isAuthReady) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-10 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
          Vérification
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-200">
          Chargement de votre accès...
        </h1>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-red-500/40 bg-zinc-950 px-6 py-10 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.4em] text-red-300/80">
          Accès refusé
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-red-200">
          Cette zone est réservée aux Administrateurs
        </h1>
        <p className="mt-2 text-sm text-red-200/70">
          Votre compte n&apos;a pas les droits nécessaires.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="rounded-3xl border border-gold/50 bg-surface/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        <p className="text-xs uppercase tracking-[0.4em] text-gold/70">
          ⚔️ Table de Commandement
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
          Stratégie de guilde
        </h1>
      </header>

      <section className="mt-8">
        <TacticalMap isReadOnly={false} />
      </section>
    </div>
  );
}
