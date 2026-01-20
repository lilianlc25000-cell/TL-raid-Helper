-- WARNING: Destructive reset of all app data + auth users.
-- Run only when you want a full wipe before launch.

-- 1) Clear application data
truncate table
  public.guild_messages,
  public.direct_messages,
  public.notifications,
  public.loot_rolls,
  public.gear_wishlist,
  public.event_signups,
  public.active_loot_sessions,
  public.events,
  public.statics_team_names,
  public.statics_teams,
  public.guild_members,
  public.guilds,
  public.profiles
restart identity cascade;

-- 2) Clear auth (emails, passwords, sessions, tokens)
delete from auth.sessions;
delete from auth.refresh_tokens;
delete from auth.users;
