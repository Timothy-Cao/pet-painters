-- ============================================================================
-- Pet Painters — Supabase schema
-- Paste this entire file into Supabase SQL Editor and run once.
-- Idempotent: safe to re-run.
--
-- All Pet Painters tables, policies, and functions live in the `pet_painters`
-- schema so this can be shared with other Supabase projects (e.g., timi-and-jam,
-- misconfigured) without colliding with their `public` tables.
--
-- The Supabase JS client (in src/online/supabase.ts) is configured to default
-- to this schema, so application code uses unqualified names like
-- supabase.from('rooms') and they resolve to pet_painters.rooms automatically.
-- ============================================================================

-- Schema --------------------------------------------------------------------
create schema if not exists pet_painters;

-- Grant the anon and authenticated roles USAGE on our schema so PostgREST
-- (Supabase's data API) can see and query it.
grant usage on schema pet_painters to anon, authenticated;

-- Extensions ----------------------------------------------------------------
-- (Extensions install into `public` or `extensions` schema; they're shared.)
create extension if not exists pgcrypto;   -- crypt(), gen_salt() for password hashing
create extension if not exists "uuid-ossp"; -- gen_random_uuid()

-- Tables --------------------------------------------------------------------

-- profiles: app-level user metadata. Linked to Supabase Auth's auth.users.
create table if not exists pet_painters.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- rooms: one row per active or recently-ended match.
create table if not exists pet_painters.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) = 6),
  host_id uuid not null references pet_painters.profiles(id) on delete cascade,
  guest_id uuid references pet_painters.profiles(id) on delete set null,
  password_hash text,
  status text not null default 'waiting' check (status in ('waiting','playing','ended','abandoned')),
  current_round int not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists rooms_status_idx on pet_painters.rooms(status);
create index if not exists rooms_host_idx on pet_painters.rooms(host_id);
create index if not exists rooms_last_activity_idx on pet_painters.rooms(last_activity_at);

-- round_submissions: one row per (room, round, slot).
create table if not exists pet_painters.round_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references pet_painters.rooms(id) on delete cascade,
  round int not null,
  player_slot text not null check (player_slot in ('A','B')),
  user_id uuid not null references pet_painters.profiles(id) on delete cascade,
  deployments jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (room_id, round, player_slot)
);

create index if not exists round_submissions_room_round_idx on pet_painters.round_submissions(room_id, round);

-- Realtime: opt these tables into Realtime replication ----------------------
alter publication supabase_realtime add table pet_painters.rooms;
alter publication supabase_realtime add table pet_painters.round_submissions;

-- Row-level security --------------------------------------------------------

alter table pet_painters.profiles enable row level security;
alter table pet_painters.rooms enable row level security;
alter table pet_painters.round_submissions enable row level security;

-- Drop existing policies before recreating (idempotent re-runs).
drop policy if exists "profiles_self_read" on pet_painters.profiles;
drop policy if exists "profiles_self_upsert_insert" on pet_painters.profiles;
drop policy if exists "profiles_self_update" on pet_painters.profiles;
drop policy if exists "profiles_admin_all" on pet_painters.profiles;

drop policy if exists "rooms_participant_read" on pet_painters.rooms;
drop policy if exists "rooms_host_insert" on pet_painters.rooms;
drop policy if exists "rooms_participant_update" on pet_painters.rooms;
drop policy if exists "rooms_admin_delete" on pet_painters.rooms;

drop policy if exists "subs_participant_read" on pet_painters.round_submissions;
drop policy if exists "subs_self_insert" on pet_painters.round_submissions;

-- Profiles: every user can read/update their own row. Admins see all.
create policy "profiles_self_read" on pet_painters.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "profiles_self_upsert_insert" on pet_painters.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_self_update" on pet_painters.profiles
  for update using (auth.uid() = id);

