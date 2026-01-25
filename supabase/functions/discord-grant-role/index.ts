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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!botToken || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Variables d'environnement manquantes")
    }

    // 2. Auth Supabase
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Non connecté")
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error("Utilisateur introuvable")

    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey ?? supabaseAnonKey,
    )

    // 3. Trouver l'ID Discord lié au compte
    const discordIdentity = user.identities?.find(id => id.provider === 'discord')
    if (!discordIdentity) {
      return new Response(JSON.stringify({ error: "Compte Discord non lié" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    const discordUserId = discordIdentity.id

    // 4. Récupérer la config (Rôle et Serveur) via la guilde du profil
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('guild_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      throw new Error("Impossible de charger le profil")
    }

    if (!profile?.guild_id) {
      throw new Error("Aucune guilde associée au profil")
    }

    const { data: guild, error: guildError } = await adminClient
      .from('guilds')
      .select('owner_id')
      .eq('id', profile.guild_id)
      .maybeSingle()

    if (guildError || !guild?.owner_id) {
      throw new Error("Guilde introuvable")
    }

    const { data: config } = await adminClient
      .from('guild_configs')
      .select('discord_guild_id, discord_member_role_id')
      .eq('owner_id', guild.owner_id)
      .not('discord_member_role_id', 'is', null)
      .maybeSingle()

    if (!config?.discord_guild_id || !config?.discord_member_role_id) {
      throw new Error("Configuration serveur ou rôle introuvable")
    }

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