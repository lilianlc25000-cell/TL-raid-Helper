-- Add eligibility criteria + discord channels config + activity points

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
        AND column_name = 'discord_channel_config'
    ) THEN
      ALTER TABLE public.guild_configs
        ADD COLUMN discord_channel_config jsonb;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'guild_configs'
        AND column_name = 'eligibility_criteria'
    ) THEN
      ALTER TABLE public.guild_configs
        ADD COLUMN eligibility_criteria text[];
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'activity_points'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN activity_points integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'activity_points_updated_at'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN activity_points_updated_at timestamptz;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activity_points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_points_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_points_history_select ON public.activity_points_history;
CREATE POLICY activity_points_history_select
  ON public.activity_points_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.guild_members gm
      WHERE gm.guild_id = activity_points_history.guild_id
        AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS activity_points_history_insert ON public.activity_points_history;
CREATE POLICY activity_points_history_insert
  ON public.activity_points_history
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.guild_members gm
      WHERE gm.guild_id = activity_points_history.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role_rank IN ('admin', 'conseiller')
    )
  );
