import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  image?: {
    url: string;
  };
  footer?: {
    text: string;
    icon_url?: string;
  };
};

type DiscordButtonComponent = {
  type: 2;
  style: 5;
  label: string;
  url: string;
};

type DiscordActionRowComponent = {
  type: 1;
  components: DiscordButtonComponent[];
};

type ReplaceOptions = {
  match_title_prefix?: string;
  match_content_prefix?: string;
  limit?: number;
};

type NotifyPayload = {
  channel_id?: string;
  guild_id?: string;
  channel_name?: string;
  parent_name?: string;
  content?: string;
  embed?: DiscordEmbed;
  components?: DiscordActionRowComponent[];
  replace?: ReplaceOptions;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";

const normalizeDiscordName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const matchesDiscordName = (candidate: string, target: string) => {
  if (candidate === target) {
    return true;
  }
  const normalizedCandidate = normalizeDiscordName(candidate);
  const normalizedTarget = normalizeDiscordName(target);
  if (normalizedCandidate === normalizedTarget) {
    return true;
  }
  return normalizedCandidate.includes(normalizedTarget);
};

const postDiscordMessage = async (
  channelId: string,
  body: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordActionRowComponent[];
  },
  botToken: string,
) => {
  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorBody: responseText,
    };
  }

  return {
    ok: true,
    status: response.status,
    responseBody: responseText,
  };
};

const fetchDiscord = async (
  url: string,
  options: RequestInit,
): Promise<{ ok: true; status: number; body: string } | { ok: false; status: number; body: string }> => {
  const response = await fetch(url, options);
  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    return { ok: false, status: response.status, body: responseText };
  }
  return { ok: true, status: response.status, body: responseText };
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !botToken) {
    return new Response(
      JSON.stringify({ error: "Missing server configuration." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let channelId = payload.channel_id ?? null;
  if (!channelId && payload.guild_id && payload.channel_name) {
    const channelsResult = await fetchDiscord(
      `${DISCORD_API_BASE}/guilds/${payload.guild_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (channelsResult.ok && channelsResult.body) {
      try {
        const channels = JSON.parse(channelsResult.body) as Array<{
          id: string;
          name: string;
          type?: number;
          parent_id?: string | null;
        }>;
        const parent = payload.parent_name
          ? channels.find(
              (channel) =>
                channel.type === 4 &&
                matchesDiscordName(channel.name, payload.parent_name ?? ""),
            )
          : null;
        const match = channels.find(
          (channel) =>
            matchesDiscordName(channel.name, payload.channel_name ?? "") &&
            (!parent || channel.parent_id === parent.id),
        );
        if (match?.id) {
          channelId = match.id;
        }
      } catch {
        channelId = null;
      }
    }
  }

  if (!channelId) {
    return new Response(JSON.stringify({ error: "Missing channel_id." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const content = payload.content?.trim();
  const embed = payload.embed;
  const replace = payload.replace;

  if (!content && !embed) {
    return new Response(
      JSON.stringify({ error: "Missing content or embed." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  if (replace?.match_title_prefix || replace?.match_content_prefix) {
    const limit = Math.min(Math.max(replace.limit ?? 30, 1), 100);
    const messagesResult = await fetchDiscord(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${limit}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (messagesResult.ok && messagesResult.body) {
      const matchTitlePrefix = replace.match_title_prefix?.toLowerCase() ?? "";
      const matchContentPrefix =
        replace.match_content_prefix?.toLowerCase() ?? "";
      try {
        const messages = JSON.parse(messagesResult.body) as Array<{
          id: string;
          content?: string;
          author?: { bot?: boolean };
          embeds?: Array<{ title?: string }>;
        }>;
        const target = messages.find((message) => {
          if (!message.author?.bot) {
            return false;
          }
          if (matchTitlePrefix) {
            const title = message.embeds?.[0]?.title?.toLowerCase() ?? "";
            if (title.startsWith(matchTitlePrefix)) {
              return true;
            }
          }
          if (matchContentPrefix) {
            const contentValue = (message.content ?? "").toLowerCase();
            if (contentValue.startsWith(matchContentPrefix)) {
              return true;
            }
          }
          return false;
        });
        if (target?.id) {
          const deleteResult = await fetchDiscord(
            `${DISCORD_API_BASE}/channels/${channelId}/messages/${target.id}`,
            { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } },
          );
          if (!deleteResult.ok) {
            console.error("discord-notify: delete failed", deleteResult);
          }
        }
      } catch (error) {
        console.error("discord-notify: message parse failed", error);
      }
    }
  }

  const discordBody: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordActionRowComponent[];
  } = {};
  if (content) {
    discordBody.content = content;
  }
  if (embed) {
    discordBody.embeds = [embed];
  }
  if (payload.components?.length) {
    discordBody.components = payload.components;
  }

  const result = await postDiscordMessage(
    channelId,
    discordBody,
    botToken,
  );

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: "Discord notification failed.",
        status: result.status,
        details: result.errorBody,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  return new Response(
    JSON.stringify({ success: true, discord: result.responseBody }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
