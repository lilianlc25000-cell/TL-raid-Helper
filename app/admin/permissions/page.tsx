"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CounselorPermissionsList, {
  type CounselorEntry,
} from "@/components/Admin/CounselorPermissionsList";
import PermissionEditor from "@/components/Admin/PermissionEditor";

type MemberRow = {
  user_id: string;
  role_rank: string | null;
  perm_manage_pve: boolean | null;
  perm_manage_pvp: boolean | null;
  perm_manage_loot: boolean | null;
  perm_distribute_loot: boolean | null;
};

export default function CounselorPermissionsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [counselors, setCounselors] = useState<CounselorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCounselor, setSelectedCounselor] =
    useState<CounselorEntry | null>(null);

  const loadAccess = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("guild_id")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { guild_id?: string | null } | null;
    };
    const resolvedGuildId = profile?.guild_id ?? null;
    setGuildId(resolvedGuildId);
    if (!resolvedGuildId) {
      setError("Aucune guilde active.");
      setIsAdmin(false);
      setIsAuthReady(true);
      return;
    }
    const { data: membership } = (await supabase
      .from("guild_members")
      .select("role_rank")
      .eq("guild_id", resolvedGuildId)
      .eq("user_id", userId)
      .maybeSingle()) as { data: { role_rank?: string | null } | null };
    const roleRank = (membership?.role_rank ?? "").toLowerCase();
    const canAccess = roleRank === "admin" || roleRank === "owner";
    setIsAdmin(canAccess);
    if (!canAccess) {
      setIsAuthReady(true);
      return;
    }
    setIsAuthReady(true);
  }, []);

  const loadCounselors = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré (URL / ANON KEY).");
      setIsLoading(false);
      return;
    }
    if (!guildId) {
      setCounselors([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data: memberRows, error: membersError } = (await supabase
      .from("guild_members")
      .select(
        "user_id,role_rank,perm_manage_pve,perm_manage_pvp,perm_manage_loot,perm_distribute_loot",
      )
      .eq("guild_id", guildId)
      .eq("role_rank", "conseiller")) as {
      data: MemberRow[] | null;
      error: { message?: string } | null;
    };

    if (membersError) {
      setError(membersError.message || "Impossible de charger les conseillers.");
      setIsLoading(false);
      return;
    }

    const memberIds = (memberRows ?? []).map((row) => row.user_id);
    if (memberIds.length === 0) {
      setCounselors([]);
      setIsLoading(false);
      return;
    }

    const { data: profilesData } = (await supabase
      .from("profiles")
      .select("user_id,ingame_name")
      .in("user_id", memberIds)) as {
      data: Array<{ user_id: string; ingame_name: string | null }> | null;
    };

    const nameById = new Map(
      (profilesData ?? []).map((profile) => [
        profile.user_id,
        profile.ingame_name ?? "Inconnu",
      ]),
    );

    const mapped =
      memberRows?.map((row) => ({
        userId: row.user_id,
        ingameName: nameById.get(row.user_id) ?? "Inconnu",
        perm_manage_pve: Boolean(row.perm_manage_pve),
        perm_manage_pvp: Boolean(row.perm_manage_pvp),
        perm_manage_loot: Boolean(row.perm_manage_loot),
        perm_distribute_loot: Boolean(row.perm_distribute_loot),
      })) ?? [];

    setCounselors(mapped);
    setIsLoading(false);
  }, [guildId]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    if (!isAuthReady || !isAdmin) {
      return;
    }
    loadCounselors();
  }, [isAuthReady, isAdmin, loadCounselors]);

  const selectedId = selectedCounselor?.userId ?? null;
  const selectedCounselorLive = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return counselors.find((entry) => entry.userId === selectedId) ?? null;
  }, [counselors, selectedId]);

  if (!isAuthReady) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-white/10 bg-surface/70 px-6 py-10 text-text/70 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        Chargement des permissions...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-red-500/40 bg-red-950/30 px-6 py-10 text-red-200 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
        Accès réservé aux admins.
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-text">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40">
              <ShieldCheck className="h-6 w-6 text-amber-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-text/50">
                Permissions conseiller
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-[0.15em] text-text">
                Gestion individuelle des droits
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-text/60">
            Cliquez sur un conseiller pour activer ses permissions.
          </p>
        </header>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Conseillers
          </p>
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-4 text-sm text-red-200">
              {error}
            </div>
          ) : isLoading ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-text/60">
              Chargement des conseillers...
            </div>
          ) : (
            <div className="mt-4">
              <CounselorPermissionsList
                counselors={counselors}
                selectedId={selectedId}
                onSelect={setSelectedCounselor}
              />
            </div>
          )}
        </div>
      </section>

      {selectedCounselorLive && guildId ? (
        <PermissionEditor
          guildId={guildId}
          counselor={selectedCounselorLive}
          onClose={() => setSelectedCounselor(null)}
          onUpdated={(updated) => {
            setCounselors((prev) =>
              prev.map((entry) =>
                entry.userId === updated.userId ? updated : entry,
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}
