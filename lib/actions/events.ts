"use server";

import { createClient } from "../supabase/server";
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

const buildWeekdayKey = (startTime: string) =>
  new Date(startTime)
    .toLocaleDateString("fr-FR", {
      timeZone: PARIS_TIME_ZONE,
      weekday: "long",
    })
    .toLowerCase();

const weekdayToDiscordCategory = (weekday: string) => {
  const normalized = weekday
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    lundi: "📆-Lundi",
    mardi: "📆-Mardi",
    mercredi: "📆-Mercredi",
    jeudi: "📆-Jeudi",
    vendredi: "📆-Vendredi",
    samedi: "📆-Samedi",
    dimanche: "📆-Dimanche",
  };
  return map[normalized] ?? null;
};

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
  const supabase = await createClient();

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
  const calendarUrl = appUrl ? `${appUrl}/calendar` : "";

  try {
    const { data: guildConfig } = await supabase
      .from("guild_configs")
      .select("raid_channel_id,discord_guild_id")
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (guildConfig?.discord_guild_id || guildConfig?.raid_channel_id) {
      const dateLabel = buildDateLabel(data.start_time);
      const timeLabel = buildTimeLabel(data.start_time);
      const weekdayKey = buildWeekdayKey(data.start_time);
      const dayCategory = weekdayToDiscordCategory(weekdayKey);

      await notifyDiscordWithResilience({
        supabase,
        accessToken,
        ownerId: auth.user.id,
        payload: {
          channel_id: guildConfig.raid_channel_id ?? undefined,
          guild_id: guildConfig.discord_guild_id ?? undefined,
          channel_name: dayCategory ? "📝-inscription-event" : undefined,
          parent_name: dayCategory ?? undefined,
          embed: {
            title: `⚔️ Nouveau Raid : ${data.title}`,
            description: `Date : ${dateLabel} à ${timeLabel}\nRéservez votre place dès maintenant !`,
            url: calendarUrl || undefined,
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
