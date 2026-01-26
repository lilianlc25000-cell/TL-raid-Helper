-- Autoriser les admins/conseillers a forcer le role sur event_signups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_signups'
  ) THEN
    DROP POLICY IF EXISTS "event_signups_update_admin" ON public.event_signups;

    CREATE POLICY "event_signups_update_admin"
      ON public.event_signups
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.user_id = auth.uid()
            AND gm.guild_id = event_signups.guild_id
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.guild_members gm
          WHERE gm.user_id = auth.uid()
            AND gm.guild_id = event_signups.guild_id
            AND gm.role_rank IN ('admin', 'conseiller')
        )
      );
  ELSE
    RAISE NOTICE 'Table public.event_signups absente - policy non creee.';
  END IF;
END $$;
