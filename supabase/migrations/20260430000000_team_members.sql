-- Team members table for multi-tenant access control
-- client_id matches the folder name under clients/ (e.g. 'fboc')

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  created_at timestamptz default now(),
  unique(client_id, email)
);

create index if not exists idx_team_members_client on team_members(client_id);

alter table team_members enable row level security;

create policy "Members can view their team"
  on team_members for select
  using (exists (
    select 1 from team_members tm
    where tm.client_id = team_members.client_id
    and tm.email = auth.jwt() ->> 'email'
  ));

create policy "Owners and admins can manage team"
  on team_members for all
  using (exists (
    select 1 from team_members tm
    where tm.client_id = team_members.client_id
    and tm.email = auth.jwt() ->> 'email'
    and tm.role in ('owner', 'admin')
  ));

-- Seed FBOC team (run after table creation)
insert into team_members (client_id, email, role, accepted_at)
values
  ('fboc', 'jocelyn@frenchbloomsoc.com', 'owner', now()),
  ('fboc', 'jeramyjanz@gmail.com', 'admin', now())
on conflict (client_id, email) do nothing;
