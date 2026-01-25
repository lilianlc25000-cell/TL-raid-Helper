create table public.guild_configs (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  discord_guild_id text not null,
  discord_guild_name text,
  raid_channel_id text,
  created_at timestamptz default now(),
  primary key (id),
  unique (owner_id),
  unique (discord_guild_id)
);

alter table public.guild_configs enable row level security;

create policy "Users can view their own config"
  on public.guild_configs
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert/update their own config"
  on public.guild_configs
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
