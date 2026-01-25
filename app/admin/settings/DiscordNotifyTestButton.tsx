"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DiscordNotifyTestButtonProps = {
  channelId: string | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

export default function DiscordNotifyTestButton({
  channelId,
}: DiscordNotifyTestButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleTest = async () => {
    if (!channelId) {
      setToast({
        type: "error",
        message: "Aucun salon de raid configuré.",
      });
      return;
    }
    setStatus("loading");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus("idle");
      setToast({
        type: "error",
        message: "Supabase n'est pas configuré.",
      });
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    const { error } = await supabase.functions.invoke("discord-notify", {
      body: {
        channel_id: channelId,
        embed: {
          title: "✅ Configuration Réussie !",
          description:
            "Le bot TL Raid Manager est opérationnel sur ce salon.",
          color: 0x00ff00,
        },
      },
      headers,
    });

    if (error) {
      setStatus("idle");
      setToast({
        type: "error",
        message: error.message || "Impossible d'envoyer le test.",
      });
      return;
    }

    setStatus("idle");
    setToast({
      type: "success",
      message: "Test envoyé ! Vérifiez votre Discord.",
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading"
          ? "Envoi..."
          : "🔔 Envoyer un message de test"}
      </button>

      {toast ? (
        <div
          className={[
            "fixed left-1/2 top-6 z-[60] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm shadow-[0_0_25px_rgba(0,0,0,0.35)] sm:max-w-md",
            toast.type === "success"
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/60 bg-red-500/10 text-red-200",
          ].join(" ")}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
