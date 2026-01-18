"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import ItemSelector, { ItemOption } from "../../components/ItemSelector";
import { getItemImage, getSlotPlaceholder } from "../../../lib/items";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

type Slot = {
  id: string;
  label: string;
  apiName:
    | "main_hand"
    | "off_hand"
    | "bracelet"
    | "ring1"
    | "ring2"
    | "belt";
  helper: string;
};

const slots: Slot[] = [
  {
    id: "slot-weapon-1",
    label: "Arme 1",
    apiName: "main_hand",
    helper: "Choisir l'arme principale.",
  },
  {
    id: "slot-weapon-2",
    label: "Arme 2",
    apiName: "off_hand",
    helper: "Choisir l'arme secondaire.",
  },
  {
    id: "slot-bracelet",
    label: "Bracelet",
    apiName: "bracelet",
    helper: "Sélectionner un bracelet.",
  },
  {
    id: "slot-belt",
    label: "Ceinture",
    apiName: "belt",
    helper: "Sélectionner une ceinture.",
  },
  {
    id: "slot-ring-1",
    label: "Anneau 1",
    apiName: "ring1",
    helper: "Premier anneau.",
  },
  {
    id: "slot-ring-2",
    label: "Anneau 2",
    apiName: "ring2",
    helper: "Deuxième anneau.",
  },
];

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

const weaponItems: ItemOption[] = weaponFiles.map((file) => ({
  id: `arme-${file}`,
  name: toDisplayName(file),
  rarity: "EPIC",
  slot: "weapon",
}));

const ringFiles = [
  "anneau_du_sceau_de_davinci.png",
  "bague_de_l'agonie_brutale.png",
];

const braceletFiles = ["bracelet_de_la_brise_infini.png"];

const beltFiles = ["ceinture_du_serment_inébranlable.png"];

const ringItems: ItemOption[] = ringFiles.map((file) => ({
  id: `ring-${file}`,
  name: toDisplayName(file),
  rarity: "EPIC",
  slot: "ring",
}));

const braceletItems: ItemOption[] = braceletFiles.map((file) => ({
  id: `bracelet-${file}`,
  name: toDisplayName(file),
  rarity: "RARE",
  slot: "bracelet",
}));

const beltItems: ItemOption[] = beltFiles.map((file) => ({
  id: `belt-${file}`,
  name: toDisplayName(file),
  rarity: "EPIC",
  slot: "belt",
}));

const items: ItemOption[] = [
  ...weaponItems,
  ...ringItems,
  ...braceletItems,
  ...beltItems,
];

const noneOption: ItemOption = {
  id: "none",
  name: "Aucun",
  rarity: "RARE",
  slot: "none",
};

