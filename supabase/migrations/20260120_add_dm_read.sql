alter table public.direct_messages
  add column if not exists is_read boolean not null default false;

drop policy if exists "direct_messages_update" on public.direct_messages;
create policy "direct_messages_update"
  on public.direct_messages
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
