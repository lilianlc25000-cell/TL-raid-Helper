import RosterClient from "./RosterClient";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { id: string };
};

export default async function ManageEventPage({ params }: PageProps) {
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
    .select("id,title,start_time,event_type")
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
    .select(
      "user_id,status,assigned_role,selected_build_id,profiles(ingame_name,role,archetype,main_weapon,off_weapon),player_builds(id,build_name,role,archetype,main_weapon,off_weapon)",
    )
    .eq("event_id", resolvedParams.id)
    .in("status", ["present", "tentative", "bench"]);

  const mappedSignups =
    signups?.map((signup) => {
      const profile = Array.isArray(signup.profiles)
        ? signup.profiles[0]
        : signup.profiles;
      const build = Array.isArray(signup.player_builds)
        ? signup.player_builds[0]
        : signup.player_builds;
      return {
        userId: signup.user_id,
        status: signup.status as "present" | "tentative" | "bench",
        ingameName: profile?.ingame_name ?? "Inconnu",
        role: build?.role ?? profile?.role ?? null,
        assignedRole: signup.assigned_role ?? null,
        archetype: build?.archetype ?? profile?.archetype ?? null,
        mainWeapon: build?.main_weapon ?? profile?.main_weapon ?? null,
        offWeapon: build?.off_weapon ?? profile?.off_weapon ?? null,
      };
    }) ?? [];
  return (
    <RosterClient
      eventId={resolvedParams.id}
      eventTitle={event.title}
      eventStartTime={event.start_time}
      eventType={event.event_type}
      signups={mappedSignups}
    />
  );
}
