create table if not exists public.guild_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  discord_guild_id text not null,
  discord_webhook_url text not null,
  guild_name text not null,
  created_at timestamptz not null default now()
);

alter table public.guild_configs enable row level security;

drop policy if exists "guild_configs_select" on public.guild_configs;
create policy "guild_configs_select"
  on public.guild_configs
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "guild_configs_insert" on public.guild_configs;
create policy "guild_configs_insert"
  on public.guild_configs
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "guild_configs_update" on public.guild_configs;
create policy "guild_configs_update"
  on public.guild_configs
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
