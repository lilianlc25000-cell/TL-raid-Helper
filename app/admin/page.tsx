"use client";

import Link from "next/link";
import {
  CalendarPlus,
  Gem,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

const tools = [
  {
    title: "Distribution de Loots",
    description: "Gérer l'attribution des items du dimanche",
    href: "/admin/loot",
    icon: Gem,
    accent: "from-violet-500/20 via-violet-500/10 to-amber-400/10",
    border: "border-violet-400/40",
    text: "text-amber-200",
  },
  {
    title: "Roulette de loot",
    description: "Tirage rapide pour un item de wishlist",
    href: "/admin/loot/roulette",
    icon: Gem,
    accent: "from-sky-500/20 via-indigo-500/10 to-purple-500/10",
    border: "border-sky-400/40",
    text: "text-sky-200",
  },
  {
    title: "Création d'Événement",
    description: "Planifier le prochain Siege ou Archboss",
    href: "/admin/events",
    icon: CalendarPlus,
    accent: "from-emerald-500/20 via-emerald-500/10 to-green-500/10",
    border: "border-emerald-400/40",
    text: "text-emerald-200",
  },
  {
    title: "Sondages",
    description: "Créer et suivre les votes de guilde",
    href: "/admin/polls",
    icon: Users,
    accent: "from-sky-500/20 via-sky-500/10 to-blue-500/10",
    border: "border-sky-400/40",
    text: "text-sky-200",
  },
  {
    title: "Éligibilité des membres",
    description: "Classement participation + wishlist loot",
    href: "/admin/eligibility",
    icon: ShieldCheck,
    accent: "from-amber-500/20 via-amber-500/10 to-red-500/10",
    border: "border-amber-400/40",
    text: "text-amber-200",
  },
  {
    title: "Paramètres",
    description: "Configurer Discord et le système de loot",
    href: "/admin/settings",
    icon: Settings,
    accent: "from-sky-500/20 via-sky-500/10 to-indigo-500/10",
    border: "border-sky-400/40",
    text: "text-sky-200",
  },
  {
    title: "👮 Permissions Conseiller",
    description: "Activer les droits par conseiller",
    href: "/admin/permissions",
    icon: UserRound,
    accent: "from-amber-500/20 via-amber-500/10 to-rose-500/10",
    border: "border-amber-400/40",
    text: "text-amber-200",
  },
];

export default function AdminDashboardPage() {
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
    setIsAdmin(
      profile?.role_rank === "admin" || profile?.role_rank === "conseiller",
    );
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
          Cette zone est réservée aux Officiers
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
          Centre de Commandement
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
          Dashboard Admin
        </h1>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.title}
              href={tool.href}
              className={`group rounded-3xl border ${tool.border} bg-gradient-to-br ${tool.accent} p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40">
                  <Icon className={`h-6 w-6 ${tool.text}`} />
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-text/60">
                  Outil
                </span>
              </div>
              <h2 className="mt-6 text-xl font-semibold text-text">
                {tool.title}
              </h2>
              <p className="mt-2 text-sm text-text/70">{tool.description}</p>
              <span className="mt-6 inline-flex items-center text-xs uppercase tracking-[0.25em] text-text/70 transition group-hover:text-text">
                Accéder
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
