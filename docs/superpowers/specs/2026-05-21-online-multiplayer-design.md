# Pet Painters — Online Multiplayer Design Spec

**Status:** Draft
**Date:** 2026-05-21
**Scope:** Add a home menu, online 1v1 private rooms, Google SSO authentication, and admin moderation to the existing single-screen sandbox. Backed by Supabase (Postgres + Auth + Realtime).

---

## 1. Concept

Today, the game opens directly into a single sandbox where one user controls both sides hot-seat. We add:

- A **home menu** that appears at startup. Three options: **Sandbox** (current local hot-seat), **Online Play** (sign in and create/join private rooms), **Settings**.
- **Google Sign-In** gates online play. A user must be signed in to create or join an online room. Sandbox does not require sign-in.
- **Private rooms** with a 6-character code and optional password. The host shares the code (and password if set) out-of-band with their friend.
- **Lockstep multiplayer**: planning is private per player; both must press Ready; deployments are then merged and the deterministic sim runs identically on both clients. No frame-by-frame syncing — only round-boundary submissions cross the network.
- **Admin moderation**: a designated admin account (`tctctc888@gmail.com`) sees all active rooms and can force-delete any of them.
- **Capacity controls**: total active rooms capped globally; per-user create-rate limited.

---

## 2. Goals & non-goals

**Goals**
- Two friends can play a full match end-to-end across the internet, with one URL or room code shared between them.
- The hot-seat sandbox keeps working unchanged for solo experimentation.
- Network usage is minimal — only deployments per round plus heartbeats.
- The host's account is enough auth to set up the room; the guest can join with code + password.
- Safe defaults: rooms expire, total rooms are capped, password is required for public-facing builds.

**Non-goals (deferred)**
- Spectators, reconnects-after-disconnect-with-state-resume, friend lists, matchmaking, ranked play, lobbies, chat, replay sharing.
- Anonymous (no-sign-in) play. Online play requires Google SSO.
- Mobile-specific UX.
- Anti-cheat beyond standard RLS and the deterministic-sim cross-check.

## 3. The lockstep model

The user has correctly identified that the sandbox phase model maps cleanly to a network protocol with *no frame-level sync*:

- During **planning**, each player privately queues deployments locally. The opponent sees nothing — not even an indicator that the opponent is queueing.
- When a player hits **Ready**, their queued deployments are committed to the server as a single `RoundSubmission`.
- When **both** players' submissions for the same round are present, both clients independently fetch them, apply both, and run the same deterministic execution phase locally.
- After the execution phase ends, both clients display the same round-summary and re-enter planning. Repeat.

**This means**: between rounds, the network is doing maybe 2 small POSTs (one per player) and 2 small reads. No 20 Hz streaming. Supabase Realtime is used only as a notification channel ("both submissions are in, you can run the round").

If a client crashes mid-execution, they reload, re-fetch the last `round` and all `RoundSubmission`s, replay from the snapshot, and resume. Sim determinism is the only thing this requires of the engine — which it already has (no `Math.random` in any sim path that affects state; weight tiebreaks use a seeded RNG seeded per round from `room_id` + `round`).

> **Required engine change for determinism**: the existing movement resolver uses `Math.random()` for weight-tied entry-conflict tiebreaks. We replace this with a seeded RNG instance threaded through `MatchState`, seeded per round from `hash(room_id, round)` on online matches. Sandbox continues to use `Math.random()` if `state.rng` is null.

## 4. Screens & flow

```
┌──────────────────┐
│   Home menu      │ ── Sandbox ───→ existing sandbox-ui (unchanged)
│                  │
│ • Sandbox        │ ── Online ────→ ┌──────────────────┐
│ • Online Play    │                  │ Sign in screen   │
│ • Settings       │                  │ [Google button]  │
└──────────────────┘                  └────────┬─────────┘
                                                ↓
                                       ┌──────────────────┐
                                       │ Lobby            │
                                       │ • Create room    │
                                       │ • Join room      │
                                       │ • Admin (if)     │
                                       └────────┬─────────┘
                                                ↓
                                       ┌──────────────────┐
                                       │ Room (waiting    │
                                       │ for opponent)    │
                                       │ • Show code      │
                                       │ • Copy URL       │
                                       │ • Leave          │
                                       └────────┬─────────┘
                                                ↓ (opponent joins)
                                       ┌──────────────────┐
                                       │ Online match     │
                                       │ same canvas, but │
                                       │ Ready submits to │
                                       │ network          │
                                       └──────────────────┘
```

