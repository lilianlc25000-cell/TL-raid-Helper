"use server";

import { createSupabaseServerClient } from "../supabase/server";
import { PARTICIPATION_POINTS_PER_RAID } from "../game-constants";
import { notifyDiscordWithResilience } from "../discord/resilience";

type CreateEventInput = {
  title: string;
  eventType: string;
  difficulty: string | null;
  startTime: string;
  description: string | null;
  baseUrl?: string;
};

const PARIS_TIME_ZONE = "Europe/Paris";

const buildDateLabel = (startTime: string) =>
  new Date(startTime).toLocaleDateString("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const buildTimeLabel = (startTime: string) =>
  new Date(startTime).toLocaleTimeString("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

export async function createEvent({
  title,
  eventType,
  difficulty,
  startTime,
  description,
  baseUrl,
}: CreateEventInput) {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "Utilisateur non connecté." };
  }

  const { data, error: insertError } = await supabase
    .from("events")
    .insert({
      title,
      event_type: eventType,
      difficulty,
      start_time: startTime,
      description,
      cohesion_reward: PARTICIPATION_POINTS_PER_RAID,
      status: "planned",
      is_points_distributed: false,
    })
    .select("id,title,event_type,difficulty,start_time,description,cohesion_reward")
    .single();

  if (insertError || !data) {
    return {
      ok: false,
      error: insertError?.message || "Impossible de créer l'événement.",
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  const signupUrl = appUrl ? `${appUrl}/raid/${data.id}` : "";

  try {
    const { data: guildConfig } = await supabase
      .from("guild_configs")
      .select("raid_channel_id")
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (guildConfig?.raid_channel_id) {
      const fields = [
        { name: "Date", value: buildDateLabel(data.start_time), inline: true },
        { name: "Heure", value: buildTimeLabel(data.start_time), inline: true },
      ];

      if (signupUrl) {
        fields.push({ name: "Inscription", value: signupUrl });
      }

      await notifyDiscordWithResilience({
        supabase,
        accessToken,
        ownerId: auth.user.id,
        payload: {
          channel_id: guildConfig.raid_channel_id,
          embed: {
            title: data.title,
            description: "Inscription ouverte sur le raid.",
            url: signupUrl || undefined,
            fields,
            color: 0x00ff00,
          },
        },
      });
    }
  } catch {
    // Ignore discord notification failures.
  }

  return { ok: true, event: data };
}
