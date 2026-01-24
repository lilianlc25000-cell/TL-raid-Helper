alter table public.guild_configs
  add column if not exists discord_app_id text,
  add column if not exists discord_bot_token_ref text,
  add column if not exists raid_channel_id text,
  add column if not exists polls_channel_id text,
  add column if not exists loot_channel_id text,
  add column if not exists groups_channel_id text,
  add column if not exists dps_channel_id text,
  add column if not exists raid_webhook_url text,
  add column if not exists polls_webhook_url text,
  add column if not exists loot_webhook_url text,
  add column if not exists groups_webhook_url text,
  add column if not exists dps_webhook_url text;
