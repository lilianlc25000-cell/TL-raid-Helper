import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type NotifyPayload = {
  type: "raid" | "polls" | "loot" | "groups" | "dps";
  content?: string;
  embeds?: Array<Record<string, unknown>>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return json(500, { ok: false, error: "missing_supabase_env" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : "";
  if (!token) {
    return json(401, { ok: false, error: "missing_auth" });
  }

  const payload = (await req.json().catch(() => null)) as NotifyPayload | null;
  if (!payload?.type) {
    return json(400, { ok: false, error: "missing_payload" });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json(401, { ok: false, error: "invalid_auth" });
  }

  const adminId = authData.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: config } = await adminClient
    .from("guild_configs")
    .select(
      "raid_webhook_url,polls_webhook_url,loot_webhook_url,groups_webhook_url,dps_webhook_url,discord_webhook_url",
    )
    .eq("owner_id", adminId)
    .maybeSingle() as {
    data:
      | {
          raid_webhook_url: string | null;
          polls_webhook_url: string | null;
          loot_webhook_url: string | null;
          groups_webhook_url: string | null;
          dps_webhook_url: string | null;
          discord_webhook_url: string | null;
        }
      | null;
  };

  const webhookUrl =
    (payload.type === "raid" && config?.raid_webhook_url) ||
    (payload.type === "polls" && config?.polls_webhook_url) ||
    (payload.type === "loot" && config?.loot_webhook_url) ||
    (payload.type === "groups" && config?.groups_webhook_url) ||
    (payload.type === "dps" && config?.dps_webhook_url) ||
    config?.discord_webhook_url ||
    null;

  if (!webhookUrl) {
    return json(200, { ok: true, skipped: true });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: payload.content ?? "",
      embeds: payload.embeds ?? undefined,
    }),
  });

  return json(response.ok ? 200 : 500, {
    ok: response.ok,
    status: response.status,
  });
});
