create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  ends_at timestamptz not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- Admin helper
drop policy if exists "polls_admin_only" on public.polls;
create policy "polls_admin_only"
  on public.polls
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "polls_update_admin_only" on public.polls;
create policy "polls_update_admin_only"
  on public.polls
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "polls_delete_admin_only" on public.polls;
create policy "polls_delete_admin_only"
  on public.polls
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "polls_select" on public.polls;
create policy "polls_select"
  on public.polls
  for select
  to authenticated
  using (
    is_archived = false
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select"
  on public.poll_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.polls p
      where p.id = poll_options.poll_id
        and (
          p.is_archived = false
          or exists (
            select 1
            from public.profiles pr
            where pr.user_id = auth.uid()
              and pr.role_rank in ('admin', 'conseiller')
          )
        )
    )
  );

drop policy if exists "poll_options_admin_only" on public.poll_options;
create policy "poll_options_admin_only"
  on public.poll_options
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "poll_options_update_admin_only" on public.poll_options;
create policy "poll_options_update_admin_only"
  on public.poll_options
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "poll_options_delete_admin_only" on public.poll_options;
create policy "poll_options_delete_admin_only"
  on public.poll_options
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role_rank in ('admin', 'conseiller')
    )
  );

drop policy if exists "poll_votes_insert" on public.poll_votes;
create policy "poll_votes_insert"
  on public.poll_votes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "poll_votes_select" on public.poll_votes;
create policy "poll_votes_select"
  on public.poll_votes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.polls p
      where p.id = poll_votes.poll_id
        and (
          p.is_archived = false
          or exists (
            select 1
            from public.profiles pr
            where pr.user_id = auth.uid()
              and pr.role_rank in ('admin', 'conseiller')
          )
        )
    )
  );
