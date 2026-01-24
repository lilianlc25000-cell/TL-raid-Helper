import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DiscordTokenResponse = {
  webhook?: {
    url?: string;
    guild_id?: string;
    channel_id?: string;
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=discord_missing_code", appUrl),
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=discord_missing_env", appUrl),
    );
  }

  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=discord_oauth_failed", appUrl),
    );
  }

  const tokenData = (await tokenResponse.json().catch(() => null)) as
    | DiscordTokenResponse
    | null;
  const webhook = tokenData?.webhook;
  if (!webhook?.url || !webhook?.guild_id) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=discord_webhook_missing", appUrl),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const ownerId = authData.user?.id;
  if (!ownerId) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const { data: existing } = await supabase
    .from("guild_configs")
    .select("id,guild_name")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const payload = {
    owner_id: ownerId,
    discord_guild_id: webhook.guild_id,
    discord_webhook_url: webhook.url,
    guild_name: existing?.guild_name ?? webhook.guild_id,
  };

  const { error } = existing?.id
    ? await supabase.from("guild_configs").update(payload).eq("id", existing.id)
    : await supabase.from("guild_configs").insert(payload);

  if (error) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=discord_save_failed", appUrl),
    );
  }

  return NextResponse.redirect(
    new URL("/admin/settings?success=discord_connected", appUrl),
  );
}
