"use client";

import Link from "next/link";
import { Calendar, Crown, Gem, Home, Layers, User, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

const tabs = [
  { label: "Accueil", icon: Home, href: "/" },
  { label: "Calendrier", icon: Calendar, href: "/calendar" },
  { label: "Groupes", icon: Users, href: "/groups" },
  { label: "Loots", icon: Gem, href: "/loot" },
  { label: "Wishlist", icon: Layers, href: "/profile/wishlist" },
  { label: "Profil", icon: User, href: "/profile" },
];

export default function BottomNav() {
  const [isAdmin, setIsAdmin] = useState(false);

  const loadAdminRole = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role_rank")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null } | null;
    };
    setIsAdmin(
      profile?.role_rank === "admin" || profile?.role_rank === "conseiller",
    );
  }, []);

  useEffect(() => {
    loadAdminRole();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadAdminRole();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadAdminRole]);

  const adminTab = {
    label: "Gestion",
    icon: Crown,
    href: "/admin",
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto w-full max-w-2xl px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="rounded-2xl border border-white/10 bg-surface/90 px-2 py-2 backdrop-blur-xl sm:px-4">
          <ul className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:justify-between">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.label}>
                  <Link
                    href={tab.href}
                    className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-text/80 transition hover:text-text sm:w-16 sm:py-2 sm:text-xs"
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
            {isAdmin ? (
              <li>
                {(() => {
                  const AdminIcon = adminTab.icon;
                  return (
                <Link
                  href={adminTab.href}
                  className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-amber-300 transition hover:text-amber-200 sm:w-16 sm:py-2 sm:text-xs"
                >
                  <AdminIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>{adminTab.label}</span>
                </Link>
                  );
                })()}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </nav>
  );
}

