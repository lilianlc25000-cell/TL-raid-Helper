-- Sync profiles.guild_id with guild_members changes
create or replace function public.sync_profile_guild_on_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles
    set guild_id = new.guild_id
    where user_id = new.user_id;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    update public.profiles
    set guild_id = new.guild_id
    where user_id = new.user_id;
    return new;
  end if;

  if (tg_op = 'DELETE') then
    update public.profiles
    set guild_id = null
    where user_id = old.user_id
      and guild_id = old.guild_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_profile_guild_on_member_insert on public.guild_members;
create trigger trg_sync_profile_guild_on_member_insert
after insert on public.guild_members
for each row execute function public.sync_profile_guild_on_member_change();

drop trigger if exists trg_sync_profile_guild_on_member_update on public.guild_members;
create trigger trg_sync_profile_guild_on_member_update
after update on public.guild_members
for each row execute function public.sync_profile_guild_on_member_change();

drop trigger if exists trg_sync_profile_guild_on_member_delete on public.guild_members;
create trigger trg_sync_profile_guild_on_member_delete
after delete on public.guild_members
for each row execute function public.sync_profile_guild_on_member_change();
