export type DiscordNotificationPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: Array<Record<string, unknown>>;
};

export type DiscordNotifyPayload = {
  type: "raid" | "polls" | "loot" | "groups" | "dps";
  content?: string;
  embeds?: Array<Record<string, unknown>>;
};

export async function sendDiscordNotification(
  webhookUrl: string | null | undefined,
  payload: DiscordNotificationPayload,
) {
  if (!webhookUrl) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return { ok: response.ok, status: response.status };
}

export async function notifyDiscordViaFunction(
  accessToken: string,
  payload: DiscordNotifyPayload,
) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`${baseUrl}/functions/v1/discord-notify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return { ok: response.ok, status: response.status };
}
