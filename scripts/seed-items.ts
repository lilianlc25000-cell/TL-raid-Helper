import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { ItemSlot } from "../lib/game-constants";

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

const loadEnvFile = (filename: string) => {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!key) {
      return;
    }
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Variables manquantes. Définis NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const run = async () => {
  const itemNames = seedItems.map((item) => item.name);
  const { data: existing, error: selectError } = await supabase
    .from("game_items")
    .select("name")
    .in("name", itemNames);

  if (selectError) {
    console.error("Erreur de lecture:", selectError.message);
    process.exit(1);
  }

  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const toInsert = seedItems.filter((item) => !existingNames.has(item.name));

  if (toInsert.length === 0) {
    console.log("Aucun nouvel item à insérer.");
    return;
  }

  const { error: insertError } = await supabase
    .from("game_items")
    .insert(toInsert);

  if (insertError) {
    console.error("Erreur d'insertion:", insertError.message);
    process.exit(1);
  }

  console.log(
    `Seed terminé. Insertions: ${toInsert.length}, doublons: ${
      itemNames.length - toInsert.length
    }.`,
  );
};

run().catch((err) => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
