create extension if not exists "pgcrypto";

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_rank text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists guild_members_user_idx
  on public.guild_members (user_id, guild_id);

alter table public.events
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.event_signups
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.active_loot_sessions
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.gear_wishlist
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.loot_rolls
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.notifications
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.guild_messages
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;

alter table public.profiles
  add column if not exists guild_id uuid references public.guilds (id) on delete set null;
