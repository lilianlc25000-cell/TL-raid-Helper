const toItemSlug = (itemName: string) =>
  itemName
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const slotFolderMap: Record<string, string> = {
  main_hand: "armes",
  off_hand: "armes",
  ring1: "bagues",
  ring2: "bagues",
  bracelet: "bracelets",
  belt: "ceintures",
  necklace: "boucles_d'oreilles",
  head: "armures",
  chest: "armures",
  gloves: "armures",
  legs: "armures",
  feet: "armures",
  cloak: "armures",
};

const getItemFolder = (itemName: string, slotName?: string) => {
  if (slotName && slotFolderMap[slotName]) {
    return slotFolderMap[slotName];
  }
  const normalized = itemName.toLowerCase();
  if (normalized.includes("anneau") || normalized.includes("bague")) {
    return "bagues";
  }
  if (normalized.includes("bracelet")) {
    return "bracelets";
  }
  if (normalized.includes("ceinture")) {
    return "ceintures";
  }
  if (normalized.includes("boucles")) {
    return "boucles_d'oreilles";
  }
  return "armes";
};

export const getItemImage = (itemName: string, slotName?: string) => {
  if (!itemName) {
    return "";
  }
  const slug = toItemSlug(itemName);
  const folder = getItemFolder(itemName, slotName);
  return `/items/${folder}/${slug}.png`;
};

const slotPlaceholders: Record<string, string> = {
  head: "/icons/helmet-placeholder.png",
  chest: "/icons/chest-placeholder.png",
  gloves: "/icons/gloves-placeholder.png",
  legs: "/icons/legs-placeholder.png",
  feet: "/icons/boots-placeholder.png",
  cloak: "/icons/cloak-placeholder.png",
  necklace: "/icons/necklace-placeholder.png",
  bracelet: "/icons/bracelet-placeholder.png",
  ring1: "/icons/ring-placeholder.png",
  ring2: "/icons/ring-placeholder.png",
  belt: "/icons/belt-placeholder.png",
  main_hand: "/icons/weapon-placeholder.png",
  off_hand: "/icons/weapon-placeholder.png",
};

export const getSlotPlaceholder = (slotKey: string) =>
  slotPlaceholders[slotKey] ?? "/icons/gear-placeholder.png";
