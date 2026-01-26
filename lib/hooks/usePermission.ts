"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PermissionKey =
  | "manage_pve"
  | "manage_pvp"
  | "manage_loot"
  | "distribute_loot";

const permissionFieldMap: Record<PermissionKey, keyof PermissionFields> = {
  manage_pve: "perm_manage_pve",
  manage_pvp: "perm_manage_pvp",
  manage_loot: "perm_manage_loot",
  distribute_loot: "perm_distribute_loot",
};

type PermissionFields = {
  role_rank: string | null;
  perm_manage_pve?: boolean | null;
  perm_manage_pvp?: boolean | null;
  perm_manage_loot?: boolean | null;
  perm_distribute_loot?: boolean | null;
};

type PermissionState = {
  allowed: boolean;
  loading: boolean;
  error: string | null;
};

export const usePermission = (permission: PermissionKey): PermissionState => {
  const [state, setState] = useState<PermissionState>({
    allowed: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const loadPermission = async () => {
      const supabase = createClient();
      if (!supabase) {
        if (isMounted) {
          setState({
            allowed: false,
            loading: false,
            error: "Supabase n'est pas configuré (URL / ANON KEY).",
          });
        }
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (isMounted) {
          setState({ allowed: false, loading: false, error: null });
        }
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("guild_id")
        .eq("user_id", userId)
        .maybeSingle()) as {
        data: { guild_id?: string | null } | null;
      };
      const guildId = profile?.guild_id ?? null;
      if (!guildId) {
        if (isMounted) {
          setState({ allowed: false, loading: false, error: null });
        }
        return;
      }
      const { data: member } = (await supabase
        .from("guild_members")
        .select(
          "role_rank,perm_manage_pve,perm_manage_pvp,perm_manage_loot,perm_distribute_loot",
        )
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .maybeSingle()) as { data: PermissionFields | null };
      const rank = (member?.role_rank ?? "").toLowerCase();
      if (rank === "admin" || rank === "owner") {
        if (isMounted) {
          setState({ allowed: true, loading: false, error: null });
        }
        return;
      }
      if (rank !== "conseiller") {
        if (isMounted) {
          setState({ allowed: false, loading: false, error: null });
        }
        return;
      }
      const field = permissionFieldMap[permission];
      const allowed = Boolean(member?.[field]);
      if (isMounted) {
        setState({ allowed, loading: false, error: null });
      }
    };

    void loadPermission();
    return () => {
      isMounted = false;
    };
  }, [permission]);

  return state;
};
