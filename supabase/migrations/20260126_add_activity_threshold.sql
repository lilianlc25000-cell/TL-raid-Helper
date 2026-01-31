alter table public.guild_settings
  add column if not exists activity_threshold integer not null default 1;