create policy "profiles_admin_all" on pet_painters.profiles
  for all using (
    exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Rooms: participants (host or guest) and admins can read.
-- Only the host can insert their own room. Both participants can update
-- (e.g., guest_id, current_round, status). Only admins can delete.
create policy "rooms_participant_read" on pet_painters.rooms
  for select using (
    auth.uid() = host_id
    or auth.uid() = guest_id
    or exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "rooms_host_insert" on pet_painters.rooms
  for insert with check (auth.uid() = host_id);

create policy "rooms_participant_update" on pet_painters.rooms
  for update using (
    auth.uid() = host_id
    or auth.uid() = guest_id
    or exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "rooms_admin_delete" on pet_painters.rooms
  for delete using (
    exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Round submissions: room participants + admins can read; users can only
-- insert their own slot (matches user_id = auth.uid()).
create policy "subs_participant_read" on pet_painters.round_submissions
  for select using (
    exists (
      select 1 from pet_painters.rooms r
      where r.id = round_submissions.room_id
        and (
          r.host_id = auth.uid()
          or r.guest_id = auth.uid()
          or exists (select 1 from pet_painters.profiles p where p.id = auth.uid() and p.is_admin)
        )
    )
  );

create policy "subs_self_insert" on pet_painters.round_submissions
  for insert with check (user_id = auth.uid());

-- ============================================================================
-- RPC functions
-- ============================================================================

-- create_room: enforces global cap (20 active) and per-user rate limit
-- (3 rooms/minute). Hashes password with bcrypt. Returns id + code.
create or replace function pet_painters.create_room(password_plain text default null)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = pet_painters, public, pg_temp
as $$
declare
  active_count int;
  user_recent int;
  new_code text;
  attempt int := 0;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select count(*) into active_count
    from pet_painters.rooms
    where status in ('waiting','playing');
  if active_count >= 20 then
    raise exception 'room cap reached';
  end if;

  select count(*) into user_recent
    from pet_painters.rooms
    where host_id = auth.uid()
      and created_at > now() - interval '60 seconds';
  if user_recent >= 3 then
    raise exception 'rate limit exceeded';
  end if;

  -- Generate a 6-char uppercase alphanumeric code; retry on collision.
  loop
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    perform 1 from pet_painters.rooms where rooms.code = new_code;
    if not found then exit; end if;
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'code generation failed';
    end if;
  end loop;

  insert into pet_painters.rooms (code, host_id, password_hash)
    values (
      new_code,
      auth.uid(),
      case
        when password_plain is null or password_plain = '' then null
        else crypt(password_plain, gen_salt('bf'))
      end
    )
    returning rooms.id into new_id;

  return query select new_id, new_code;
end;
$$;

grant execute on function pet_painters.create_room(text) to authenticated;

-- join_room: looks up by code, verifies password, sets guest_id, transitions
-- room to 'playing'. Returns room id.
create or replace function pet_painters.join_room(room_code text, password_plain text default null)
returns uuid
language plpgsql
security definer
set search_path = pet_painters, public, pg_temp
as $$
declare
  target pet_painters.rooms;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select * into target from pet_painters.rooms where code = upper(room_code);
  if not found then
    raise exception 'no such room';
  end if;
  if target.status != 'waiting' then
    raise exception 'room not joinable';
  end if;
  if target.host_id = auth.uid() then
    raise exception 'cannot join your own room';
  end if;
  if target.guest_id is not null then
    raise exception 'room full';
  end if;
  if target.password_hash is not null then
    if password_plain is null
       or crypt(password_plain, target.password_hash) != target.password_hash then
      raise exception 'wrong password';
    end if;
  end if;

  update pet_painters.rooms
    set guest_id = auth.uid(),
        status = 'playing',
        last_activity_at = now()
    where id = target.id;

  return target.id;
end;
$$;

grant execute on function pet_painters.join_room(text, text) to authenticated;

-- ============================================================================
-- Done. Next steps:
--   1. After your first Google sign-in, promote yourself to admin:
--      update pet_painters.profiles set is_admin = true where email = 'tctctc888@gmail.com';
--
--   2. To cleanup idle rooms periodically, run (manually or via pg_cron):
--      update pet_painters.rooms set status = 'abandoned'
--        where status = 'waiting' and created_at < now() - interval '30 minutes';
--      update pet_painters.rooms set status = 'abandoned'
--        where status = 'playing' and last_activity_at < now() - interval '15 minutes';
--      delete from pet_painters.rooms
--        where status in ('abandoned','ended')
--          and last_activity_at < now() - interval '1 day';
-- ============================================================================
