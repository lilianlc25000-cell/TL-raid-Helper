"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DiscordProvisionButtonProps = {
  guildId: string;
};

export default function DiscordProvisionButton({
  guildId,
}: DiscordProvisionButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleProvision = async () => {
    setStatus("loading");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("discord-provision", {
      body: { guild_id: guildId },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message || "Impossible de recréer les salons.");
      return;
    }
    setStatus("success");
    setMessage("Salons recréés.");
  };

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={handleProvision}
        disabled={status === "loading"}
        className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading"
          ? "Réinitialisation..."
          : "Réinitialiser les salons"}
      </button>
      {message ? (
        <p
          className={`text-xs ${
            status === "error" ? "text-red-300" : "text-emerald-200"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
