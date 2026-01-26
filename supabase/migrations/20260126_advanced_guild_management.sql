-- Migration Finalisee : Gestion Guilde Avancee (Safe + Alignee)

-- 1) MISE A JOUR TABLE event_signups (assigned_role)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_signups'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'event_signups'
        AND column_name = 'assigned_role'
    ) THEN
      ALTER TABLE public.event_signups
        ADD COLUMN assigned_role text;
    END IF;
  ELSE
    RAISE NOTICE 'Table public.event_signups absente - aucune colonne ajoutee.';
  END IF;
END $$;

-- 2) MISE A JOUR TABLE guild_configs (loot_system + CHECK)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'guild_configs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'guild_configs'
        AND column_name = 'loot_system'
    ) THEN
      ALTER TABLE public.guild_configs
        ADD COLUMN loot_system text DEFAULT 'council';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'guild_configs_loot_system_check'
    ) THEN
      ALTER TABLE public.guild_configs
        ADD CONSTRAINT guild_configs_loot_system_check
        CHECK (loot_system IN ('fcfs', 'roll', 'council'));
    END IF;
  END IF;
END $$;

-- 3) CREATION TABLE guild_role_permissions + RLS
CREATE TABLE IF NOT EXISTS public.guild_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  can_manage_pve boolean NOT NULL DEFAULT false,
  can_manage_pvp boolean NOT NULL DEFAULT false,
  can_manage_roster boolean NOT NULL DEFAULT false,
  can_manage_loot boolean NOT NULL DEFAULT false,
  can_distribute_loot boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  can_manage_permissions boolean NOT NULL DEFAULT false,
  UNIQUE (guild_id, role_name)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'guild_role_permissions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'guild_role_permissions'
        AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE public.guild_role_permissions ENABLE ROW LEVEL SECURITY;
    END IF;

    DROP POLICY IF EXISTS guild_role_permissions_select ON public.guild_role_permissions;
    DROP POLICY IF EXISTS guild_role_permissions_modify ON public.guild_role_permissions;

    CREATE POLICY guild_role_permissions_select
      ON public.guild_role_permissions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = guild_role_permissions.guild_id
            AND gm.user_id = auth.uid()
        )
      );

    CREATE POLICY guild_role_permissions_modify
      ON public.guild_role_permissions
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = guild_role_permissions.guild_id
            AND gm.user_id = auth.uid()
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = guild_role_permissions.guild_id
            AND gm.user_id = auth.uid()
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      );
  END IF;
END $$;

-- 4) CREATION TABLE loot_history + RLS
CREATE TABLE IF NOT EXISTS public.loot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  raid_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  loot_method text
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loot_history'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'loot_history'
        AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE public.loot_history ENABLE ROW LEVEL SECURITY;
    END IF;

    DROP POLICY IF EXISTS loot_history_select ON public.loot_history;
    DROP POLICY IF EXISTS loot_history_modify ON public.loot_history;

    CREATE POLICY loot_history_select
      ON public.loot_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = loot_history.guild_id
            AND gm.user_id = auth.uid()
        )
      );

    CREATE POLICY loot_history_modify
      ON public.loot_history
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = loot_history.guild_id
            AND gm.user_id = auth.uid()
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.guild_id = loot_history.guild_id
            AND gm.user_id = auth.uid()
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      );
  END IF;
END $$;
