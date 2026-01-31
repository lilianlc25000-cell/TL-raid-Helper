import { revalidatePath } from "next/cache";

import ManageClient from "../manage/ManageClient";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPATION_POINTS_PER_RAID } from "@/lib/game-constants";
import { notifyDiscordWithResilience } from "@/lib/discord/resilience";

type PageProps = {
  params: { id: string };
};

type ActionState = {
  ok: boolean;
  message: string;
};

const PARIS_TIME_ZONE = "Europe/Paris";
const normalizeEventType = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

const EVENT_IMAGE_BY_TYPE: Record<string, string> = {
  calanthia:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Calanthia.png",
  chateau:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Chateau.png",
  pierrefaille:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Pierre_de_faille.png",
  pierredefaille:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Pierre_de_faille.png",
  raiddeguilde:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Raid_de_guilde.png",
  raidboss:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Raid_de_guilde.png",
  siege:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Chateau.png",
  taxe:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Taxe.png",
  taxdelivery:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/Taxe.png",
  wargame:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/War_game.png",
  wargames:
    "https://dyfveohlpzjqanhazmet.supabase.co/storage/v1/object/public/discord-assets/War_game.png",
};

const getEventImageUrl = (eventType: string | null) => {
  if (!eventType) return undefined;
  const normalized = normalizeEventType(eventType);
  if (!normalized) return undefined;
  if (EVENT_IMAGE_BY_TYPE[normalized]) {
    return EVENT_IMAGE_BY_TYPE[normalized];
  }
  const matchKey = Object.keys(EVENT_IMAGE_BY_TYPE).find((key) =>
    normalized.includes(key),
  );
  return matchKey ? EVENT_IMAGE_BY_TYPE[matchKey] : undefined;
};

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

