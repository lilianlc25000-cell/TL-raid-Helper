-- Helper to resolve current user's guild without RLS recursion
create or replace function public.current_user_guild_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select guild_id
  from public.profiles
  where user_id = auth.uid();
$$;

-- Allow any authenticated user to list guilds for onboarding
drop policy if exists "guilds_select" on public.guilds;
create policy "guilds_select"
  on public.guilds
  for select
  to authenticated
  using (true);

-- Avoid recursive RLS between guild_members and profiles
drop policy if exists "guild_members_select" on public.guild_members;
create policy "guild_members_select"
  on public.guild_members
  for select
  to authenticated
  using (guild_id = public.current_user_guild_id());

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or guild_id = public.current_user_guild_id()
  );
