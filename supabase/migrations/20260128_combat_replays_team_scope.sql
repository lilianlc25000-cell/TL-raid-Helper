-- Add team scope + delete policy for War Room replays

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'combat_replays'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'combat_replays'
        AND column_name = 'team_index'
    ) THEN
      ALTER TABLE public.combat_replays
        ADD COLUMN team_index integer;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'combat_replays'
        AND column_name = 'mode'
    ) THEN
      ALTER TABLE public.combat_replays
        ADD COLUMN mode text;
    END IF;
  END IF;
END $$;

ALTER TABLE public.combat_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS combat_replays_delete ON public.combat_replays;
CREATE POLICY combat_replays_delete
  ON public.combat_replays
  FOR DELETE
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.guild_members gm
      WHERE gm.guild_id = combat_replays.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role_rank IN ('admin', 'conseiller')
    )
  );
