create table if not exists public.guild_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  discord_guild_id text,
  discord_webhook_url text,
  guild_name text,
  raid_channel_id text,
  polls_channel_id text,
  loot_channel_id text,
  groups_channel_id text,
  dps_channel_id text,
  statics_pvp_channel_id text,
  statics_pve_channel_id text,
  raid_webhook_url text,
  polls_webhook_url text,
  loot_webhook_url text,
  groups_webhook_url text,
  dps_webhook_url text,
  statics_pvp_webhook_url text,
  statics_pve_webhook_url text,
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guild_configs_owner_id_key'
  ) then
    alter table public.guild_configs
      add constraint guild_configs_owner_id_key unique (owner_id);
  end if;
end $$;
