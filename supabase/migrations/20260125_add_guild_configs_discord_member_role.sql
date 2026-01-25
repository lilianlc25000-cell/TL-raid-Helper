alter table public.guild_configs
add column if not exists discord_member_role_id text;
