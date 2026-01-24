alter table public.guild_configs
  add constraint guild_configs_owner_id_key unique (owner_id);
