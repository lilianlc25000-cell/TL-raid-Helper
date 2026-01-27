"use client";

import { UserRound } from "lucide-react";

export type CounselorEntry = {
  userId: string;
  ingameName: string;
  perm_manage_pve: boolean;
  perm_manage_pvp: boolean;
  perm_manage_loot: boolean;
  perm_distribute_loot: boolean;
  perm_manage_polls: boolean;
  perm_right_hand: boolean;
};

type CounselorPermissionsListProps = {
  counselors: CounselorEntry[];
  selectedId: string | null;
  onSelect: (counselor: CounselorEntry) => void;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function CounselorPermissionsList({
  counselors,
  selectedId,
  onSelect,
}: CounselorPermissionsListProps) {
  if (counselors.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
        Aucun conseiller trouvé.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {counselors.map((counselor) => {
        const isSelected = counselor.userId === selectedId;
        return (
          <button
            key={counselor.userId}
            type="button"
            onClick={() => onSelect(counselor)}
            className={[
              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
              isSelected
                ? "border-amber-400/60 bg-amber-400/10 text-amber-100"
                : "border-white/10 bg-black/30 text-text/70 hover:border-amber-400/40",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-xs font-semibold text-text/80">
                {getInitials(counselor.ingameName)}
              </div>
              <div>
                <div className="font-semibold text-text">
                  {counselor.ingameName}
                </div>
                <div className="text-xs text-text/50">
                {counselor.perm_right_hand ? "Bras droit" : "Conseiller"}
                </div>
              </div>
            </div>
            <UserRound className="h-5 w-5 text-text/40" />
          </button>
        );
      })}
    </div>
  );
}
