-- Create combat replays + comments for War Room.

create table if not exists public.combat_replays (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  title text not null,
  result text not null check (result in ('WIN', 'LOSS', 'DRAW')),
  enemy_guild text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.replay_comments (
  id uuid primary key default gen_random_uuid(),
  replay_id uuid not null references public.combat_replays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  timestamp_ref text,
  created_at timestamptz not null default now()
);

alter table public.combat_replays enable row level security;
alter table public.replay_comments enable row level security;

drop policy if exists combat_replays_select on public.combat_replays;
create policy combat_replays_select
  on public.combat_replays
  for select
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = combat_replays.guild_id
    )
  );

drop policy if exists combat_replays_insert on public.combat_replays;
create policy combat_replays_insert
  on public.combat_replays
  for insert
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = combat_replays.guild_id
    )
  );

drop policy if exists replay_comments_select on public.replay_comments;
create policy replay_comments_select
  on public.replay_comments
  for select
  using (
    exists (
      select 1
      from public.combat_replays cr
      join public.guild_members gm on gm.guild_id = cr.guild_id
      where cr.id = replay_comments.replay_id
        and gm.user_id = auth.uid()
    )
  );

drop policy if exists replay_comments_insert on public.replay_comments;
create policy replay_comments_insert
  on public.replay_comments
  for insert
  with check (
    exists (
      select 1
      from public.combat_replays cr
      join public.guild_members gm on gm.guild_id = cr.guild_id
      where cr.id = replay_comments.replay_id
        and gm.user_id = auth.uid()
    )
  );
