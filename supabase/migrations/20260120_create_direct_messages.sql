create extension if not exists "pgcrypto";

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  is_read boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_sender_idx
  on public.direct_messages (sender_id, created_at desc);

create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "direct_messages_select" on public.direct_messages;
create policy "direct_messages_select"
  on public.direct_messages
  for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "direct_messages_insert" on public.direct_messages;
create policy "direct_messages_insert"
  on public.direct_messages
  for insert
  with check (sender_id = auth.uid() and recipient_id <> auth.uid());

drop policy if exists "direct_messages_update" on public.direct_messages;
create policy "direct_messages_update"
  on public.direct_messages
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
