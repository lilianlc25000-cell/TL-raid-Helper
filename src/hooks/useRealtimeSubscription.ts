"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type RealtimeCallback = () => void | Promise<void>;

export default function useRealtimeSubscription(
  tableName: string,
  callback: RealtimeCallback,
  filter?: string,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const channel = supabase
      .channel(`rt:${tableName}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter,
        },
        () => {
          void callback();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, callback, filter, enabled]);
}
