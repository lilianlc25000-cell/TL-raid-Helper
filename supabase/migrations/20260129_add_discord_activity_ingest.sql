-- Add Discord user mapping + activity screenshot support

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
        AND column_name = 'discord_user_id'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN discord_user_id text;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_points_history'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_points_history'
        AND column_name = 'image_url'
    ) THEN
      ALTER TABLE public.activity_points_history
        ADD COLUMN image_url text;
    END IF;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-screenshots', 'activity-screenshots', true)
ON CONFLICT (id) DO NOTHING;

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
        AND column_name = 'activity_channel_id'
    ) THEN
      ALTER TABLE public.guild_configs
        ADD COLUMN activity_channel_id text;
    END IF;
  END IF;
END $$;
