"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactPlayer from "react-player";
import { createClient } from "@/lib/supabase/client";

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
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formResult, setFormResult] = useState<ReplayResult>("WIN");
  const [formEnemy, setFormEnemy] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentTime, setCommentTime] = useState("");

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
      video_url: formUrl.trim(),
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
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
        >
          Ajouter un Replay
        </button>
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
                <ReactPlayer
                  url={selectedReplay.video_url}
                  width="100%"
                  height="100%"
                  controls
                />
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
                      <div
                        key={comment.id}
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text/70"
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
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px]">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-text/80"
                  />
                  <input
                    value={commentTime}
                    onChange={(event) => setCommentTime(event.target.value)}
                    placeholder="04:20"
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-text/80"
                  />
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
    </div>
  );
}