export default async function CloseEventPage({ params }: PageProps) {
  const resolvedParams = await params;
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="rounded-3xl border border-red-500/40 bg-zinc-950 px-6 py-8 text-red-200">
          Supabase n&apos;est pas configuré (URL / ANON KEY).
        </div>
      </div>
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("id,title,event_type,start_time,description,cohesion_reward,is_points_distributed")
    .eq("id", resolvedParams.id)
    .single();

  if (!event) {
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="rounded-3xl border border-red-500/40 bg-zinc-950 px-6 py-8 text-red-200">
          Événement introuvable.
        </div>
      </div>
    );
  }

  const { data: signups } = await supabase
    .from("event_signups")
    .select("user_id,status,profiles(ingame_name,role)")
    .eq("event_id", resolvedParams.id)
    .in("status", ["present", "tentative", "bench"]);

  const mappedSignups =
    signups?.map((signup) => {
      const profile = Array.isArray(signup.profiles)
        ? signup.profiles[0]
        : signup.profiles;
      return {
        userId: signup.user_id,
        status: signup.status as "present" | "tentative" | "bench",
        ingameName: profile?.ingame_name ?? "Inconnu",
        role: profile?.role ?? null,
      };
    }) ?? [];

  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id ?? null;
  const { data: guildConfig } = ownerId
    ? await supabase
        .from("guild_configs")
        .select("discord_guild_id,raid_channel_id,eligibility_criteria")
        .eq("owner_id", ownerId)
        .maybeSingle()
    : { data: null };
  const eligibilityCriteria = (guildConfig?.eligibility_criteria ?? []) as string[];
  const participationEnabled = eligibilityCriteria.includes("participation_points");

  async function notifyEventClosed() {
    if (!ownerId) {
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const dayCategory = event.start_time
      ? weekdayToDiscordCategory(buildWeekdayKey(event.start_time))
      : null;
    const targetChannelId =
      dayCategory ? undefined : guildConfig?.raid_channel_id ?? undefined;
    if (!dayCategory && !targetChannelId) {
      return;
    }
    const timestamp = event.start_time
      ? Math.floor(new Date(event.start_time).getTime() / 1000)
      : null;
    const imageUrl = getEventImageUrl(event.event_type ?? null);
    await notifyDiscordWithResilience({
      supabase,
      accessToken,
      ownerId,
      payload: {
        channel_id: targetChannelId,
        guild_id: dayCategory ? guildConfig?.discord_guild_id ?? undefined : undefined,
        channel_name: dayCategory ? "📝-inscription-event" : undefined,
        parent_name: dayCategory ?? undefined,
        embed: {
          title: "Événement terminé",
          description: [
            `**${event.title}**`,
            timestamp ? `Date : <t:${timestamp}:F>` : "Date : inconnue",
            "Merci pour votre participation.",
          ].join("\n"),
          color: 0xffa600,
          image: imageUrl ? { url: imageUrl } : undefined,
        },
        replace: {
          match_title_prefix: `⚔️ **${event.title.toUpperCase()}`,
          limit: 25,
        },
      },
    });
  }

  async function closeEventWithoutPoints() {
    await notifyEventClosed();
    await supabase
      .from("events")
      .update({ status: "completed", is_points_distributed: true })
      .eq("id", event.id);
    await supabase.from("event_signups").delete().eq("event_id", event.id);
    await supabase.from("events").delete().eq("id", event.id);
    revalidatePath("/calendar");
    revalidatePath("/groups");
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${event.id}/close`);
  }

  async function distributePoints(
    prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    "use server";

    const eventId = String(formData.get("eventId") ?? "");
    const absentIdsRaw = String(formData.get("absentIds") ?? "[]");
    const absentIds = new Set<string>(JSON.parse(absentIdsRaw));

    const supabaseServer = await createClient();
    if (!supabaseServer) {
      return {
        ok: false,
        message: "Supabase n'est pas configuré (URL / ANON KEY).",
      };
    }

    const { data: currentEvent } = await supabaseServer
      .from("events")
      .select("id,title,cohesion_reward,is_points_distributed")
      .eq("id", eventId)
      .single();

    if (!currentEvent) {
      return { ok: false, message: "Événement introuvable." };
    }

    if (currentEvent.is_points_distributed) {
      return {
        ok: false,
        message: "Les points ont déjà été distribués pour cet événement.",
      };
    }

    const { data: participants } = await supabaseServer
      .from("event_signups")
      .select("user_id,status,profiles(ingame_name,cohesion_points)")
      .eq("event_id", eventId)
      .in("status", ["present", "tentative", "bench"]);

    const eligibleParticipants =
      participants?.filter((signup) => !absentIds.has(signup.user_id)) ?? [];

    const absentParticipants =
      participants?.filter((signup) => absentIds.has(signup.user_id)) ?? [];

    await Promise.all(
      eligibleParticipants.map((signup) => {
        const profile = Array.isArray(signup.profiles)
          ? signup.profiles[0]
          : signup.profiles;
        const currentPoints = profile?.cohesion_points ?? 0;
        return supabaseServer
          .from("profiles")
          .update({
            cohesion_points: currentPoints + PARTICIPATION_POINTS_PER_RAID,
          })
          .eq("user_id", signup.user_id);
      }),
    );

    let notificationWarning: string | null = null;
    if (eligibleParticipants.length > 0) {
      const { error: notifyError } = await supabaseServer
        .from("notifications")
        .insert(
          eligibleParticipants.map((signup) => ({
            user_id: signup.user_id,
            type: "points_received",
            message: `Raid ${currentEvent.title} terminé : +${PARTICIPATION_POINTS_PER_RAID} point${PARTICIPATION_POINTS_PER_RAID > 1 ? "s" : ""} de participation !`,
            is_read: false,
          })),
        );
      if (notifyError) {
        notificationWarning = notifyError.message || "Notifications non envoyées.";
      }
    }

    if (absentParticipants.length > 0) {
      await supabaseServer
        .from("event_signups")
        .update({ status: "absent" })
        .in(
          "user_id",
          absentParticipants.map((signup) => signup.user_id),
        )
        .eq("event_id", eventId);
    }

    await supabaseServer
      .from("events")
      .update({ status: "completed", is_points_distributed: true })
      .eq("id", eventId);

    await notifyEventClosed();

    await supabaseServer.from("event_signups").delete().eq("event_id", eventId);
    await supabaseServer.from("events").delete().eq("id", eventId);

    revalidatePath("/calendar");
    revalidatePath("/groups");
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${eventId}/close`);

    return {
      ok: true,
      message: notificationWarning
        ? `Points distribués. ${notificationWarning}`
        : "Points distribués avec succès !",
    };
  }

  if (!participationEnabled) {
    await closeEventWithoutPoints();
    return (
      <div className="min-h-screen text-zinc-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-10 text-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
            Événement terminé
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-emerald-100">
            L&apos;événement a été clôturé.
          </h1>
        </div>
      </div>
    );
  }

  return (
    <ManageClient
      eventId={resolvedParams.id}
      event={{
        id: event.id,
        title: event.title,
        cohesionReward: event.cohesion_reward,
        isPointsDistributed: event.is_points_distributed,
      }}
      signups={mappedSignups}
      action={distributePoints}
    />
  );
}
