import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_GUILDS_URL = "https://discord.com/api/users/@me/guilds";

type DiscordTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  guild?: { id: string; name?: string };
};

type DiscordGuild = {
  id: string;
  name?: string;
  permissions?: string;
};

const isAdminPermissions = (permissions?: string) => {
  if (!permissions) return false;
  try {
    const perms = BigInt(permissions);
    return (perms & BigInt(0x8)) === BigInt(0x8);
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  const baseUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseUrl = baseUrlFromEnv.trim().replace(/\/+$/, "") || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;
  const failRedirect = `${baseUrl}/admin/settings?error=discord_failed`;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const clientId = process.env.DISCORD_CLIENT_ID ?? "";
    const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

    if (!code || !clientId || !clientSecret) {
      return NextResponse.redirect(failRedirect);
    }

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(failRedirect);
    }

    const tokenData = (await tokenResponse.json()) as DiscordTokenResponse;
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(failRedirect);
    }

    let selectedGuild: DiscordGuild | null = null;
    if (tokenData.guild?.id) {
      selectedGuild = { id: tokenData.guild.id, name: tokenData.guild.name };
    } else {
      const guildsResponse = await fetch(DISCORD_GUILDS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!guildsResponse.ok) {
        return NextResponse.redirect(failRedirect);
      }
      const guilds = (await guildsResponse.json()) as DiscordGuild[];
      selectedGuild =
        guilds.find((guild) => isAdminPermissions(guild.permissions)) ?? guilds[0] ?? null;
    }

    if (!selectedGuild?.id) {
      return NextResponse.redirect(failRedirect);
    }

  const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      return NextResponse.redirect(failRedirect);
    }

    const { error: upsertError } = await supabase.from("guild_configs").upsert(
      {
        owner_id: userId,
        discord_guild_id: selectedGuild.id,
        discord_guild_name: selectedGuild.name ?? null,
      },
      { onConflict: "owner_id" },
    );

    if (upsertError) {
      return NextResponse.redirect(failRedirect);
    }

    const { error: invokeError } = await supabase.functions.invoke("discord-provision", {
      body: { guild_id: selectedGuild.id },
    });

    if (invokeError) {
      return NextResponse.redirect(failRedirect);
    }

    return NextResponse.redirect(`${baseUrl}/admin/settings?success=true`);
  } catch {
    return NextResponse.redirect(failRedirect);
  }
}
