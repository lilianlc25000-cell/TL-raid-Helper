export type ItemSlot =
  | "Main Hand"
  | "Off Hand"
  | "Head"
  | "Chest"
  | "Legs"
  | "Hands"
  | "Feet"
  | "Cloak"
  | "Necklace"
  | "Bracelet"
  | "Ring"
  | "Belt";

export const TRAITS_BY_SLOT: Record<ItemSlot, string[]> = {
  "Main Hand": [
    "Coup critique",
    "Chance d'attaque puissante",
  ],
  "Off Hand": [
    "Coup critique",
    "Chance d'attaque puissante",
  ],
  Head: [
    "Esquive au CàC",
    "Esquive à distance",
    "Esquive magique",
    "Santé max",
    "Régénération de PV",
  ],
  Chest: [
    "Esquive au CàC",
    "Esquive à distance",
    "Esquive magique",
    "Santé max",
    "Régénération de PV",
  ],
  Legs: [
    "Esquive au CàC",
    "Esquive à distance",
    "Esquive magique",
    "Santé max",
    "Régénération de PV",
  ],
  Hands: ["Vitesse d'attaque", "Santé max", "Esquive"],
  Feet: [
    "Vitesse de déplacement",
    "Esquive au CàC",
    "Esquive à distance",
    "Esquive magique",
    "Régénération de PV",
  ],
  Cloak: [
    "Vitesse de recharge",
    "Régénération de mana",
    "Durée d'affaiblissement",
    "Bonus dégâts de compétences",
  ],
  Necklace: [
    "Bonus dégâts de compétences",
    "Durée de renforcement",
    "Mana max",
    "Régénération de mana",
  ],
  Bracelet: [
    "Bonus dégâts de compétences",
    "Durée de renforcement",
    "Mana max",
    "Régénération de mana",
  ],
  Ring: [
    "Bonus dégâts de compétences",
    "Durée de renforcement",
    "Mana max",
    "Régénération de mana",
  ],
  Belt: [
    "Bonus dégâts de compétences",
    "Durée de renforcement",
    "Mana max",
    "Régénération de mana",
  ],
};

export const RARITY_COLORS = {
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#8b5cf6",
  legendary: "#f97316",
} as const;
