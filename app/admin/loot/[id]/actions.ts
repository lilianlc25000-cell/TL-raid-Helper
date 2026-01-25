"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../../lib/supabase/server";

export async function distributeLoot(winnerId: string, itemId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    return { ok: false, error: "Utilisateur non connecté." };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role_rank")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminProfile?.role_rank !== "admin") {
    return { ok: false, error: "Accès refusé." };
  }

  const { data: loot } = await supabase
    .from("active_loot_sessions")
    .select("id,item_name")
    .eq("id", itemId)
    .maybeSingle();

  if (!loot?.id) {
    return { ok: false, error: "Session de loot introuvable." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("loot_received_count")
    .eq("user_id", winnerId)
    .maybeSingle();

  const currentCount = profile?.loot_received_count ?? 0;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ loot_received_count: currentCount + 1 })
    .eq("user_id", winnerId);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message || "Impossible de mettre à jour le profil.",
    };
  }

  const { error: deleteError } = await supabase
    .from("active_loot_sessions")
    .delete()
    .eq("id", itemId);

  if (deleteError) {
    return {
      ok: false,
      error: deleteError.message || "Impossible de clôturer la session.",
    };
  }

  revalidatePath("/admin/loot");
  revalidatePath(`/admin/loot/${itemId}`);

  return { ok: true, itemName: loot.item_name };
}
