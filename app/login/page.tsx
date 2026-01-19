"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type Tab = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const resolvePostLoginRoute = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return "/guild/join";
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      return "/guild/join";
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("guild_id")
      .eq("user_id", userId)
      .maybeSingle()) as { data: { guild_id?: string | null } | null };
    return profile?.guild_id ? "/" : "/guild/join";
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !password) {
      setError("Veuillez renseigner l'email et le mot de passe.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    setSuccess("Connexion réussie. Redirection...");
    const nextRoute = await resolvePostLoginRoute();
    router.push(nextRoute);
    router.refresh();
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !password) {
      setError("Veuillez renseigner l'email et le mot de passe.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setSuccess(
        "Compte créé. Vérifie ton email si l'accès est restreint, puis connecte-toi.",
      );
      setLoading(false);
      return;
    }
    setSuccess("Compte créé ! Connexion en cours...");
    const nextRoute = await resolvePostLoginRoute();
    router.push(nextRoute);
    router.refresh();
  };

  const handleDiscordLogin = async () => {
    setError(null);
    setSuccess(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setOauthLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/guild/join`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(false);
      return;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.25),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(15,23,42,0.8),_transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-14">
        <header className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300/70">
            TL RAID MANAGER
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-[0.2em] text-zinc-50 drop-shadow-[0_0_25px_rgba(251,191,36,0.35)]">
            Portail du Royaume
          </h1>
        </header>

        <div className="w-full rounded-3xl border border-amber-400/30 bg-white/5 p-8 shadow-[0_0_35px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="flex rounded-full border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={[
                "flex-1 rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                tab === "login"
                  ? "bg-amber-400/20 text-amber-200"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              Se Connecter
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={[
                "flex-1 rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                tab === "signup"
                  ? "bg-amber-400/20 text-amber-200"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              S&apos;Inscrire
            </button>
          </div>

          <form
            onSubmit={tab === "login" ? handleLogin : handleRegister}
            className="mt-6 space-y-4"
          >
            <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.25em] text-zinc-400">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ex: agent@raid.com"
                className="bg-transparent text-sm text-zinc-100 outline-none"
              />
            </label>

            <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.25em] text-zinc-400">
                Mot de passe
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="bg-transparent text-sm text-zinc-100 outline-none"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl border border-amber-400/50 bg-amber-400/10 px-5 py-3 text-xs uppercase tracking-[0.3em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Connexion..."
                : tab === "login"
                  ? "Entrer dans le Royaume"
                  : "Rejoindre TL Raid Manager"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            <span className="h-px flex-1 bg-white/10" />
            ou
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={oauthLoading}
            className="mt-4 w-full rounded-2xl border border-indigo-400/50 bg-indigo-400/10 px-5 py-3 text-xs uppercase tracking-[0.3em] text-indigo-200 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthLoading ? "Connexion..." : "Se connecter avec Discord"}
          </button>
        </div>
      </div>
    </div>
  );
}
