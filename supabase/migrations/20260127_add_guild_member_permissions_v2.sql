-- Add extra counselor permissions to guild_members.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'guild_members'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'guild_members'
        and column_name = 'perm_manage_polls'
    ) then
      alter table public.guild_members
        add column perm_manage_polls boolean not null default false;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'guild_members'
        and column_name = 'perm_right_hand'
    ) then
      alter table public.guild_members
        add column perm_right_hand boolean not null default false;
    end if;
  else
    raise exception 'La table guild_members est introuvable.';
  end if;
end $$;
