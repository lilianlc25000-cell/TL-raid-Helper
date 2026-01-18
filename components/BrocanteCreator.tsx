"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { useCallback, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type BrocanteCreatorProps = {
  isAdmin: boolean;
  onCreated?: () => void | Promise<void>;
};

const DEFAULT_RARITY = "rare" as const;

export default function BrocanteCreator({
  isAdmin,
  onCreated,
}: BrocanteCreatorProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanItems, setScanItems] = useState<
    { name: string; slot: string; imagePath?: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const playDing = useCallback(() => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.6,
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.6);
    } catch {
      // Ignore audio errors (autoplay restrictions, etc.)
    }
  }, []);

  const analyzeImage = useCallback(async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Impossible de lire l'image."));
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Format d'image non supporté."));
        }
      };
      reader.readAsDataURL(file);
    });

    const response = await fetch("/api/analyze-loot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      data?: { items: { name: string; slot: string; imagePath?: string }[] };
      error?: string;
    };

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Analyse impossible.");
    }

    return payload.data?.items?.filter((item) => item.name?.trim()) ?? [];
  }, []);

  const analyzeFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }
      setIsAnalyzing(true);
      setScanError(null);
      setScanSuccess(false);
      try {
        const allItems: { name: string; slot: string; imagePath?: string }[] = [];
        for (const file of files) {
          const items = await analyzeImage(file);
          allItems.push(...items);
        }
        if (allItems.length > 0) {
          setScanItems(allItems);
          const firstItem = allItems[0];
          setName(firstItem.name.trim());
        }
        setScanSuccess(true);
        playDing();
        window.setTimeout(() => setScanSuccess(false), 1800);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Analyse impossible.";
        setScanError(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzeImage, playDing],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!isAdmin || isAnalyzing) return;
      const items = event.clipboardData?.items ?? [];
      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/"),
      );
      if (imageItems.length === 0) {
        setScanError("Aucune image détectée dans le presse-papier.");
        return;
      }
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      if (files.length === 0) {
        setScanError("Impossible de récupérer l'image.");
        return;
      }
      void analyzeFiles(files);
    },
    [analyzeFiles, isAdmin, isAnalyzing],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isAdmin || isAnalyzing) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) {
        setScanError("Déposez une image valide.");
        return;
      }
      void analyzeFiles(files);
    },
    [analyzeFiles, isAdmin, isAnalyzing],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!isAdmin || isAnalyzing) return;
      const files = Array.from(event.target.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) {
        setScanError("Sélectionnez une image valide.");
        return;
      }
      void analyzeFiles(files);
      event.target.value = "";
    },
    [analyzeFiles, isAdmin, isAnalyzing],
  );

  const handleSubmit = async () => {
    if (!isAdmin) {
      setError("Zone réservée aux officiers.");
      return;
    }
    const itemsToPublish =
      scanItems.length > 0
        ? scanItems
        : name.trim()
          ? [{ name: name.trim(), slot: "" }]
          : [];
    if (itemsToPublish.length === 0) {
      setError("Aucun item détecté par l'IA.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsSubmitting(false);
      return;
    }

    const payload = itemsToPublish.map((item) => ({
      item_name: item.name,
      custom_name: item.name,
      custom_traits: [],
      rarity: DEFAULT_RARITY,
      category: "brocante",
      is_active: true,
      image_url: item.imagePath || null,
    }));

    const { error: insertError } = await supabase
      .from("active_loot_sessions")
      .insert(payload);

    if (insertError) {
      setError(
        `Impossible d'ouvrir la brocante : ${insertError.message || "Erreur inconnue."}`,
      );
      setIsSubmitting(false);
      return;
    }

    setSuccess(
      itemsToPublish.length > 1
        ? `${itemsToPublish.length} lots ouverts ! Les rolls sont disponibles.`
        : "Lot ouvert ! Les rolls sont disponibles.",
    );
    setName("");
    setScanItems([]);
    setIsSubmitting(false);
    if (onCreated) {
      await onCreated();
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-6 py-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          La brocante
        </p>
        <h2 className="text-lg font-semibold text-zinc-100">
          Créer un lot free-for-all
        </h2>
        <p className="text-sm text-zinc-500">
          Tous les joueurs peuvent roll, sans restriction de wishlist.
        </p>
      </div>

      {!isAdmin ? (
        <div className="mt-5 rounded-md border border-zinc-900 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-500">
          Zone réservée aux officiers.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div
            onPaste={handlePaste}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-400"
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Magic Scan
              </span>
              <label className="w-fit cursor-pointer text-sm text-amber-200 transition hover:text-amber-100">
                📸 Cliquer pour ajouter le screen
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <span className="text-xs text-zinc-500">
                Ou glissez plusieurs screens / collez (Ctrl+V).
              </span>
              {isAnalyzing ? (
                <span className="text-xs text-amber-200">
                  Analyse de l&apos;artefact par l&apos;IA...
                </span>
              ) : null}
              {scanSuccess ? (
                <span className="text-xs text-emerald-200">
                  Ding ! Analyse réussie.
                </span>
              ) : null}
              {scanError ? (
                <span className="text-xs text-red-300">{scanError}</span>
              ) : null}
            </div>
          </div>
          {scanItems.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-300">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Items détectés
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {scanItems.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    type="button"
                    onClick={() => {
                      setName(item.name);
                    }}
                    className="flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left text-xs text-zinc-200 transition hover:border-amber-400/40"
                  >
                    {item.imagePath ? (
                      <img
                        src={item.imagePath}
                        alt={item.name}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-[10px] text-zinc-500">
                        N/A
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-semibold text-zinc-100">
                        {item.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Sélection actuelle
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-base font-semibold text-zinc-100">
                {name.trim() || "Aucun item sélectionné"}
              </span>
              {scanItems.length > 0 ? (
                <span className="text-xs text-emerald-300">
                  {scanItems.length} items détectés prêts à publier.
                </span>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-md border border-amber-400/70 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Ouverture..." : "Ouvrir les enchères (Rolls)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
