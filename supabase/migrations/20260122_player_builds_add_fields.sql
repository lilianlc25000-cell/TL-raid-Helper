alter table public.player_builds
  add column if not exists content_type text,
  add column if not exists gear_score integer;

update public.player_builds
set content_type = coalesce(content_type, 'PVE')
where content_type is null;
