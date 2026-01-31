"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EligibilityCriteriaSettingsClient from "@/app/admin/settings/EligibilityCriteriaSettingsClient";
import DiscordChannelManager from "@/app/admin/settings/DiscordChannelManager";

type EligibilityAndDiscordClientProps = {
  ownerId: string | null;
  guildId: string | null;
  initialCriteria: string[];
  initialParticipationThreshold: number;
  initialActivityThreshold: number;
  discordGuildId: string | null;
  discordGuildName: string | null;
  discordChannelConfig: Record<string, boolean> | null;
  oauthUrl: string;
};

type EligibilityCriteria =
  | "loot_received"
  | "participation_points"
  | "activity_points";

export default function EligibilityAndDiscordClient({
  ownerId,
  guildId,
  initialCriteria,
  initialParticipationThreshold,
  initialActivityThreshold,
  discordGuildId,
  discordGuildName,
  discordChannelConfig,
  oauthUrl,
}: EligibilityAndDiscordClientProps) {
  const [criteria, setCriteria] = useState<EligibilityCriteria[]>(
    (initialCriteria as EligibilityCriteria[]) ?? [],
  );
  const allowActivityChannel = useMemo(
    () => criteria.includes("activity_points"),
    [criteria],
  );
  const prevAllowRef = useRef<boolean>(allowActivityChannel);

  useEffect(() => {
    const prev = prevAllowRef.current;
    if (prev === allowActivityChannel) {
      return;
    }
    prevAllowRef.current = allowActivityChannel;
    if (!ownerId || !guildId || !discordGuildId) {
      return;
    }
    const syncActivityChannel = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("guild_configs")
        .select("discord_channel_config")
        .eq("owner_id", ownerId)
        .maybeSingle();
      const currentConfig = (data?.discord_channel_config ??
        {}) as Record<string, boolean>;
      const nextConfig = {
        ...currentConfig,
        activity_points: allowActivityChannel,
      };
      await supabase
        .from("guild_configs")
        .update({ discord_channel_config: nextConfig })
        .eq("owner_id", ownerId);
      await supabase.functions.invoke("discord-provision", {
        body: { guild_id: guildId, channel_config: nextConfig, mode: "custom" },
      });
    };
    void syncActivityChannel();
  }, [allowActivityChannel, discordGuildId, guildId, ownerId]);

  return (
    <>
      <EligibilityCriteriaSettingsClient
        ownerId={ownerId}
        guildId={guildId}
        initialCriteria={criteria}
        initialParticipationThreshold={initialParticipationThreshold}
        initialActivityThreshold={initialActivityThreshold}
        onSaved={setCriteria}
      />

      <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.25em] text-text/50">
          Configuration Discord
        </p>
        <h2 className="mt-2 text-xl font-semibold text-text">
          Connecter votre serveur
        </h2>
        <p className="mt-2 text-sm text-text/70">
          Autorise le bot à rejoindre votre Discord pour créer les salons.
        </p>

        {discordGuildId ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                ✅ Connecté au serveur :{" "}
                {discordGuildName ?? "Serveur Discord"}
              </span>
            </div>
            <DiscordChannelManager
              ownerId={ownerId}
              guildId={discordGuildId}
              allowActivityChannel={allowActivityChannel}
              initialConfig={discordChannelConfig}
            />
          </div>
        ) : oauthUrl ? (
          <a
            href={oauthUrl}
            className="mt-5 inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
          >
            Connecter mon Serveur Discord
          </a>
        ) : (
          <p className="mt-5 text-xs text-amber-200">
            Configure DISCORD_CLIENT_ID et NEXT_PUBLIC_APP_URL.
          </p>
        )}
      </div>
    </>
  );
}
