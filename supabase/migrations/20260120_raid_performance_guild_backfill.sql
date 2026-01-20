-- Add guild-based access fields and backfill from events.

alter table public.raid_performance
  add column if not exists guild_id uuid references public.guilds(id) on delete cascade,
  add column if not exists target_category text,
  alter column event_id drop not null;

update public.raid_performance rp
set guild_id = e.guild_id
from public.events e
where rp.event_id = e.id
  and rp.guild_id is null;

update public.raid_performance
set target_category = coalesce(target_category, 'unknown')
where target_category is null;

-- Replace policies to rely on guild_id instead of events
drop policy if exists "raid_performance_select" on public.raid_performance;
create policy "raid_performance_select"
  on public.raid_performance
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = raid_performance.guild_id
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
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = raid_performance.guild_id
    )
  );

drop policy if exists "raid_performance_delete" on public.raid_performance;
create policy "raid_performance_delete"
  on public.raid_performance
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = raid_performance.guild_id
    )
  );
