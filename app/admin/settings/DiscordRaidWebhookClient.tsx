 "use client";
 
 import { useState } from "react";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
 
 type Props = {
   initialGuildId: string;
   initialGuildName: string;
   initialWebhookUrl: string;
 };
 
 export default function DiscordRaidWebhookClient({
   initialGuildId,
   initialGuildName,
   initialWebhookUrl,
 }: Props) {
   const [guildId, setGuildId] = useState(initialGuildId);
   const [guildName, setGuildName] = useState(initialGuildName);
   const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
   const [isSaving, setIsSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [success, setSuccess] = useState<string | null>(null);
 
   const handleSave = async () => {
     const supabase = createSupabaseBrowserClient();
     if (!supabase) {
       setError("Supabase n'est pas configuré.");
       return;
     }
     setError(null);
     setSuccess(null);
 
     const trimmedWebhook = webhookUrl.trim();
     const trimmedGuildId = guildId.trim();
     const trimmedGuildName = guildName.trim();
 
     if (!trimmedWebhook) {
       setError("Ajoute l'URL du webhook Discord.");
       return;
     }
     if (!trimmedGuildId) {
       setError("Ajoute l'ID du serveur Discord.");
       return;
     }
     if (!trimmedGuildName) {
       setError("Ajoute le nom du serveur Discord.");
       return;
     }
 
     if (
       !trimmedWebhook.startsWith("https://discord.com/api/webhooks/") &&
       !trimmedWebhook.startsWith("https://discordapp.com/api/webhooks/")
     ) {
       setError("L'URL du webhook Discord semble invalide.");
       return;
     }
 
     setIsSaving(true);
 
     const { data: authData } = await supabase.auth.getUser();
     const ownerId = authData.user?.id;
     if (!ownerId) {
       setError("Connecte-toi pour enregistrer le webhook.");
       setIsSaving(false);
       return;
     }
 
     const payload = {
       owner_id: ownerId,
       discord_guild_id: trimmedGuildId,
       discord_webhook_url: trimmedWebhook,
       guild_name: trimmedGuildName,
       raid_webhook_url: trimmedWebhook,
     };
 
     const { error: upsertError } = await supabase
       .from("guild_configs")
       .upsert(payload, { onConflict: "owner_id" });
 
     if (upsertError) {
      setError(
        `Impossible d'enregistrer le webhook. ${upsertError.message ?? ""}`,
      );
       setIsSaving(false);
       return;
     }
 
     setSuccess("Webhook enregistré.");
     setIsSaving(false);
   };
 
   return (
     <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
       <p className="text-xs uppercase tracking-[0.25em] text-text/50">
         Discord
       </p>
       <h2 className="mt-2 text-xl font-semibold text-text">
         Webhook Raid Helper
       </h2>
       <p className="mt-2 text-sm text-text/70">
         Colle le webhook du salon "raid helper" pour publier les raids sans bot.
       </p>
 
       <div className="mt-4 grid gap-3 text-sm text-text/80">
         <label className="text-xs uppercase tracking-[0.2em] text-text/50">
           Nom du serveur
         </label>
         <input
           value={guildName}
           onChange={(event) => setGuildName(event.target.value)}
           placeholder="Serveur de Mozorh"
           className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-text outline-none"
         />
 
         <label className="text-xs uppercase tracking-[0.2em] text-text/50">
           ID du serveur
         </label>
         <input
           value={guildId}
           onChange={(event) => setGuildId(event.target.value)}
           placeholder="1464406134075953407"
           className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-text outline-none"
         />
 
         <label className="text-xs uppercase tracking-[0.2em] text-text/50">
           URL Webhook
         </label>
         <input
           value={webhookUrl}
           onChange={(event) => setWebhookUrl(event.target.value)}
           placeholder="https://discord.com/api/webhooks/..."
           className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-text outline-none"
         />
       </div>
 
       {success ? (
         <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
           {success}
         </p>
       ) : null}
       {error ? (
         <p className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
           {error}
         </p>
       ) : null}
 
       <button
         type="button"
         onClick={handleSave}
         disabled={isSaving}
         className="mt-4 inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
       >
         {isSaving ? "Enregistrement..." : "Enregistrer le webhook"}
       </button>
     </div>
   );
 }
