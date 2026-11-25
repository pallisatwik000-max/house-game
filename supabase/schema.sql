-- 90 Numbers House Game: database schema
-- Run this in Supabase > SQL Editor > New query > Run

create extension if not exists pgcrypto;

-- PROFILES (one per login: owner or admin)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null check (role in ('owner','admin')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended')),
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- Owner-approved emails (admin signup allowed only for these)
create table if not exists admin_invites (
  email text primary key,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- GAMES
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  name text not null,
  slug text unique not null,
  pin_hash text not null,
  status text not null default 'lobby'
    check (status in ('lobby','running','paused','ended')),
  called_numbers int[] not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

-- PLAYERS (join via link + name + PIN, no account needed)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  ticket_count int not null check (ticket_count between 1 and 6),
  is_admin_player boolean default false,
  session_token text unique not null default encode(gen_random_bytes(24),'hex'),
  created_at timestamptz default now()
);

-- TICKETS: rows = [[5 numbers],[5 numbers],[5 numbers]]
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  ticket_no int not null,
  set_no int not null,
  rows jsonb not null,
  created_at timestamptz default now()
);

-- MARKS: player taps (server checks the number was called)
create table if not exists marks (
  ticket_id uuid not null references tickets(id) on delete cascade,
  number int not null check (number between 1 and 90),
  marked_at timestamptz default now(),
  primary key (ticket_id, number)
);

-- CLAIMS
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  category text not null check (category in
    ('FIRST_5','FIRST_LINE','SECOND_LINE','LAST_LINE','HOUSE_FULL')),
  status text not null check (status in ('valid','invalid')),
  numbers_called_at_claim int not null,
  created_at timestamptz default now(),
  unique (ticket_id, category)
);

-- Only one valid winner per category per game
create unique index if not exists one_winner_per_category
  on claims (game_id, category) where status = 'valid';

create index if not exists idx_players_game on players(game_id);
create index if not exists idx_tickets_player on tickets(player_id);
create index if not exists idx_claims_game on claims(game_id);

-- HELPERS
create or replace function is_owner() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and role = 'owner' and status = 'approved');
$$;

create or replace function is_approved_admin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'approved');
$$;

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table admin_invites enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table tickets enable row level security;
alter table marks enable row level security;
alter table claims enable row level security;

-- profiles
create policy "read own profile" on profiles
  for select using (id = auth.uid());
create policy "owner reads all profiles" on profiles
  for select using (is_owner());
create policy "owner updates profiles" on profiles
  for update using (is_owner());

-- admin_invites
create policy "owner manages invites" on admin_invites
  for all using (is_owner()) with check (is_owner());

-- games
create policy "owner reads all games" on games
  for select using (is_owner());
create policy "admin manages own games" on games
  for all using (admin_id = auth.uid() and is_approved_admin())
  with check (admin_id = auth.uid() and is_approved_admin());

-- players / tickets / marks / claims
create policy "admin reads players" on players for select using (
  is_owner() or exists (select 1 from games g
    where g.id = players.game_id and g.admin_id = auth.uid()));
create policy "admin reads tickets" on tickets for select using (
  is_owner() or exists (select 1 from games g
    where g.id = tickets.game_id and g.admin_id = auth.uid()));
create policy "admin reads marks" on marks for select using (
  is_owner() or exists (select 1 from tickets t join games g on g.id = t.game_id
    where t.id = marks.ticket_id and g.admin_id = auth.uid()));
create policy "admin reads claims" on claims for select using (
  is_owner() or exists (select 1 from games g
    where g.id = claims.game_id and g.admin_id = auth.uid()));

-- Realtime for the admin dashboard
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table claims;
alter publication supabase_realtime add table players;
