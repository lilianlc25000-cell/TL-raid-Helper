"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
};

export type DiscordNotifyPayload = {
  channel_id: string;
  content?: string;
  embed?: DiscordEmbed;
};

type NotifyResult = {
  ok: boolean;
  repaired?: boolean;
  error?: string;
};

const parseDiscordErrorBody = (rawBody: unknown) => {
  if (!rawBody) {
    return null;
  }
  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody) as { status?: number; details?: string };
    } catch {
      return { details: rawBody };
    }
  }
  if (typeof rawBody === "object") {
    return rawBody as { status?: number; details?: string };
  }
  return null;
};

const isUnknownChannelError = (error: unknown) => {
  const typed = error as {
    message?: string;
    context?: { status?: number; body?: unknown };
  };
  const message = typed?.message ?? "";
  const contextStatus = typed?.context?.status;
  const body = parseDiscordErrorBody(typed?.context?.body);
  const bodyStatus = typeof body?.status === "number" ? body.status : undefined;
  const details = body?.details ?? "";

  return (
    message.includes("404") ||
    contextStatus === 404 ||
    bodyStatus === 404 ||
    details.includes("Unknown Channel") ||
    details.includes("10003")
  );
};

export const notifyDiscordWithResilience = async ({
  supabase,
  accessToken,
  payload,
  ownerId,
}: {
  supabase: SupabaseClient<Database>;
  accessToken?: string;
  payload: DiscordNotifyPayload;
  ownerId?: string | null;
}): Promise<NotifyResult> => {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const { error: notifyError } = await supabase.functions.invoke(
    "discord-notify",
    {
      body: payload,
      headers,
    },
  );

  if (!notifyError) {
    return { ok: true };
  }

  if (!isUnknownChannelError(notifyError)) {
    return {
      ok: false,
      error: notifyError.message || "Erreur discord-notify.",
    };
  }

  const { error: provisionError } = await supabase.functions.invoke(
    "discord-provision",
    { headers },
  );

  if (provisionError) {
    return {
      ok: false,
      repaired: false,
      error: provisionError.message || "Impossible de reprovisionner Discord.",
    };
  }

  const resolvedOwnerId = ownerId
    ? ownerId
    : (await supabase.auth.getUser()).data.user?.id ?? null;

  if (!resolvedOwnerId) {
    return { ok: false, repaired: true, error: "Utilisateur non connecté." };
  }

  const { data: guildConfig, error: configError } = await supabase
    .from("guild_configs")
    .select("raid_channel_id")
    .eq("owner_id", resolvedOwnerId)
    .maybeSingle();

  if (configError || !guildConfig?.raid_channel_id) {
    return {
      ok: false,
      repaired: true,
      error: "Salon Discord introuvable après réparation.",
    };
  }

  const retryPayload: DiscordNotifyPayload = {
    ...payload,
    channel_id: guildConfig.raid_channel_id,
  };

  const { error: retryError } = await supabase.functions.invoke(
    "discord-notify",
    {
      body: retryPayload,
      headers,
    },
  );

  if (retryError) {
    return {
      ok: false,
      repaired: true,
      error: retryError.message || "Nouvel échec discord-notify.",
    };
  }

  return { ok: true, repaired: true };
};