### 4.1 Home menu
- Top: game title.
- Three buttons: **Sandbox**, **Online Play**, **Settings**.
- A small "signed in as X" indicator if a session exists.
- Keyboard: 1/2/3 to pick. Esc returns to home from any sub-screen.

### 4.2 Sign-in screen
- Visible only if Online Play is chosen and the user is not signed in.
- One button: **Sign in with Google**. (Supabase OAuth redirect.)
- Returns to lobby after the redirect callback completes.

### 4.3 Lobby
- "Create Room" button → opens a modal asking for an optional password (text input, blank = no password).
- "Join Room" form: 6-char code field + optional password field.
- If user is admin: an additional "Admin: rooms" panel listing all active rooms with **Delete** buttons.
- Back to home button.

### 4.4 Room (waiting)
- Shows the room code in large text.
- "Copy invite link" button — copies `https://<site>/?room=XXXXXX` to clipboard.
- "Copy password" button if a password is set.
- A spinner / message: "Waiting for opponent to join…"
- "Leave room" button (returns to lobby and deletes the room if you're the host and no opponent yet, else just exits).

### 4.5 Online match
- Reuses the existing sandbox canvas and HUD layout.
- The key difference from sandbox: only YOUR pets are visible-as-yours-during-planning. Opponent's queued deployments are not shown until the execution phase begins.
- Pressing **Ready** sends your submission to the server. The HUD changes to "Waiting for opponent…"
- Once both submissions land, the execution phase begins locally and renders identically on both screens.
- Disconnect/leave: shows a "your opponent left" overlay; offers to wait or return to lobby.

### 4.6 Game over
- The existing win overlay, plus a "Back to lobby" button (no rematch in v1 — they can create a new room).

## 5. Data model (Supabase Postgres)

### 5.1 Tables

```sql
-- Profiles: app-level user metadata.
-- (Supabase Auth provides auth.users; profiles links by id and adds our fields.)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Rooms: one row per active or recently-ended match.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) = 6),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete set null,
  password_hash text,  -- bcrypt hash, null = no password
  status text not null default 'waiting' check (status in ('waiting','playing','ended','abandoned')),
  current_round int not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index rooms_status_idx on public.rooms(status);
create index rooms_host_idx on public.rooms(host_id);
create index rooms_last_activity_idx on public.rooms(last_activity_at);

-- One submission per (room, round, player slot).
create table public.round_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round int not null,
  player_slot text not null check (player_slot in ('A','B')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deployments jsonb not null,  -- array of { defId, anchor: {x,y}, facing }
  submitted_at timestamptz not null default now(),
  unique (room_id, round, player_slot)
);

create index round_submissions_room_round_idx on public.round_submissions(room_id, round);
```

### 5.2 Why no full `match_state` snapshot?

The deterministic sim means we don't need to store the full game state. To reconstruct the current state on a reconnect, the client:
1. Reads the room (gets `current_round`).
2. Reads all `round_submissions` for that room ordered by round.
3. Locally replays from initial state, applying each round's deployments to a fresh `MatchState` and running execution to completion.

This is fast enough for short games (1-3 minutes of play, ~10-30 rounds). It also means the sim is the source of truth and the database cannot diverge from it.

If replay speed becomes an issue, we add a snapshot column to `rooms` later. v1 doesn't need it.

### 5.3 Row-level security (RLS)

Goals: a user can only read/write their own profile, only authed users see their own rooms or rooms they're a participant in, admins can do anything.

```sql
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.round_submissions enable row level security;

-- Profiles
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Rooms: only participants can read; only host can insert; only participants can update certain fields; only admin can delete.
create policy "rooms_participant_read" on public.rooms
  for select using (
    auth.uid() = host_id
    or auth.uid() = guest_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "rooms_host_insert" on public.rooms
  for insert with check (auth.uid() = host_id);

create policy "rooms_participant_update" on public.rooms
  for update using (auth.uid() = host_id or auth.uid() = guest_id);

create policy "rooms_admin_delete" on public.rooms
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Round submissions: only participants can read or insert their own slot.
create policy "subs_participant_read" on public.round_submissions
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = round_submissions.room_id
        and (r.host_id = auth.uid() or r.guest_id = auth.uid()
             or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
    )
  );

create policy "subs_self_insert" on public.round_submissions
  for insert with check (user_id = auth.uid());
```

Server-side functions enforce things RLS can't, see §5.4.

### 5.4 Server-side RPC functions

We use Postgres functions called via `supabase.rpc(...)` for operations that need atomic checks beyond RLS.

```sql
-- create_room: enforces global cap and per-user rate limit, hashes password, returns room id + code.
create or replace function public.create_room(
  password_plain text default null
) returns table (id uuid, code text) language plpgsql security definer as $$
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

  select count(*) into active_count from public.rooms where status in ('waiting','playing');
  if active_count >= 20 then
    raise exception 'room cap reached';
  end if;

  select count(*) into user_recent
    from public.rooms
    where host_id = auth.uid()
      and created_at > now() - interval '60 seconds';
  if user_recent >= 3 then
    raise exception 'rate limit exceeded';
  end if;

  -- generate a 6-char alphanumeric code, retry on collision
  loop
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    perform 1 from public.rooms where code = new_code;
    if not found then exit; end if;
    attempt := attempt + 1;
    if attempt > 10 then raise exception 'code generation failed'; end if;
  end loop;

  insert into public.rooms (code, host_id, password_hash)
    values (
      new_code,
      auth.uid(),
      case when password_plain is null or password_plain = '' then null
           else crypt(password_plain, gen_salt('bf'))
      end
    )
    returning rooms.id into new_id;

  return query select new_id, new_code;
end;
$$;

-- join_room: looks up by code, verifies password, sets guest_id, transitions status.
create or replace function public.join_room(
  room_code text,
  password_plain text default null
) returns uuid language plpgsql security definer as $$
declare
  target public.rooms;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select * into target from public.rooms where code = upper(room_code);
  if not found then raise exception 'no such room'; end if;
  if target.status != 'waiting' then raise exception 'room not joinable'; end if;
  if target.host_id = auth.uid() then raise exception 'cannot join your own room'; end if;
  if target.guest_id is not null then raise exception 'room full'; end if;
  if target.password_hash is not null then
    if password_plain is null or crypt(password_plain, target.password_hash) != target.password_hash then
      raise exception 'wrong password';
    end if;
  end if;

  update public.rooms
    set guest_id = auth.uid(),
        status = 'playing',
        last_activity_at = now()
    where id = target.id;

  return target.id;
end;
$$;
```

`crypt` and `gen_salt` require the `pgcrypto` extension, enabled in the SQL setup.

### 5.5 Cleanup

A Supabase scheduled function (cron) runs every 5 minutes:
- Mark `waiting` rooms older than 30 minutes as `abandoned`.
- Mark `playing` rooms with no `last_activity_at` update for 15 minutes as `abandoned`.
- Hard-delete `abandoned` rooms older than 1 day.

## 6. Realtime

Each client in an online match subscribes to two channels:

- `room:<id>` — listens for the `rooms` row update (especially `guest_id` filling in to know the opponent joined, and `current_round` changing).
- `submissions:<room_id>` — listens for new `round_submissions` rows. When both `A` and `B` for the same round exist, the client transitions from "waiting for opponent" into the execution phase.

Both subscriptions use Supabase Realtime's Postgres changes feature — no custom WebSocket server.

## 7. Determinism & cheating

The trust model is "neither client is fully trusted but neither is heavily incentivized to cheat in a private-room casual game." We design for honest play with mild detection:

- **All deployments respect server-side validity** insofar as they're stored verbatim and validated at execution-replay time. If client X submits an invalid deployment (e.g., outside home zone, insufficient energy), the OTHER client's replay rejects it and reports a desync.
- **Desync detection**: each client computes a hash of the final `MatchState` at the end of each execution phase and includes it in a tiny `round_hashes` table. If two clients disagree, the room is marked `abandoned` and both clients show a "desync detected" message.
- **Seeded RNG**: any randomness used in the sim (currently only the weight-tied random tiebreak) is replaced with a per-round seeded RNG so the two clients produce identical results.

Anti-cheat beyond this is out of scope for v1 — no server-authoritative sim, no replay validation, etc.

## 8. Admin

A profile with `is_admin = true` can:
- See an "Admin Panel" link in the lobby.
- View a list of all active rooms (status, code, host email, last activity).
- Delete any room (RLS allows admin to `delete` on rooms; cascading removes submissions).

The user (`tctctc888@gmail.com`) is granted admin via a one-time SQL `update profiles set is_admin = true where email = 'tctctc888@gmail.com';` after first sign-in.

## 9. Frontend architecture

We introduce a top-level **app router** that switches between screens. We use a simple `<div>` switcher (no React Router, no React at all — vanilla TS keeps consistency with the existing codebase).

```
src/
  app/
    router.ts         # Screen enum + switcher
    screens/
      home.ts         # Home menu
      sandbox.ts      # Wraps existing sandbox-ui
      sign-in.ts      # Google button + redirect handler
      lobby.ts        # Create/join + admin list
      room-waiting.ts # Show code, wait for opponent
      online-match.ts # Reuses sandbox canvas with online controller
      settings.ts     # Palette toggle, sound, etc.
  online/
    supabase.ts       # Initialize Supabase client from env
    auth.ts           # signInWithGoogle, signOut, current user
    rooms.ts          # createRoom, joinRoom, leaveRoom, listAdminRooms
    online-match.ts   # The online match controller (submit, await both, run exec)
    rng.ts            # Seeded RNG for determinism
  config/
    env.ts            # Reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

The existing `src/main.ts` becomes a thin entry that boots the router. The router renders the home menu by default, parses `?room=XXXXXX` from URL to deep-link into join flow.

### 9.1 Online match controller

```typescript
class OnlineMatchController {
  constructor(
    private roomId: string,
    private mySlot: 'A' | 'B',
    private state: MatchState,
  ) {}

  // Called when the local Ready button is pressed.
  async submitReady(deployments: DeploymentDTO[]): Promise<void> {
    await supabase.from('round_submissions').insert({
      room_id: this.roomId,
      round: this.state.round,
      player_slot: this.mySlot,
      deployments,
    });
    // wait for both submissions to land (via realtime subscription)
  }

  // Called by realtime subscription when both submissions exist.
  async runRound(submissions: RoundSubmission[]): Promise<void> {
    for (const sub of submissions) applyDeployments(this.state, sub);
    // Local execution phase begins; sim runs deterministically.
  }
}
```

### 9.2 Sandbox integrity

The existing sandbox code is preserved untouched. The screen router decides which controller drives the canvas (sandbox-ui or online-match) but the canvas, render layer, and sim engine are shared.

## 10. Settings screen

Mostly a relocation of toggles already in the sidebar:
- Colorblind palette toggle (already exists)
- Reduced motion (already exists)
- Sound on/off (placeholder; sound not implemented in v1.1)
- Sign-out button (if signed in)

## 11. Capacity & abuse limits

| Limit | Value | Enforcement |
|---|---|---|
| Total active rooms | 20 | `create_room` RPC checks |
| Rooms per host per minute | 3 | `create_room` RPC checks |
| Submissions per room per round | 1 per slot | UNIQUE constraint |
| Auth required for online play | yes | Supabase Auth gate |
| Anonymous rooms | no | All rooms have a host_id |
| Password required | optional | Host's choice |
| Auto-abandon idle rooms | 15-30 min | Scheduled cleanup |

## 12. URL routing

- `/` — home menu
- `/?screen=sandbox` — sandbox (deep link)
- `/?screen=online` — online lobby (sign-in if not authed)
- `/?room=XYZ123` — deep link to join. If signed in, presents a password prompt (if needed) and joins. If not signed in, shows sign-in first, then continues to join.

We use query params (not history API routes) so deployment doesn't need server rewrites.

## 13. Out of scope for v1 (multiplayer)

- Spectators
- Replays / shareable replay URLs
- Multi-round series (best-of-3)
- Reconnect mid-execution (only mid-planning is supported; mid-execution reconnect is best-effort via replay)
- Friend system, profiles, avatars
- Per-room chat
- Tournament mode
- Mobile-specific UI

## 14. Known gaps & risks

1. **Realtime delivery is best-effort.** If a Realtime event is missed, the client falls back to a 5-second poll of `round_submissions` for the current room. Acceptable for a casual game.
2. **Determinism enforcement is hash-based, not cryptographic.** A motivated cheater could fake a hash. Out of scope.
3. **The 20-room cap is global.** If someone wants to play but the cap is full, they have to wait or ask admin. This is a deliberate cost-control choice — Supabase free tier limits.
4. **No email/password fallback for sign-in.** Only Google. If Google is down, online play is down. Trade-off for simplicity.
5. **Password handling**: passwords are bcrypt-hashed and never returned to the client. The host re-enters or copy-pastes from the lobby UI when sharing.

## 15. Deployment

The app is a static site (Vite build). Deploy targets:
- Vercel, Netlify, Cloudflare Pages — all work.
- Supabase project URL and anon key are public (safe to ship in the bundle; RLS protects the data).
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the host's environment.

## 16. Recap

A home menu fronts the existing sandbox. Online Play requires Google sign-in. Authed users create or join 6-char private rooms with optional passwords; rooms cap at 20 globally. Submissions per round are stored in Postgres; both clients independently apply both submissions and run the deterministic sim — Realtime notifies when both submissions are in. Admin (`tctctc888@gmail.com`) can see and delete any room. The sandbox stays untouched.
