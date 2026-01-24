export type DiscordNotificationPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: Array<Record<string, unknown>>;
};

export type DiscordNotifyPayload = {
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
  const response = await fetch("/api/discord/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text().catch(() => "");
  let parsed: Record<string, unknown> | null = null;
  if (raw && raw.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    ...(parsed ?? {}),
  };
}
