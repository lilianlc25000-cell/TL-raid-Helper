create extension if not exists "pgcrypto";

create table if not exists public.guild_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists guild_messages_created_idx
  on public.guild_messages (created_at desc);

alter table public.guild_messages enable row level security;

drop policy if exists "guild_messages_select" on public.guild_messages;
create policy "guild_messages_select"
  on public.guild_messages
  for select
  to authenticated
  using (true);

drop policy if exists "guild_messages_insert" on public.guild_messages;
create policy "guild_messages_insert"
  on public.guild_messages
  for insert
  to authenticated
  with check (sender_id = auth.uid());
