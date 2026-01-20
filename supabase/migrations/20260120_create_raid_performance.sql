create unique index if not exists profiles_user_id_unique
  on public.profiles(user_id);

create table if not exists public.raid_performance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  class_played text,
  dps integer not null,
  total_damage bigint not null,
  duration_seconds integer not null,
  created_at timestamptz not null default now()
);

alter table public.raid_performance enable row level security;

drop policy if exists "raid_performance_select" on public.raid_performance;
create policy "raid_performance_select"
  on public.raid_performance
  for select
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

drop policy if exists "raid_performance_insert" on public.raid_performance;
create policy "raid_performance_insert"
  on public.raid_performance
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events e
      join public.guild_members gm on gm.guild_id = e.guild_id
      where e.id = raid_performance.event_id
        and gm.user_id = auth.uid()
    )
  );