export default function WishlistPage() {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, ItemOption>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSaveError("Supabase n'est pas configuré (URL / ANON KEY).");
      return () => {
        isMounted = false;
      };
    }

    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      const sessionUser = data.session?.user;
      if (!sessionUser?.id) {
        setSaveError(
          "Veuillez vous connecter pour sauvegarder votre wishlist.",
        );
        return;
      }
      setUserId(sessionUser.id);
    };

    syncUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadWishlist = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setSaveError("Supabase n'est pas configuré (URL / ANON KEY).");
        return;
      }
      if (!userId) {
        return;
      }
      const { data } = await supabase
        .from("gear_wishlist")
        .select("slot_name,item_name,item_priority")
        .eq("user_id", userId)
        .eq("item_priority", 1);
      if (!isMounted) {
        return;
      }
      const mapped: Record<string, ItemOption> = {};
      (data ?? []).forEach((entry) => {
        const slotName = entry.slot_name;
        const slotKey =
          slotName === "main_hand" || slotName === "off_hand"
            ? "weapon"
            : slotName === "ring1" || slotName === "ring2"
              ? "ring"
              : slotName;
        const match = items.find((item) => item.name === entry.item_name);
        mapped[slotName] =
          match ??
          ({
            id: `db-${slotName}-${entry.item_name}`,
            name: entry.item_name,
            rarity: "EPIC",
            slot: slotKey,
          } as ItemOption);
      });
      setSelectedItems(mapped);
    };

    loadWishlist();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const slotItems = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }
    const slotKey = selectedSlot.apiName;
    if (slotKey === "main_hand" || slotKey === "off_hand") {
      return [noneOption, ...items.filter((item) => item.slot === "weapon")];
    }
    if (slotKey === "ring1" || slotKey === "ring2") {
      return [noneOption, ...items.filter((item) => item.slot === "ring")];
    }
    return [noneOption, ...items.filter((item) => item.slot === slotKey)];
  }, [selectedSlot]);

  const handleSelectItem = async (item: ItemOption) => {
    if (!selectedSlot) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSaveError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsSaving(false);
      return;
    }
    if (!userId) {
      setSaveError("Veuillez vous connecter pour sauvegarder votre wishlist.");
      setIsSaving(false);
      return;
    }
    if (item.id === "none") {
      setSelectedItems((prev) => {
        const next = { ...prev };
        delete next[selectedSlot.apiName];
        return next;
      });
      const { error } = await supabase
        .from("gear_wishlist")
        .delete()
        .eq("user_id", userId)
        .eq("slot_name", selectedSlot.apiName)
        .eq("item_priority", 1);
      if (error) {
        setSaveError(`Impossible de supprimer la wishlist (${error.message}).`);
      }
      setIsSaving(false);
      setSelectedSlot(null);
      return;
    }
    setSelectedItems((prev) => ({ ...prev, [selectedSlot.apiName]: item }));
    const { error } = await supabase.from("gear_wishlist").upsert(
      {
        user_id: userId,
        slot_name: selectedSlot.apiName,
        item_name: item.name,
        item_priority: 1,
      },
      { onConflict: "user_id,slot_name,item_priority" },
    );
    if (error) {
      setSaveError(`Impossible de sauvegarder la wishlist (${error.message}).`);
    }
    setIsSaving(false);
    setSelectedSlot(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Wishlist
          </p>
          <h1 className="text-3xl font-semibold text-zinc-100">
            Mon Build Souhaité
          </h1>
        </header>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] sm:px-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Build Planner
              </p>
              <h2 className="text-lg font-semibold text-zinc-100">
                Sélections principales
              </h2>
            </div>
            <div className="text-xs text-zinc-500">
              Cliquez sur un bouton pour choisir un objet.
            </div>
          </div>
          {saveError ? (
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">
              {saveError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {slots.map((slot) => {
              const selectedItem = selectedItems[slot.apiName];
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className="group w-full rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-black/80 p-4 text-left text-sm text-zinc-200 shadow-[0_0_20px_rgba(0,0,0,0.35)] transition hover:border-amber-400/60 hover:text-amber-100"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/60">
                        {selectedItem ? (
                          imageErrors[slot.apiName] ? (
                            <Image
                              src={getSlotPlaceholder(slot.apiName)}
                              alt={selectedItem.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-md object-cover"
                              unoptimized
                            />
                          ) : (
                            <Image
                              src={getItemImage(selectedItem.name, slot.apiName)}
                              alt={selectedItem.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-md object-cover"
                              unoptimized
                              onError={() =>
                                setImageErrors((prev) => ({
                                  ...prev,
                                  [slot.apiName]: true,
                                }))
                              }
                            />
                          )
                        ) : (
                          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                            {slot.label.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 group-hover:text-amber-200">
                          {slot.label}
                        </p>
                        <p className="mt-2 break-words text-sm text-zinc-300">
                          {selectedItem ? selectedItem.name : slot.helper}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full border border-zinc-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-400 transition group-hover:border-amber-300 group-hover:text-amber-200 sm:self-auto">
                      Choisir
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {selectedSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Choisir l&apos;objet pour :
                </p>
                <h2 className="text-xl font-semibold text-zinc-100">
                  {selectedSlot.label.toUpperCase()}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6">
              <ItemSelector
                slotName={selectedSlot.label}
                slotKey={selectedSlot.apiName}
                items={slotItems}
                onSelect={handleSelectItem}
              />
            </div>

            {isSaving ? (
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-amber-200">
                Sauvegarde...
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
