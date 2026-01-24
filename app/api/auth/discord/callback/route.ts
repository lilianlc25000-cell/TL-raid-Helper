import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DiscordWebhookResponse = {
  webhook?: {
    id?: string;
    url?: string;
    guild_id?: string;
    channel_id?: string;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const discordClientId = process.env.DISCORD_CLIENT_ID ?? "";
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";
  const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appUrl = appUrlFromEnv.trim().replace(/\/+$/, "");

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_missing_code`,
    );
  }
  if (!discordClientId || !discordClientSecret || !appUrl) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_missing_env`,
    );
  }

  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_oauth_failed`,
    );
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | DiscordWebhookResponse
    | null;
  const webhook = tokenPayload?.webhook;
  if (!webhook?.url || !webhook.guild_id) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_webhook_missing`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const ownerId = authData.user?.id ?? null;
  if (!ownerId) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_oauth_failed`,
    );
  }

  const { error: upsertError } = await supabase
    .from("guild_configs")
    .upsert(
      {
        owner_id: ownerId,
        discord_guild_id: webhook.guild_id,
        discord_webhook_url: webhook.url,
      },
      { onConflict: "owner_id" },
    );

  if (upsertError) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=discord_save_failed`,
    );
  }

  return NextResponse.redirect(
    `${appUrl}/admin/settings?success=discord_connected`,
  );
}
