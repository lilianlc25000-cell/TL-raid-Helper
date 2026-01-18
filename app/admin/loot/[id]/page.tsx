import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import RollManagerClient from "./RollManagerClient";

type PageProps = {
  params: { id: string };
};

export default async function LootRollManagerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const isUuid =
    typeof resolvedParams.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      resolvedParams.id,
    );
  if (!isUuid) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-6 text-sm text-red-200">
          Identifiant de session invalide : {resolvedParams.id}
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from("active_loot_sessions")
    .select("id,item_name,is_active")
    .eq("id", resolvedParams.id)
    .maybeSingle();

  if (!session?.id) {
    notFound();
  }

  const { data: rolls } = (await supabase
    .from("loot_rolls")
    .select(
      "id,user_id,roll_value,profiles(ingame_name,main_weapon,off_weapon,loot_received_count)",
    )
    .eq("loot_session_id", session.id)) as {
    data:
      | Array<{
          id: string;
          user_id: string;
          roll_value: number;
          profiles: {
            ingame_name: string;
            main_weapon: string | null;
            off_weapon: string | null;
            loot_received_count: number;
          } | null;
        }>
      | null;
  };

  const mappedRolls =
    rolls?.map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      ingameName: entry.profiles?.ingame_name ?? "Inconnu",
      rollValue: entry.roll_value,
      lootReceivedCount: entry.profiles?.loot_received_count ?? 0,
      mainWeapon: entry.profiles?.main_weapon ?? null,
      offWeapon: entry.profiles?.off_weapon ?? null,
    })) ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <RollManagerClient
        itemId={session.id}
        itemName={session.item_name}
        rolls={mappedRolls}
      />
    </div>
  );
}
