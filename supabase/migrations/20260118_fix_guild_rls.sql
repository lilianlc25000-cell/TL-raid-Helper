-- Fix recursion in guild_members policies and allow listing guilds
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;

drop policy if exists "guilds_select" on public.guilds;
create policy "guilds_select"
  on public.guilds
  for select
  to authenticated
  using (true);

drop policy if exists "guild_members_select" on public.guild_members;
create policy "guild_members_select"
  on public.guild_members
  for select
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
