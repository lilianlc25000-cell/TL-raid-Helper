import { revalidatePath } from "next/cache";

import ManageClient from "../manage/ManageClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PARTICIPATION_POINTS_PER_RAID } from "@/lib/game-constants";

type PageProps = {
  params: { id: string };
};

type ActionState = {
  ok: boolean;
  message: string;
};

export default async function CloseEventPage({ params }: PageProps) {
  const resolvedParams = await params;
  const supabase = await createSupabaseServerClient();
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
    .select("id,title,cohesion_reward,is_points_distributed")
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

  async function distributePoints(
    prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    "use server";

    const eventId = String(formData.get("eventId") ?? "");
    const absentIdsRaw = String(formData.get("absentIds") ?? "[]");
    const absentIds = new Set<string>(JSON.parse(absentIdsRaw));

    const supabaseServer = await createSupabaseServerClient();
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
