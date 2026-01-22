create table if not exists public.player_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  guild_id uuid references public.guilds (id) on delete set null,
  build_name text not null,
  role text not null,
  archetype text,
  main_weapon text not null,
  off_weapon text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_builds_user_idx on public.player_builds (user_id);
create index if not exists player_builds_guild_idx on public.player_builds (guild_id);

alter table public.event_signups
  add column if not exists selected_build_id uuid references public.player_builds (id) on delete set null;

alter table public.player_builds enable row level security;

drop policy if exists "player_builds_select" on public.player_builds;
create policy "player_builds_select"
  on public.player_builds
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = player_builds.guild_id
    )
  );

drop policy if exists "player_builds_insert" on public.player_builds;
create policy "player_builds_insert"
  on public.player_builds
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      guild_id is null
      or exists (
        select 1
        from public.guild_members gm
        where gm.user_id = auth.uid()
          and gm.guild_id = player_builds.guild_id
      )
    )
  );

drop policy if exists "player_builds_update" on public.player_builds;
create policy "player_builds_update"
  on public.player_builds
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "player_builds_delete" on public.player_builds;
create policy "player_builds_delete"
  on public.player_builds
  for delete
  to authenticated
  using (user_id = auth.uid());
