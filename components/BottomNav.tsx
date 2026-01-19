"use client";

import Link from "next/link";
import { Calendar, Crown, Gem, Home, Layers, User, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const [hasGuild, setHasGuild] = useState(false);
  const pathname = usePathname();

  const loadProfileAccess = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsAdmin(false);
      setHasGuild(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setHasGuild(false);
      return;
    }
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role_rank,guild_id")
      .eq("user_id", userId)
      .maybeSingle()) as {
      data: { role_rank?: string | null; guild_id?: string | null } | null;
    };
    setIsAdmin(
      profile?.role_rank === "admin" || profile?.role_rank === "conseiller",
    );
    setHasGuild(Boolean(profile?.guild_id));
  }, []);

  useEffect(() => {
    loadProfileAccess();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadProfileAccess();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadProfileAccess]);

  useEffect(() => {
    loadProfileAccess();
  }, [pathname, loadProfileAccess]);

  const adminTab = {
    label: "Gestion",
    icon: Crown,
    href: "/admin",
  };

  if (!hasGuild) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto w-full max-w-2xl px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="rounded-2xl border border-white/10 bg-surface/90 px-2 py-2 backdrop-blur-xl sm:px-4">
          <ul className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:justify-between">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <li key={tab.label}>
                  <Link
                    href={tab.href}
                    className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition sm:w-16 sm:py-2 sm:text-xs ${
                      isActive
                        ? "text-sky-300"
                        : "text-text/80 hover:text-text"
                    }`}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="w-full truncate text-center leading-tight">
                      {tab.label}
                    </span>
                  </Link>
                </li>
              );
            })}
            {isAdmin ? (
              <li>
                {(() => {
                  const AdminIcon = adminTab.icon;
                  const isAdminActive =
                    pathname === adminTab.href ||
                    pathname.startsWith(`${adminTab.href}/`);
                  return (
                <Link
                  href={adminTab.href}
                  className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition sm:w-16 sm:py-2 sm:text-xs ${
                    isAdminActive
                      ? "text-sky-300"
                      : "text-amber-300 hover:text-amber-200"
                  }`}
                >
                  <AdminIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="w-full truncate text-center leading-tight">
                    {adminTab.label}
                  </span>
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

