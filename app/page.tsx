"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudRain, Skull, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const bossCountdown = "01:42:18";
  const [checkingSession, setCheckingSession] = useState(true);

  const isProfileComplete = (profile: {
    ingame_name?: string | null;
    main_weapon?: string | null;
    off_weapon?: string | null;
    role?: string | null;
    archetype?: string | null;
    gear_score?: number | null;
  } | null) =>
    Boolean(
      profile?.ingame_name?.trim() &&
        profile?.main_weapon &&
        profile?.off_weapon &&
        profile?.role &&
        profile?.archetype &&
        typeof profile?.gear_score === "number" &&
        profile.gear_score > 0,
    );

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (isMounted) {
          setCheckingSession(false);
        }
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id,ingame_name,main_weapon,off_weapon,role,archetype,gear_score")
        .eq("user_id", data.user.id)
        .maybeSingle()) as {
        data:
          | {
              guild_id?: string | null;
              ingame_name?: string | null;
              main_weapon?: string | null;
              off_weapon?: string | null;
              role?: string | null;
              archetype?: string | null;
              gear_score?: number | null;
            }
          | null;
      };
      if (!isProfileComplete(profile)) {
        router.replace("/profile");
        return;
      }
      if (!profile?.guild_id) {
        router.replace("/guild/join");
        return;
      }
      if (isMounted) {
        setCheckingSession(false);
      }
    };
    void checkSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 text-sm text-text/70">
        Vérification de la session...
      </div>
    );
  }

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
        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(251,191,36,0.25)] backdrop-blur">
          <div className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Guilde</h2>
            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 p-2 text-amber-200">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            Consulter les membres et leurs rôles.
          </p>
          <div className="relative mt-auto inline-flex w-fit self-start pt-6">
            <span className="inline-flex rounded-full p-[1px] shadow-[0_0_18px_rgba(251,191,36,0.45)] animate-pulse">
              <Link
                href="/guild"
                className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-100 transition hover:border-amber-300"
              >
                Ouvrir
              </Link>
            </span>
          </div>
        </article>


        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(244,63,94,0.25)] backdrop-blur">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-rose-400/20 blur-2xl" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Statics PvP</h2>
            <span className="rounded-full border border-rose-300/40 bg-rose-400/10 p-2 text-rose-200">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            JcJ : domination, stratégie et performances d'équipe.
          </p>
          <div className="relative mt-auto inline-flex w-fit self-start pt-6">
            <span className="inline-flex rounded-full p-[1px] shadow-[0_0_18px_rgba(244,63,94,0.45)] animate-pulse">
              <Link
                href="/statics-pvp"
                className="inline-flex items-center rounded-full border border-rose-400/60 bg-rose-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-rose-100 transition hover:border-rose-300"
              >
                Ouvrir
              </Link>
            </span>
          </div>
        </article>

        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(16,185,129,0.25)] backdrop-blur">
          <div className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Statics PvE</h2>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 p-2 text-emerald-200">
              <Skull className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            JcE : combats contre les monstres et progression collective.
          </p>
          <div className="relative mt-auto inline-flex w-fit self-start pt-6">
            <span className="inline-flex rounded-full p-[1px] shadow-[0_0_18px_rgba(16,185,129,0.45)] animate-pulse">
              <Link
                href="/statics-pve"
                className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-100 transition hover:border-emerald-300"
              >
                Ouvrir
              </Link>
            </span>
          </div>
        </article>

        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/10 via-surface/60 to-surface/80 p-6 shadow-[0_0_30px_rgba(56,189,248,0.25)] backdrop-blur">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">
              Performance DPS meter
            </h2>
            <span className="rounded-full border border-sky-300/40 bg-sky-400/10 p-2 text-sky-200">
              <CloudRain className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-sm text-text/70">
            Importez vos logs de combat et suivez les meilleurs DPS.
          </p>
          <div className="relative mt-auto inline-flex w-fit self-start pt-6">
            <span className="inline-flex rounded-full p-[1px] shadow-[0_0_18px_rgba(56,189,248,0.45)] animate-pulse">
              <Link
                href="/dps"
                className="inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-sky-100 transition hover:border-sky-300"
              >
                Ouvrir
              </Link>
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
