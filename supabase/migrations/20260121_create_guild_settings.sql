create table if not exists public.guild_settings (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  participation_threshold integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guild_settings enable row level security;

drop policy if exists "guild_settings_select" on public.guild_settings;
create policy "guild_settings_select"
  on public.guild_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_settings.guild_id
    )
  );

drop policy if exists "guild_settings_insert" on public.guild_settings;
create policy "guild_settings_insert"
  on public.guild_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_settings.guild_id
        and gm.role_rank in ('admin','conseiller')
    )
  );

drop policy if exists "guild_settings_update" on public.guild_settings;
create policy "guild_settings_update"
  on public.guild_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_settings.guild_id
        and gm.role_rank in ('admin','conseiller')
    )
  )
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_settings.guild_id
        and gm.role_rank in ('admin','conseiller')
    )
  );
