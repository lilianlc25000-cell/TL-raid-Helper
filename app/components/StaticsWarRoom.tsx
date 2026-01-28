"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientOnly from "@/app/components/ClientOnly";
import useRealtimeSubscription from "@/src/hooks/useRealtimeSubscription";

type ReplayResult = "WIN" | "LOSS" | "DRAW";

type CombatReplay = {
  id: string;
  guild_id: string;
  uploader_id: string;
  video_url: string;
  title: string;
  result: ReplayResult;
  enemy_guild: string | null;
  notes: string | null;
  created_at: string;
  uploaderName: string;
};

type ReplayComment = {
  id: string;
  user_id: string;
  content: string;
  timestamp_ref: string | null;
  created_at: string;
  authorName: string;
};

const resultBadge = (result: ReplayResult) => {
  if (result === "WIN") return "border-emerald-400/60 bg-emerald-500/10 text-emerald-200";
  if (result === "LOSS") return "border-red-500/60 bg-red-500/10 text-red-200";
  return "border-amber-400/60 bg-amber-500/10 text-amber-200";
};

const normalizeVideoUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getEmbedInfo = (
  raw: string,
  parentHost?: string,
  origin?: string,
) => {
  const normalized = normalizeVideoUrl(raw);
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\/+/, "");
      return id
        ? {
            type: "youtube",
            src: `https://www.youtube.com/embed/${id}?enablejsapi=1${
              origin ? `&origin=${encodeURIComponent(origin)}` : ""
            }`,
          }
        : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.replace("/shorts/", "").split("/")[0];
        return id
          ? {
              type: "youtube",
              src: `https://www.youtube.com/embed/${id}?enablejsapi=1${
                origin ? `&origin=${encodeURIComponent(origin)}` : ""
              }`,
            }
          : null;
      }
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id
          ? {
              type: "youtube",
              src: `https://www.youtube.com/embed/${id}?enablejsapi=1${
                origin ? `&origin=${encodeURIComponent(origin)}` : ""
              }`,
            }
          : null;
      }
    }
    if (host.endsWith("twitch.tv")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "videos" && parts[1]) {
        return parentHost
          ? {
              type: "twitch",
              src: `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost}`,
            }
          : null;
      }
    }
    if (host === "clips.twitch.tv") {
      const slug = url.pathname.split("/").filter(Boolean)[0];
      return parentHost
        ? {
            type: "twitch",
            src: `https://clips.twitch.tv/embed?clip=${slug}&parent=${parentHost}`,
          }
        : null;
    }
    return null;
  } catch {
    return null;
  }
};

const formatTimestamp = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const parseTimestamp = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":").map((item) => Number(item));
  if (parts.some((item) => Number.isNaN(item))) {
    return null;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
};

