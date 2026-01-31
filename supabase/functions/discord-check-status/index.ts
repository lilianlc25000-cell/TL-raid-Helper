import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

type DiscordChannel = {
  id: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";

const fetchDiscord = async <T>(
  url: string,
  options: RequestInit,
): Promise<{ ok: true; data: T | null } | { ok: false; status: number; body: string }> => {
  const response = await fetch(url, options);
  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    return { ok: false, status: response.status, body: responseText };
  }
  if (!responseText) {
    return { ok: true, data: null };
  }
  try {
    return { ok: true, data: JSON.parse(responseText) as T };
  } catch {
    return { ok: true, data: null };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !botToken) {
      return respondJson(500, { error: "Missing server configuration." });
    }

    if (!authHeader) {
      return respondJson(401, { error: "Missing authorization." });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return respondJson(401, { error: "Unauthorized." });
    }

    const { data: guildConfig, error: configError } = await supabase
      .from("guild_configs")
      .select("discord_guild_id")
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (configError || !guildConfig?.discord_guild_id) {
      return respondJson(400, { error: "Aucune configuration Discord." });
    }

    const channelsResult = await fetchDiscord<DiscordChannel[]>(
      `${DISCORD_API_BASE}/guilds/${guildConfig.discord_guild_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!channelsResult.ok) {
      return respondJson(502, { error: "Impossible de lire les salons." });
    }

    const liveIds = new Set((channelsResult.data ?? []).map((c) => c.id));

    const { data: managedRows, error: managedError } = await supabase
      .from("discord_channels")
      .select("channel_id")
      .eq("owner_id", authData.user.id);

    if (managedError) {
      return respondJson(500, { error: "Impossible de lire les salons gérés." });
    }

    const staleIds = (managedRows ?? [])
      .map((row) => row.channel_id)
      .filter((id) => id && !liveIds.has(id));

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("discord_channels")
        .delete()
        .eq("owner_id", authData.user.id)
        .in("channel_id", staleIds);
      if (deleteError) {
        return respondJson(500, { error: "Impossible de nettoyer les salons." });
      }
    }

    return respondJson(200, {
      success: true,
      removed: staleIds.length,
    });
  } catch (error) {
    return respondJson(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
