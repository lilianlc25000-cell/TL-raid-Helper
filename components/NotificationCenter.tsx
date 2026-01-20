"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, TrendingUp, Volume2, VolumeX } from "lucide-react";
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) {
      return;
    }
    if (document.visibilityState !== "visible") {
      return;
    }
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gain.gain.setValueAtTime(0.06, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.5,
      );
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Ignore audio errors (autoplay restrictions, etc.)
    }
  }, [soundEnabled]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("notifications-sound")
        : null;
    if (stored === "off") {
      setSoundEnabled(false);
    }
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "notifications-sound",
          next ? "on" : "off",
        );
      }
      return next;
    });
  };

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
          setNotifications((prev) => {
            const filtered = prev.filter((item) => item.id !== next.id);
            return [next, ...filtered].slice(0, 12);
          });
          setToast(next.message);
          playNotificationSound();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification & { user_id: string };
          setNotifications((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
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

  const markAsRead = async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
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
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-surface/95 p-4 shadow-[0_0_25px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.3em] text-text/60">
              Notifications
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className="flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-text/60 transition hover:text-text"
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                Son
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] uppercase tracking-[0.25em] text-text/60 transition hover:text-text"
              >
                Tout marquer comme lu
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-4 text-xs text-text/50">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={[
                    "group w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-left text-sm text-text/70 transition hover:border-white/20 hover:bg-black/50",
                    item.is_read
                      ? ""
                      : "border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
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
                    {item.is_read ? null : (
                      <Check className="h-3.5 w-3.5 text-emerald-300 opacity-0 transition group-hover:opacity-100" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 top-6 z-[60] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.4)] sm:max-w-md">
          💰 {toast}
        </div>
      ) : null}
    </div>
  );
}
