create unique index if not exists raid_performance_event_user_unique
  on public.raid_performance(event_id, user_id);

drop policy if exists "raid_performance_delete" on public.raid_performance;
create policy "raid_performance_delete"
  on public.raid_performance
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      join public.guild_members gm on gm.guild_id = e.guild_id
      where e.id = raid_performance.event_id
        and gm.user_id = auth.uid()
    )
  );
