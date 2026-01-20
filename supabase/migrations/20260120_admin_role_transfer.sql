-- Allow guild admins to manage role ranks across members.

drop policy if exists "guild_members_update" on public.guild_members;
create policy "guild_members_update"
  on public.guild_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_members.guild_id
        and gm.role_rank = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_members.guild_id
        and gm.role_rank = 'admin'
    )
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = profiles.guild_id
        and gm.role_rank = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = profiles.guild_id
        and gm.role_rank = 'admin'
    )
  );
