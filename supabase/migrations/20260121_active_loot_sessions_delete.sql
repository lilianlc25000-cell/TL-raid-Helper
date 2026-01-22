-- Allow admins/conseillers to delete loot sessions in their guild
drop policy if exists "active_loot_sessions_delete" on public.active_loot_sessions;
create policy "active_loot_sessions_delete"
  on public.active_loot_sessions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = active_loot_sessions.guild_id
        and gm.role_rank in ('admin','conseiller')
    )
  );
