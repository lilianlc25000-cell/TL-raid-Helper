import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestion CORS pour le navigateur
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Vérification des secrets
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!botToken || !supabaseUrl || !supabaseKey) {
      throw new Error("Variables d'environnement manquantes")
    }

    // 2. Auth Supabase
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Non connecté")
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error("Utilisateur introuvable")

    // 3. Trouver l'ID Discord lié au compte
    const discordIdentity = user.identities?.find(id => id.provider === 'discord')
    if (!discordIdentity) {
      return new Response(JSON.stringify({ error: "Compte Discord non lié" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    const discordUserId = discordIdentity.id

    // 4. Récupérer la config (Rôle et Serveur)
    const { data: config } = await supabase
      .from('guild_configs')
      .select('discord_guild_id, discord_member_role_id')
      .not('discord_member_role_id', 'is', null)
      .limit(1)
      .single()

    if (!config) throw new Error("Configuration serveur ou rôle introuvable")

    // 5. Donner le rôle sur Discord
    const discordUrl = `https://discord.com/api/v10/guilds/${config.discord_guild_id}/members/${discordUserId}/roles/${config.discord_member_role_id}`
    
    const response = await fetch(discordUrl, {
      method: 'PUT',
      headers: { Authorization: `Bot ${botToken}` }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Erreur Discord: ${text}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})