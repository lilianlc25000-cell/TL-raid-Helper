export type GameItemCategory =
  | "armes"
  | "bagues"
  | "bracelets"
  | "ceintures"
  | "boucles";

export type GameItemRarity = "RARE" | "EPIC" | "LEGENDARY";

export type GameItem = {
  id: string;
  name: string;
  rarity: GameItemRarity;
  category: GameItemCategory;
  slotKey:
    | "main_hand"
    | "off_hand"
    | "ring1"
    | "ring2"
    | "bracelet"
    | "belt"
    | "necklace";
};

const toDisplayName = (filename: string) => {
  const base = filename.replace(/\.png$/i, "").replace(/_/g, " ");
  const words = base.split(" ");
  return words
    .map((word, index) => {
      if (index === 0 || index === words.length - 1) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
};

const weaponFiles = [
  "arbalètes_aux_carreaux_enflammés_de_malakar.png",
  "arbalètes_de_l'éclipse_de_kowazan.png",
  "arc_long_du_fléau_du_grand_aélon.png",
  "bâton_incandescent_de_talus.png",
  "bâton_noueux_immolé_d'aridus.png",
  "bouclier_de_azhreil.png",
  "dagues_d'écorchure_de_minezerok.png",
  "dagues_de_la_lune_rouge_de_kowazan.png",
  "épée_des_cendres_tombées_de_nirma.png",
  "espadon_de_la_flamme_spirituelle_de_morokai.png",
  "espadon_du_cendre_héant_d'adentus.png",
  "lame_de_cautérisation_de_tchernobog.png",
  "lame_de_la_flamme_dansante_de_cornélius.png",
  "lame_du_colosse_rouge_de_junobote.png",
  "noyau_transcendant_de_talus.png",
  "ranseur_super_brûlant_de_junobote.png",
  "spectre_radieux_de_l'excavateur.png",
];

const ringFiles = [
  "anneau_du_sceau_de_davinci.png",
  "bague_de_l'agonie_brutale.png",
];

const braceletFiles = ["bracelet_de_la_brise_infini.png"];

const beltFiles = ["ceinture_du_serment_inébranlable.png"];

const earringFiles = [
  "boucles_d'oreille_d'érudit_de_vénélux.png",
  "boucles_d'oreilles_des_deux_lunes.png",
];

const createItems = (
  files: string[],
  category: GameItemCategory,
  rarity: GameItemRarity,
  slotKey: GameItem["slotKey"],
) =>
  files.map(
    (file): GameItem => ({
      id: `${category}-${file}`,
      name: toDisplayName(file),
      rarity,
      category,
      slotKey,
    }),
  );

export const gameItemsByCategory: Record<GameItemCategory, GameItem[]> = {
  armes: createItems(weaponFiles, "armes", "EPIC", "main_hand"),
  bagues: createItems(ringFiles, "bagues", "EPIC", "ring1"),
  bracelets: createItems(braceletFiles, "bracelets", "RARE", "bracelet"),
  ceintures: createItems(beltFiles, "ceintures", "EPIC", "belt"),
  boucles: createItems(earringFiles, "boucles", "RARE", "necklace"),
};

export const gameItemCategories = [
  { key: "armes", label: "Armes", slotKey: "main_hand" },
  { key: "bagues", label: "Anneaux", slotKey: "ring1" },
  { key: "bracelets", label: "Bracelets", slotKey: "bracelet" },
  { key: "ceintures", label: "Ceintures", slotKey: "belt" },
  { key: "boucles", label: "Boucles d'oreilles", slotKey: "necklace" },
] as const satisfies ReadonlyArray<{
  key: GameItemCategory;
  label: string;
  slotKey: GameItem["slotKey"];
}>;
