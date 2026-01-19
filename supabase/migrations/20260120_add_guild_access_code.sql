alter table public.guilds
  add column if not exists access_code text;

update public.guilds
set access_code = '1234'
where slug = 'trinity'
  and access_code is null;
