export type DiscordNotificationPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
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
