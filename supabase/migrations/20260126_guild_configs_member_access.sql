drop policy if exists "guild_configs_select_members" on public.guild_configs;
create policy "guild_configs_select_members"
  on public.guild_configs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
    )
  );

drop policy if exists "guild_configs_update_members" on public.guild_configs;
create policy "guild_configs_update_members"
  on public.guild_configs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
        and gm.role_rank in ('admin','conseiller')
    )
  )
  with check (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
        and gm.role_rank in ('admin','conseiller')
    )
  );
drop policy if exists "guild_configs_select_members" on public.guild_configs;
create policy "guild_configs_select_members"
  on public.guild_configs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
    )
  );

drop policy if exists "guild_configs_update_members" on public.guild_configs;
create policy "guild_configs_update_members"
  on public.guild_configs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
        and gm.role_rank in ('admin','conseiller')
    )
  )
  with check (
    exists (
      select 1
      from public.guilds g
      join public.guild_members gm on gm.guild_id = g.id
      where g.owner_id = guild_configs.owner_id
        and gm.user_id = auth.uid()
        and gm.role_rank in ('admin','conseiller')
    )
  );
