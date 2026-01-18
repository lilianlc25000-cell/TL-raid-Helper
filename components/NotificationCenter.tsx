"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, TrendingUp } from "lucide-react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id ?? null);
    };

    syncUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("id,type,message,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);
    setNotifications(data ?? []);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Notification & { user_id: string };
          setNotifications((prev) => [next, ...prev].slice(0, 12));
          if (next.type === "points_received") {
            setToast(next.message);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    if (!userId) {
      return;
    }
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true })),
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-text/70 transition hover:text-text"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/10 bg-surface/95 p-4 shadow-[0_0_25px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.3em] text-text/60">
              Notifications
            </span>
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[10px] uppercase tracking-[0.25em] text-text/60 transition hover:text-text"
            >
              Tout marquer comme lu
            </button>
          </div>

          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-4 text-xs text-text/50">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={[
                    "rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-text/70",
                    item.is_read ? "" : "border-emerald-500/30",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    {item.type === "points_received" ? (
                      <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-300" />
                    ) : null}
                    <div className="flex-1">
                      <p
                        className={[
                          "text-sm",
                          item.type === "points_received"
                            ? "text-emerald-200"
                            : "text-text/80",
                        ].join(" ")}
                      >
                        {item.message}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-text/40">
                        {formatTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed top-6 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
          💰 {toast}
        </div>
      ) : null}
    </div>
  );
}
