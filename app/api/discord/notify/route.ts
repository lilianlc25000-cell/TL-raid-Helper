import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotifyPayload = {
  type:
    | "raid"
    | "polls"
    | "loot"
    | "groups"
    | "dps"
    | "statics_pvp"
    | "statics_pve";
  content?: string;
  embeds?: Array<Record<string, unknown>>;
};

type GuildConfigRow = {
  raid_webhook_url: string | null;
  polls_webhook_url: string | null;
  loot_webhook_url: string | null;
  groups_webhook_url: string | null;
  dps_webhook_url: string | null;
  statics_pvp_webhook_url: string | null;
  statics_pve_webhook_url: string | null;
  discord_webhook_url: string | null;
};

const resolveWebhookUrl = (
  payload: NotifyPayload,
  config: GuildConfigRow | null,
) =>
  (payload.type === "raid" && config?.raid_webhook_url) ||
  (payload.type === "polls" && config?.polls_webhook_url) ||
  (payload.type === "loot" && config?.loot_webhook_url) ||
  (payload.type === "groups" && config?.groups_webhook_url) ||
  (payload.type === "dps" && config?.dps_webhook_url) ||
  (payload.type === "statics_pvp" && config?.statics_pvp_webhook_url) ||
  (payload.type === "statics_pve" && config?.statics_pve_webhook_url) ||
  config?.discord_webhook_url ||
  null;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "missing_server_env" },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | NotifyPayload
    | null;
  if (!payload?.type) {
    return NextResponse.json(
      { ok: false, error: "missing_payload" },
      { status: 400 },
    );
  }

  let ownerId: string | null = null;
  const authHeader = request.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (bearerToken && anonKey) {
    const tokenClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
    const { data: authData, error: authError } =
      await tokenClient.auth.getUser();
    if (authError) {
      return NextResponse.json(
        { ok: false, error: "invalid_auth", detail: authError.message ?? null },
        { status: 401 },
      );
    }
    ownerId = authData.user?.id ?? null;
  }

  if (!ownerId) {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    ownerId = authData.user?.id ?? null;
    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: "invalid_auth", detail: authError?.message ?? null },
        { status: 401 },
      );
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: config } = (await adminClient
    .from("guild_configs")
    .select(
      "raid_webhook_url,polls_webhook_url,loot_webhook_url,groups_webhook_url,dps_webhook_url,statics_pvp_webhook_url,statics_pve_webhook_url,discord_webhook_url",
    )
    .eq("owner_id", ownerId)
    .maybeSingle()) as { data: GuildConfigRow | null };

  const webhookUrl = resolveWebhookUrl(payload, config);
  if (!webhookUrl) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: payload.content ?? "",
      embeds: payload.embeds ?? undefined,
    }),
  });

  return NextResponse.json(
    { ok: response.ok, status: response.status },
    { status: response.ok ? 200 : 500 },
  );
}
