"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getItemImage, getSlotPlaceholder } from "../../lib/items";

export type ItemRarity = "RARE" | "EPIC" | "LEGENDARY";

export type ItemOption = {
  id: string;
  name: string;
  rarity: ItemRarity;
  slot: string;
};

type ItemSelectorProps = {
  slotName: string;
  slotKey: string;
  items: ItemOption[];
  onSelect: (item: ItemOption) => void;
};

const rarityBorder: Record<ItemRarity, string> = {
  RARE: "border-sky-500",
  EPIC: "border-violet-500",
  LEGENDARY: "border-amber-400",
};

export default function ItemSelector({
  slotName,
  slotKey,
  items,
  onSelect,
}: ItemSelectorProps) {
  const [query, setQuery] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!normalized) {
        return true;
      }
      return item.name.toLowerCase().includes(normalized);
    });
  }, [items, query]);

  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        Rechercher un objet pour {slotName.toUpperCase()}
      </label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex: Capuche du Chasseur"
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
      />

      <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">
            Aucun item trouvé.
          </div>
        ) : (
          filteredItems.map((item) => {
            const hasError = imageErrors[item.id];
            const placeholderSrc = getSlotPlaceholder(slotKey);
            const noneImage = "/items/rien/riien.png";
            const imageSrc =
              item.id === "none"
                ? noneImage
                : hasError
                  ? placeholderSrc
                  : getItemImage(item.name, slotKey);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-3 border-b border-zinc-900 px-4 py-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-900/60"
              >
                <div
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-md border bg-zinc-900/60",
                    rarityBorder[item.rarity],
                  ].join(" ")}
                >
                  <Image
                    src={imageSrc}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-md object-cover"
                    unoptimized
                    onError={() => {
                      if (hasError) {
                        return;
                      }
                      setImageErrors((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{item.name}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {item.rarity}
                  </div>
                </div>
                <span
                  className={[
                    "rounded-full border px-2 py-1 text-xs uppercase tracking-[0.2em]",
                    rarityBorder[item.rarity],
                  ].join(" ")}
                >
                  {item.rarity}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
