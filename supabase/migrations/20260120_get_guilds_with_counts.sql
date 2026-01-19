create or replace function public.get_guilds_with_counts()
returns table (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.slug,
    g.owner_id,
    coalesce(count(gm.user_id), 0) as member_count
  from public.guilds g
  left join public.guild_members gm on gm.guild_id = g.id
  group by g.id;
$$;
