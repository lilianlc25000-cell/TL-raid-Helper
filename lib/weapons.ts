const normalizeWeaponName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getWeaponFile = (weaponName: string) => {
  const normalized = normalizeWeaponName(weaponName);
  if (normalized.includes("arbal")) {
    return "arbalete.png";
  }
  if (normalized.includes("arc")) {
    return "arc_long.png";
  }
  if (normalized.includes("baguette")) {
    return "baguette.png";
  }
  if (normalized.includes("baton") || normalized.includes("bton")) {
    return "baton.png";
  }
  if (normalized.includes("dague")) {
    return "dagues.png";
  }
  if (normalized.includes("espadon")) {
    return "espadon.png";
  }
  if (normalized.includes("lance")) {
    return "lance.png";
  }
  if (normalized.includes("orbe")) {
    return "orbe.png";
  }
  if (normalized.includes("bouclier") || normalized.includes("epee")) {
    return "epee_bouclier.png";
  }
  return "";
};

export const getWeaponImage = (weaponName?: string | null) => {
  if (!weaponName) {
    return "";
  }
  const file = getWeaponFile(weaponName);
  return file ? `/weapons/${file}` : "";
};
