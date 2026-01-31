create table if not exists public.discord_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null,
  day_key text,
  channel_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists discord_channels_owner_kind_day_key_idx
  on public.discord_channels(owner_id, kind, day_key);

alter table public.discord_channels enable row level security;

drop policy if exists "discord_channels_select" on public.discord_channels;
create policy "discord_channels_select"
  on public.discord_channels
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "discord_channels_insert" on public.discord_channels;
create policy "discord_channels_insert"
  on public.discord_channels
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "discord_channels_update" on public.discord_channels;
create policy "discord_channels_update"
  on public.discord_channels
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "discord_channels_delete" on public.discord_channels;
create policy "discord_channels_delete"
  on public.discord_channels
  for delete
  to authenticated
  using (owner_id = auth.uid());
