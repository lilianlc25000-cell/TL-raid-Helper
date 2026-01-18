-- Enable RLS
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_signups enable row level security;
alter table public.active_loot_sessions enable row level security;
alter table public.gear_wishlist enable row level security;
alter table public.loot_rolls enable row level security;
alter table public.notifications enable row level security;
alter table public.guild_messages enable row level security;

-- Guilds: members can read, owner can update
drop policy if exists "guilds_select" on public.guilds;
create policy "guilds_select"
  on public.guilds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guilds.id
    )
  );

drop policy if exists "guilds_insert" on public.guilds;
create policy "guilds_insert"
  on public.guilds
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "guilds_update" on public.guilds;
create policy "guilds_update"
  on public.guilds
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Guild members: members can read, owner can manage
drop policy if exists "guild_members_select" on public.guild_members;
create policy "guild_members_select"
  on public.guild_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_members.guild_id
    )
  );

drop policy if exists "guild_members_insert" on public.guild_members;
create policy "guild_members_insert"
  on public.guild_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.guilds g
      where g.id = guild_members.guild_id
    )
  );

drop policy if exists "guild_members_update" on public.guild_members;
create policy "guild_members_update"
  on public.guild_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guilds g
      where g.id = guild_members.guild_id
        and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.guilds g
      where g.id = guild_members.guild_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "guild_members_delete" on public.guild_members;
create policy "guild_members_delete"
  on public.guild_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.guilds g
      where g.id = guild_members.guild_id
        and g.owner_id = auth.uid()
    )
  );

-- Profiles: members in same guild can read, users can edit own profile
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = profiles.guild_id
    )
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helper: same-guild access
-- Events
drop policy if exists "events_select" on public.events;
create policy "events_select"
  on public.events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = events.guild_id
    )
  );

drop policy if exists "events_insert" on public.events;
create policy "events_insert"
  on public.events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = events.guild_id
    )
  );

drop policy if exists "events_update" on public.events;
create policy "events_update"
  on public.events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = events.guild_id
    )
  )
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = events.guild_id
    )
  );

-- Event signups
drop policy if exists "event_signups_select" on public.event_signups;
create policy "event_signups_select"
  on public.event_signups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = event_signups.guild_id
    )
  );

drop policy if exists "event_signups_insert" on public.event_signups;
create policy "event_signups_insert"
  on public.event_signups
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = event_signups.guild_id
    )
  );

drop policy if exists "event_signups_update" on public.event_signups;
create policy "event_signups_update"
  on public.event_signups
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Active loot sessions
drop policy if exists "active_loot_sessions_select" on public.active_loot_sessions;
create policy "active_loot_sessions_select"
  on public.active_loot_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = active_loot_sessions.guild_id
    )
  );

drop policy if exists "active_loot_sessions_insert" on public.active_loot_sessions;
create policy "active_loot_sessions_insert"
  on public.active_loot_sessions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = active_loot_sessions.guild_id
    )
  );

drop policy if exists "active_loot_sessions_update" on public.active_loot_sessions;
create policy "active_loot_sessions_update"
  on public.active_loot_sessions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = active_loot_sessions.guild_id
    )
  )
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = active_loot_sessions.guild_id
    )
  );

-- Gear wishlist
drop policy if exists "gear_wishlist_select" on public.gear_wishlist;
create policy "gear_wishlist_select"
  on public.gear_wishlist
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = gear_wishlist.guild_id
    )
  );

drop policy if exists "gear_wishlist_insert" on public.gear_wishlist;
create policy "gear_wishlist_insert"
  on public.gear_wishlist
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "gear_wishlist_update" on public.gear_wishlist;
create policy "gear_wishlist_update"
  on public.gear_wishlist
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Loot rolls
drop policy if exists "loot_rolls_select" on public.loot_rolls;
create policy "loot_rolls_select"
  on public.loot_rolls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = loot_rolls.guild_id
    )
  );

drop policy if exists "loot_rolls_insert" on public.loot_rolls;
create policy "loot_rolls_insert"
  on public.loot_rolls
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = loot_rolls.guild_id
    )
  );

-- Notifications
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert"
  on public.notifications
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = notifications.guild_id
    )
  );

-- Guild messages (general chat)
drop policy if exists "guild_messages_select" on public.guild_messages;
create policy "guild_messages_select"
  on public.guild_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_messages.guild_id
    )
  );

drop policy if exists "guild_messages_insert" on public.guild_messages;
create policy "guild_messages_insert"
  on public.guild_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.guild_members gm
      where gm.user_id = auth.uid()
        and gm.guild_id = guild_messages.guild_id
    )
  );
