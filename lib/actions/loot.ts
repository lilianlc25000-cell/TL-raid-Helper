"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";

export async function distributeLoot(winnerId: string, itemId: string) {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  const adminId = auth.user?.id;
  if (!adminId) {
    return { ok: false, error: "Utilisateur non connecté." };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role_rank")
    .eq("user_id", adminId)
    .maybeSingle();
  if (
    adminProfile?.role_rank !== "admin" &&
    adminProfile?.role_rank !== "conseiller"
  ) {
    return { ok: false, error: "Accès refusé." };
  }

  const { data: lootSession, error: lootError } = await supabase
    .from("active_loot_sessions")
    .select("id,item_name")
    .eq("id", itemId)
    .maybeSingle();

  if (lootError || !lootSession?.id) {
    return {
      ok: false,
      error: lootError?.message || "Session de loot introuvable.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("loot_received_count")
    .eq("user_id", winnerId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: profileError.message || "Impossible de charger le vainqueur.",
    };
  }

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

  await supabase
    .from("loot_rolls")
    .delete()
    .or(`loot_session_id.eq.${itemId},item_name.eq.${lootSession.item_name}`);

  await supabase.from("notifications").insert({
    user_id: winnerId,
    type: "loot_assigned",
    message:
      "Vous avez gagné le roll, vous allez bientôt recevoir votre loot dans le jeu.",
    is_read: false,
  });

  // Optionnel: historiser si la table existe.
  try {
    await supabase.from("loot_history").insert({
      user_id: winnerId,
      item_name: lootSession.item_name,
    });
  } catch {
    // Ignore si la table n'existe pas.
  }

  revalidatePath("/admin/loot");
  revalidatePath(`/admin/loot/${itemId}`);

  return { ok: true, itemName: lootSession.item_name };
}
