import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import type { ItemSlot } from "../../../lib/game-constants";

type ItemTier = "T2" | "T3" | "Archboss";

type GameItemSeed = {
  name: string;
  slot: ItemSlot;
  tier: ItemTier;
  image_url: string;
};

const seedItems: GameItemSeed[] = [
  {
    name: "Tevent's Despair Blade",
    slot: "Main Hand",
    tier: "Archboss",
    image_url: "/items/tevent-despair-blade.png",
  },
  {
    name: "Queen Bellandir's Hive Mind Staff",
    slot: "Main Hand",
    tier: "Archboss",
    image_url: "/items/queen-bellandir-hive-mind-staff.png",
  },
  {
    name: "Deluzhnoa's Ice Wand",
    slot: "Main Hand",
    tier: "Archboss",
    image_url: "/items/deluzhnoa-ice-wand.png",
  },
  {
    name: "Aelon's Rejuvenating Longbow",
    slot: "Main Hand",
    tier: "Archboss",
    image_url: "/items/aelon-rejuvenating-longbow.png",
  },
  {
    name: "Grim Reaper's Hood",
    slot: "Head",
    tier: "T2",
    image_url: "/items/grim-reaper-hood.png",
  },
  {
    name: "Grim Reaper's Robe",
    slot: "Chest",
    tier: "T2",
    image_url: "/items/grim-reaper-robe.png",
  },
  {
    name: "Grim Reaper's Leggings",
    slot: "Legs",
    tier: "T2",
    image_url: "/items/grim-reaper-leggings.png",
  },
  {
    name: "Grim Reaper's Grips",
    slot: "Hands",
    tier: "T2",
    image_url: "/items/grim-reaper-grips.png",
  },
  {
    name: "Grim Reaper's Boots",
    slot: "Feet",
    tier: "T2",
    image_url: "/items/grim-reaper-boots.png",
  },
  {
    name: "Grim Reaper's Cloak",
    slot: "Cloak",
    tier: "T2",
    image_url: "/items/grim-reaper-cloak.png",
  },
  {
    name: "Island of Terror Necklace",
    slot: "Necklace",
    tier: "T2",
    image_url: "/items/island-of-terror-necklace.png",
  },
  {
    name: "Island of Terror Ring",
    slot: "Ring",
    tier: "T2",
    image_url: "/items/island-of-terror-ring.png",
  },
  {
    name: "Island of Terror Bracelet",
    slot: "Bracelet",
    tier: "T2",
    image_url: "/items/island-of-terror-bracelet.png",
  },
  {
    name: "Island of Terror Belt",
    slot: "Belt",
    tier: "T2",
    image_url: "/items/island-of-terror-belt.png",
  },
  {
    name: "Praetor's Dawnblade",
    slot: "Main Hand",
    tier: "T3",
    image_url: "/items/praetor-dawnblade.png",
  },
  {
    name: "Stormsong Staff",
    slot: "Main Hand",
    tier: "T3",
    image_url: "/items/stormsong-staff.png",
  },
  {
    name: "Eclipse Longbow",
    slot: "Main Hand",
    tier: "T3",
    image_url: "/items/eclipse-longbow.png",
  },
  {
    name: "Cataclysm Greatsword",
    slot: "Main Hand",
    tier: "T3",
    image_url: "/items/cataclysm-greatsword.png",
  },
  {
    name: "Seraphim Guard Shield",
    slot: "Off Hand",
    tier: "T3",
    image_url: "/items/seraphim-guard-shield.png",
  },
  {
    name: "Voidcaller Tome",
    slot: "Off Hand",
    tier: "T3",
    image_url: "/items/voidcaller-tome.png",
  },
  {
    name: "Abyssal Warden Helm",
    slot: "Head",
    tier: "T3",
    image_url: "/items/abyssal-warden-helm.png",
  },
  {
    name: "Abyssal Warden Greaves",
    slot: "Legs",
    tier: "T3",
    image_url: "/items/abyssal-warden-greaves.png",
  },
];

export async function POST() {
  const supabase = await createClient();
  const itemNames = seedItems.map((item) => item.name);

  const { data: existing, error: selectError } = await supabase
    .from("game_items")
    .select("name")
    .in("name", itemNames);

  if (selectError) {
    return NextResponse.json(
      { ok: false, error: selectError.message },
      { status: 500 },
    );
  }

  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const toInsert = seedItems.filter((item) => !existingNames.has(item.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: itemNames.length });
  }

  const { error: insertError } = await supabase
    .from("game_items")
    .insert(toInsert);

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: toInsert.length,
    skipped: itemNames.length - toInsert.length,
  });
}
