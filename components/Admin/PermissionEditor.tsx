"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CounselorEntry } from "@/components/Admin/CounselorPermissionsList";

type PermissionEditorProps = {
  guildId: string;
  counselor: CounselorEntry;
  onClose: () => void;
  onUpdated: (updated: CounselorEntry) => void;
};

type PermissionKey =
  | "perm_manage_pve"
  | "perm_manage_pvp"
  | "perm_manage_loot"
  | "perm_distribute_loot"
  | "perm_manage_polls"
  | "perm_right_hand";

const permissionLabels: Record<PermissionKey, string> = {
  perm_manage_pve: "Gestion PvE",
  perm_manage_pvp: "Gestion PvP",
  perm_manage_loot: "Gestion de la roulette",
  perm_distribute_loot: "Distribution Loot",
  perm_manage_polls: "Gestion des sondages",
  perm_right_hand: "Bras droit (accès complet)",
};

export default function PermissionEditor({
  guildId,
  counselor,
  onClose,
  onUpdated,
}: PermissionEditorProps) {
  const [draft, setDraft] = useState<Record<PermissionKey, boolean>>({
    perm_manage_pve: counselor.perm_manage_pve,
    perm_manage_pvp: counselor.perm_manage_pvp,
    perm_manage_loot: counselor.perm_manage_loot,
    perm_distribute_loot: counselor.perm_distribute_loot,
    perm_manage_polls: counselor.perm_manage_polls,
    perm_right_hand: counselor.perm_right_hand,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const togglePermission = (key: PermissionKey) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    const supabase = createClient();
    if (!supabase) {
      setStatus("Supabase n'est pas configuré (URL / ANON KEY).");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from("guild_members")
      .update({ ...draft })
      .eq("guild_id", guildId)
      .eq("user_id", counselor.userId);
    if (error) {
      setStatus(error.message || "Impossible de sauvegarder les permissions.");
      setIsSaving(false);
      return;
    }
    onUpdated({
      ...counselor,
      ...draft,
    });
    setIsSaving(false);
    setStatus("Permissions sauvegardées.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-surface/90 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-text/50">
              Permissions conseiller
            </p>
            <h2 className="mt-2 text-xl font-semibold text-text">
              {counselor.ingameName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:text-text"
          >
            Fermer
          </button>
        </header>

        <div className="mt-6 space-y-3">
          {(Object.keys(permissionLabels) as PermissionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => togglePermission(key)}
              className={[
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                draft[key]
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-black/30 text-text/70 hover:border-emerald-400/40",
              ].join(" ")}
            >
              <span className="font-medium">{permissionLabels[key]}</span>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]",
                  draft[key]
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-black/40 text-text/50",
                ].join(" ")}
              >
                {draft[key] ? "Activé" : "Désactivé"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
          {status ? <span className="text-xs text-emerald-200">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}