const toPlayableVideoUrl = (raw: string) => {
  const normalized = normalizeVideoUrl(raw);
  if (!normalized) {
    return "";
  }
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\/+/, "");
      return id ? `https://www.youtube.com/watch?v=${id}` : normalized;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.replace("/shorts/", "").split("/")[0];
        return id ? `https://www.youtube.com/watch?v=${id}` : normalized;
      }
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/watch?v=${id}` : normalized;
      }
    }
    return normalized;
  } catch {
    return normalized;
  }
};


export default function StaticsWarRoom({ mode }: { mode: "pvp" | "pve" }) {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasStatic, setHasStatic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replays, setReplays] = useState<CombatReplay[]>([]);
  const [selectedReplay, setSelectedReplay] = useState<CombatReplay | null>(null);
  const [comments, setComments] = useState<ReplayComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<"ALL" | ReplayResult>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formResult, setFormResult] = useState<ReplayResult>("WIN");
  const [formEnemy, setFormEnemy] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<string[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentTime, setCommentTime] = useState("");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerHost, setPlayerHost] = useState<string>("");
  const [playerOrigin, setPlayerOrigin] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const playerFrameRef = useRef<HTMLIFrameElement | null>(null);

  const loadAccess = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setIsAuthReady(true);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    setCurrentUserId(userId);
    if (!userId) {
      setIsAuthReady(true);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("guild_id")
      .eq("user_id", userId)
      .maybeSingle();
    const resolvedGuildId = profile?.guild_id ?? null;
    setGuildId(resolvedGuildId);
    if (!resolvedGuildId) {
      setIsAuthReady(true);
      return;
    }
    const { data: staticRow } = await supabase
      .from("statics_teams")
      .select("team_index")
      .eq("mode", mode)
      .eq("user_id", userId)
      .maybeSingle();
    setHasStatic(Boolean(staticRow?.team_index));
    setIsAuthReady(true);
  }, [mode]);

  const loadReplays = useCallback(async () => {
    if (!guildId || !hasStatic) {
      setReplays([]);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data: replayRows, error: replayError } = await supabase
      .from("combat_replays")
      .select(
        "id,guild_id,uploader_id,video_url,title,result,enemy_guild,notes,created_at",
      )
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false });
    if (replayError) {
      setError(replayError.message || "Impossible de charger les replays.");
      setIsLoading(false);
      return;
    }
    const uploaderIds = Array.from(
      new Set((replayRows ?? []).map((row) => row.uploader_id)),
    );
    const { data: profiles } = uploaderIds.length
      ? await supabase
          .from("profiles")
          .select("user_id,ingame_name")
          .in("user_id", uploaderIds)
      : { data: [] };
    const nameById = new Map(
      (profiles ?? []).map((profile) => [
        profile.user_id,
        profile.ingame_name ?? "Inconnu",
      ]),
    );
    const mapped =
      replayRows?.map((row) => ({
        ...row,
        uploaderName: nameById.get(row.uploader_id) ?? "Inconnu",
      })) ?? [];
    setReplays(mapped as CombatReplay[]);
    setIsLoading(false);
  }, [guildId, hasStatic]);

  const loadComments = useCallback(
    async (replayId: string) => {
      const supabase = createClient();
      if (!supabase) {
        return;
      }
      setIsLoadingComments(true);
      const { data: commentRows } = await supabase
        .from("replay_comments")
        .select("id,user_id,content,timestamp_ref,created_at")
        .eq("replay_id", replayId)
        .order("created_at", { ascending: true });
      const userIds = Array.from(
        new Set((commentRows ?? []).map((row) => row.user_id)),
      );
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id,ingame_name")
            .in("user_id", userIds)
        : { data: [] };
      const nameById = new Map(
        (profiles ?? []).map((profile) => [
          profile.user_id,
          profile.ingame_name ?? "Inconnu",
        ]),
      );
      const mapped =
        commentRows?.map((row) => ({
          ...row,
          authorName: nameById.get(row.user_id) ?? "Inconnu",
        })) ?? [];
      setComments(mapped as ReplayComment[]);
      setIsLoadingComments(false);
    },
    [],
  );

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    if (!guildId || !hasStatic) {
      return;
    }
    loadReplays();
  }, [guildId, hasStatic, loadReplays]);

  useEffect(() => {
    if (!selectedReplay) {
      setComments([]);
      return;
    }
    void loadComments(selectedReplay.id);
  }, [selectedReplay, loadComments]);

  useRealtimeSubscription(
    "combat_replays",
    loadReplays,
    guildId ? `guild_id=eq.${guildId}` : undefined,
    Boolean(guildId && hasStatic),
  );

  const filteredReplays = useMemo(() => {
    return replays.filter((replay) => {
      const matchesResult =
        resultFilter === "ALL" ? true : replay.result === resultFilter;
      const searchValue = search.trim().toLowerCase();
      const matchesSearch = searchValue
        ? [
            replay.title,
            replay.enemy_guild ?? "",
            replay.uploaderName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(searchValue)
        : true;
      return matchesResult && matchesSearch;
    });
  }, [replays, resultFilter, search]);

  const handleSaveReplay = async () => {
    if (!guildId || !currentUserId) {
      setError("Aucune guilde active.");
      return;
    }
    if (!formUrl.trim() || !formTitle.trim()) {
      setError("Renseignez l'URL et le titre.");
      return;
    }
    const normalizedUrl = toPlayableVideoUrl(formUrl);
    const embedCheck = getEmbedInfo(
      normalizedUrl,
      playerHost || undefined,
      playerOrigin || undefined,
    );
    if (!embedCheck) {
      setError("Lien vidéo non reconnu. Utilisez un lien YouTube/Twitch complet.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("combat_replays").insert({
      guild_id: guildId,
      uploader_id: currentUserId,
      video_url: normalizedUrl,
      title: formTitle.trim(),
      result: formResult,
      enemy_guild: formEnemy.trim() || null,
      notes: formNotes.trim() || null,
    });
    if (insertError) {
      setError(insertError.message || "Impossible d'ajouter le replay.");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    setIsModalOpen(false);
    setFormUrl("");
    setFormTitle("");
    setFormEnemy("");
    setFormNotes("");
    await loadReplays();
  };

  const handleAddComment = async () => {
    if (!selectedReplay || !currentUserId) {
      return;
    }
    if (!commentText.trim()) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    const { error: insertError } = await supabase.from("replay_comments").insert({
      replay_id: selectedReplay.id,
      user_id: currentUserId,
      content: commentText.trim(),
      timestamp_ref: commentTime.trim() || null,
    });
    if (insertError) {
      setError(insertError.message || "Impossible d'ajouter le commentaire.");
      return;
    }
    setCommentText("");
    setCommentTime("");
    await loadComments(selectedReplay.id);
  };

  const handleDeleteReplays = async () => {
    if (!guildId || deleteSelection.length === 0) {
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      return;
    }
    setIsDeleting(true);
    const { error: deleteError } = await supabase
      .from("combat_replays")
      .delete()
      .in("id", deleteSelection);
    setIsDeleting(false);
    if (deleteError) {
      setError(deleteError.message || "Impossible de supprimer les replays.");
      return;
    }
    if (selectedReplay && deleteSelection.includes(selectedReplay.id)) {
      setSelectedReplay(null);
    }
    setDeleteSelection([]);
    setIsDeleteModalOpen(false);
    await loadReplays();
  };

  const selectedUrl = useMemo(() => {
    if (!selectedReplay) {
      return "";
    }
    return toPlayableVideoUrl(selectedReplay.video_url);
  }, [selectedReplay]);
  const selectedEmbed = useMemo(() => {
    if (!selectedReplay) {
      return null;
    }
    return getEmbedInfo(
      selectedReplay.video_url,
      playerHost || undefined,
      playerOrigin || undefined,
    );
  }, [selectedReplay, playerHost, playerOrigin]);
  useEffect(() => {
    if (!selectedUrl) {
      setPlayerError(null);
      return;
    }
    setPlayerError(null);
  }, [selectedUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setPlayerHost(window.location.hostname);
    setPlayerOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) {
        return;
      }
      let payload: unknown = event.data;
      if (typeof event.data === "string") {
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
      }
      if (
        typeof payload === "object" &&
        payload !== null &&
        "event" in payload
      ) {
        const data = payload as {
          event?: string;
          info?: { currentTime?: number };
        };
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          setCurrentTime(data.info.currentTime);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const requestCurrentTime = () => {
    if (!selectedEmbed || selectedEmbed.type !== "youtube") {
      return;
    }
    const frameWindow = playerFrameRef.current?.contentWindow;
    if (!frameWindow) {
      return;
    }
    frameWindow.postMessage(
      JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
      "*",
    );
    window.setTimeout(() => {
      setCommentTime(formatTimestamp(currentTime));
    }, 120);
  };

  const seekToTimestamp = (value: string) => {
    if (!selectedEmbed || selectedEmbed.type !== "youtube") {
      return;
    }
    const seconds = parseTimestamp(value);
    if (seconds == null) {
      return;
    }
    const frameWindow = playerFrameRef.current?.contentWindow;
    if (!frameWindow) {
      return;
    }
    frameWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*",
    );
  };

  if (!isAuthReady) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-6 text-sm text-text/60">
        Chargement...
      </div>
    );
  }

  if (!hasStatic) {
    return (
      <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-6 py-6 text-sm text-amber-200">
        Vous devez rejoindre une statique pour acceder au salons privé.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-text/50">
            War Room · Statics {mode.toUpperCase()}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-text">
            Analyse vidéo &amp; replays
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
          >
            Ajouter un Replay
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="rounded-full border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400"
          >
            Supprimer un replay
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Recherche &amp; filtres
          </p>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un replay, une guilde..."
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
          />
          <select
            value={resultFilter}
            onChange={(event) =>
              setResultFilter(event.target.value as "ALL" | ReplayResult)
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
          >
            <option value="ALL">Tous les résultats</option>
            <option value="WIN">Victoire</option>
            <option value="LOSS">Défaite</option>
            <option value="DRAW">Nul</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Galerie des replays
          </p>
          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-4 text-sm text-red-200">
              {error}
            </div>
          ) : isLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Chargement des replays...
            </div>
          ) : filteredReplays.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
              Aucun replay pour le moment.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredReplays.map((replay) => (
                <button
                  key={replay.id}
                  type="button"
                  onClick={() => setSelectedReplay(replay)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left text-sm transition",
                    selectedReplay?.id === replay.id
                      ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                      : "border-white/10 bg-black/40 text-text/70 hover:border-white/20",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-text">{replay.title}</div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${resultBadge(
                        replay.result,
                      )}`}
                    >
                      {replay.result}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-text/50">
                    {replay.uploaderName} ·{" "}
                    {new Date(replay.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReplay ? (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                {playerError ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-text/70">
                    <div>{playerError}</div>
                    <a
                      href={selectedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-200 underline"
                    >
                      Ouvrir la vidéo
                    </a>
                  </div>
                ) : (
                  <ClientOnly>
                    {console.log("URL envoyee au player :", selectedUrl)}
                    {selectedEmbed ? (
                      <iframe
                        ref={selectedEmbed.type === "youtube" ? playerFrameRef : undefined}
                        src={selectedEmbed.src}
                        title={selectedReplay.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        onError={() => {
                          console.error("Erreur iframe video");
                          setPlayerError("Impossible de lancer la vidéo.");
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-text/70">
                        Lien vidéo non supporté.
                      </div>
                    )}
                  </ClientOnly>
                )}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Discussion
                </p>
                {isLoadingComments ? (
                  <div className="mt-3 text-sm text-text/60">
                    Chargement des commentaires...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="mt-3 text-sm text-text/60">
                    Aucun commentaire pour ce replay.
                  </div>
                ) : (
                <div className="mt-3 space-y-2">
                    {comments.map((comment) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() =>
                          comment.timestamp_ref
                            ? seekToTimestamp(comment.timestamp_ref)
                            : undefined
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-text/70 transition hover:border-white/30"
                      >
                        <div className="flex items-center justify-between text-xs text-text/50">
                          <span>{comment.authorName}</span>
                          {comment.timestamp_ref ? (
                            <span>{comment.timestamp_ref}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-text/80">
                          {comment.content}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-text/80"
                  />
                  <button
                    type="button"
                    onClick={requestCurrentTime}
                    disabled={!selectedEmbed || selectedEmbed.type !== "youtube"}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commentTime ? `⏱ ${commentTime}` : "⏱ Temps actuel"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddComment}
                  className="mt-3 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
                >
                  Publier
                </button>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-text/70">
              <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                Infos du match
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="text-xs text-text/50">Résultat</div>
                  <div className="font-semibold">{selectedReplay.result}</div>
                </div>
                <div>
                  <div className="text-xs text-text/50">Guilde adverse</div>
                  <div className="font-semibold">
                    {selectedReplay.enemy_guild || "Non renseignée"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text/50">Notes</div>
                  <div className="text-text/70">
                    {selectedReplay.notes || "Aucune note."}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Ajouter un replay
                </p>
                <h3 className="mt-2 text-xl font-semibold text-text">
                  Nouveau combat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              <input
                value={formUrl}
                onChange={(event) => setFormUrl(event.target.value)}
                placeholder="URL YouTube / Twitch"
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
              />
              <input
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder="Titre du match"
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
              />
              <select
                value={formResult}
                onChange={(event) =>
                  setFormResult(event.target.value as ReplayResult)
                }
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
              >
                <option value="WIN">Victoire</option>
                <option value="LOSS">Défaite</option>
                <option value="DRAW">Nul</option>
              </select>
              <input
                value={formEnemy}
                onChange={(event) => setFormEnemy(event.target.value)}
                placeholder="Guilde adverse"
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
              />
              <textarea
                value={formNotes}
                onChange={(event) => setFormNotes(event.target.value)}
                placeholder="Notes / résumé du combat"
                className="min-h-[120px] rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/80"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveReplay}
                disabled={isSaving}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Supprimer des replays
                </p>
                <h3 className="mt-2 text-xl font-semibold text-text">
                  Sélection multiple
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeleteSelection(replays.map((replay) => replay.id))}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:border-white/30"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={() => setDeleteSelection([])}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text/70 transition hover:border-white/30"
              >
                Tout désélectionner
              </button>
            </div>

            <div className="mt-4 max-h-[320px] space-y-2 overflow-auto pr-1">
              {replays.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
                  Aucun replay à supprimer.
                </div>
              ) : (
                replays.map((replay) => {
                  const checked = deleteSelection.includes(replay.id);
                  return (
                    <label
                      key={replay.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/70"
                    >
                      <div>
                        <div className="font-semibold text-text">{replay.title}</div>
                        <div className="text-xs text-text/50">
                          {replay.uploaderName} ·{" "}
                          {new Date(replay.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDeleteSelection((prev) =>
                            checked
                              ? prev.filter((id) => id !== replay.id)
                              : [...prev, replay.id],
                          )
                        }
                        className="h-4 w-4 accent-red-500"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-text/50">
                {deleteSelection.length} sélectionné(s)
              </p>
              <button
                type="button"
                onClick={handleDeleteReplays}
                disabled={deleteSelection.length === 0 || isDeleting}
                className="rounded-full border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
