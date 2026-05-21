# Online Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a home menu and Supabase-backed online 1v1 private rooms (Google SSO, password-protected, admin moderation, lockstep deterministic sim) to Pet Painters, while preserving the existing sandbox.

**Architecture:** Vanilla TS screen router fronts the existing canvas. Supabase Auth (Google OAuth) gates online play. Postgres stores rooms + round submissions; pgcrypto hashes passwords; Realtime notifies when both submissions land per round. Each client runs the same deterministic sim — a seeded RNG replaces `Math.random` in the sim path so two clients produce identical execution. Cleanup cron prunes abandoned rooms.

**Tech Stack:** Existing (TS + Vite + Vitest + Canvas2D) plus `@supabase/supabase-js`.

**Spec reference:** [docs/superpowers/specs/2026-05-21-online-multiplayer-design.md](../specs/2026-05-21-online-multiplayer-design.md)

**Defer to user:** Tasks 14 (Supabase project + env vars), 15 (SQL migrations), and 16 (Google OAuth client setup) — all in the final hand-off doc. The code is written assuming the env vars will be filled in; everything else compiles and tests pass without a live Supabase project.

---

## Task 1: Seeded RNG and sim determinism

**Files:**
- Create: `src/sim/rng.ts`
- Modify: `src/types/game.ts` (add optional `rng` field to MatchState)
- Modify: `src/sim/movement.ts` (use rng if present, else fall back to Math.random)
- Modify: `src/sim/match.ts` (createInitialMatch accepts optional seed)
- Create: `tests/sim/rng.test.ts`

The current sim uses `Math.random()` in `movement.ts` for weight-tied entry-conflict tiebreaks. For online matches we need both clients to make the same "random" choice. A simple mulberry32 PRNG seeded from a hash of `room_id + round` works.

- [ ] **Step 1: Write the failing tests**

`tests/sim/rng.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from '../../src/sim/rng';

describe('createRng', () => {
  it('produces a deterministic sequence for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('values are in [0,1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('produces stable 32-bit integers', () => {
    expect(hashSeed('room-1', 0)).toBe(hashSeed('room-1', 0));
    expect(hashSeed('room-1', 0)).not.toBe(hashSeed('room-1', 1));
    expect(hashSeed('room-1', 0)).not.toBe(hashSeed('room-2', 0));
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test
```

- [ ] **Step 3: Implement src/sim/rng.ts**

```typescript
// mulberry32 — small, fast, deterministic PRNG.
// 32-bit seed; period ~2^32. More than enough for tiebreaks per round.

export interface Rng {
  next(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// FNV-1a 32-bit hash. Cheap and stable across browsers.
export function hashSeed(roomId: string, round: number): number {
  let h = 2166136261 >>> 0;
  const input = `${roomId}|${round}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Extend MatchState with optional `rng`**

In `src/types/game.ts`, add to `MatchState`:
```typescript
import type { Rng } from '../sim/rng';
// ...
export interface MatchState {
  // ... existing fields ...
  rng: Rng | null;  // null = use Math.random (sandbox); set for online matches
}
```

In `src/sim/match.ts`, set `rng: null` in `createInitialMatch`.

- [ ] **Step 5: Use rng in movement.ts**

In `src/sim/movement.ts`, find the line `return Math.random() - 0.5;` inside the sort comparator and replace with:
```typescript
return (state.rng ? state.rng.next() : Math.random()) - 0.5;
```

There's also a tiebreak in the processing order sort — same replacement.

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: All passing (existing 85 + new 4 = 89).

- [ ] **Step 7: Commit**

```bash
git add src/sim/rng.ts src/types/game.ts src/sim/movement.ts src/sim/match.ts tests/sim/rng.test.ts
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 1: seeded RNG for deterministic online sim"
```

---

## Task 2: Project structure for screens and online module

**Files:**
- Create: `src/app/router.ts`
- Create: `src/app/screens/home.ts`
- Create: `src/app/screens/sandbox.ts`
- Modify: `index.html` (add screen container element)
- Modify: `src/main.ts` (boot router)

This task moves the current single-screen sandbox behind a router. Online screens are added in later tasks.

- [ ] **Step 1: Modify index.html**

Replace the `<body>` contents with:
```html
<body>
  <div id="screen-root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

The existing canvas/sidebar DOM moves into the sandbox screen template.

- [ ] **Step 2: Create src/app/router.ts**

```typescript
export type ScreenName =
  | 'home'
  | 'sandbox'
  | 'sign-in'
  | 'lobby'
  | 'room-waiting'
  | 'online-match'
  | 'settings';

export interface Screen {
  name: ScreenName;
  mount(root: HTMLElement, params?: Record<string, string>): void | (() => void); // returns optional unmount fn
}

const REGISTRY: Map<ScreenName, Screen> = new Map();

export function registerScreen(s: Screen): void { REGISTRY.set(s.name, s); }

let currentUnmount: (() => void) | null = null;
let root: HTMLElement | null = null;

export function startRouter(rootEl: HTMLElement, initial: ScreenName = 'home'): void {
  root = rootEl;
  navigate(initial);
  window.addEventListener('popstate', () => navigate(currentScreenFromUrl()));
}

export function navigate(name: ScreenName, params: Record<string, string> = {}): void {
  if (!root) throw new Error('router not started');
  if (currentUnmount) currentUnmount();
  root.innerHTML = '';
  const screen = REGISTRY.get(name);
  if (!screen) throw new Error(`unknown screen: ${name}`);
  const unmount = screen.mount(root, params);
  currentUnmount = typeof unmount === 'function' ? unmount : null;

  // Update URL
  const url = new URL(window.location.href);
  url.searchParams.delete('screen');
  url.searchParams.delete('room');
  if (name !== 'home') url.searchParams.set('screen', name);
  if (params.room) url.searchParams.set('room', params.room);
  window.history.pushState({}, '', url.toString());
}

function currentScreenFromUrl(): ScreenName {
  const url = new URL(window.location.href);
  const name = url.searchParams.get('screen') as ScreenName | null;
  return name && REGISTRY.has(name) ? name : 'home';
}
```

- [ ] **Step 3: Create src/app/screens/home.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';

export const HomeScreen: Screen = {
  name: 'home',
  mount(root) {
    root.innerHTML = `
      <div class="home-screen">
        <h1>Pet Painters</h1>
        <p class="home-tagline">Drop pets. They walk. They paint. Most paint wins.</p>
        <div class="home-buttons">
          <button class="big-btn" id="btn-sandbox">Sandbox <span class="btn-sub">(local hot-seat)</span></button>
          <button class="big-btn" id="btn-online">Online Play <span class="btn-sub">(sign in to play with a friend)</span></button>
          <button class="big-btn" id="btn-settings">Settings</button>
        </div>
      </div>
    `;
    root.querySelector('#btn-sandbox')!.addEventListener('click', () => navigate('sandbox'));
    root.querySelector('#btn-online')!.addEventListener('click', () => navigate('sign-in'));
    root.querySelector('#btn-settings')!.addEventListener('click', () => navigate('settings'));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') navigate('sandbox');
      else if (e.key === '2') navigate('sign-in');
      else if (e.key === '3') navigate('settings');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  },
};
```

- [ ] **Step 4: Create src/app/screens/sandbox.ts (wraps existing sandbox)**

This screen extracts the previous `src/main.ts` body into a screen `mount()`:

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { createInitialMatch } from '../../sim/match';
import { createRenderContext, clearCanvas } from '../../render/canvas';
import { renderBoard } from '../../render/board';
import { renderPets } from '../../render/pets';
import { renderHUD } from '../../render/ui';
import {
  createDeployUIState,
  attachDeployUI,
  renderDeployPreview,
} from '../../input/deploy-ui';
import { GameLoop } from '../../loop';

export const SandboxScreen: Screen = {
  name: 'sandbox',
  mount(root) {
    root.innerHTML = `
      <div class="sandbox-screen">
        <div id="ui"></div>
        <canvas id="game" width="600" height="600"></canvas>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    const canvas = root.querySelector('#game') as HTMLCanvasElement;
    const rc = createRenderContext(canvas);
    const state = createInitialMatch();
    const ui = createDeployUIState();
    attachDeployUI(canvas, rc, state, ui);

    function render() {
      clearCanvas(rc);
      renderBoard(rc, state.board);
      renderPets(rc, state.pets);
      renderDeployPreview(rc, ui);
      renderHUD(state);
    }
    const loop = new GameLoop(state, render);
    loop.start();

    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('home');
    };
    window.addEventListener('keydown', onKey);
    // Note: loop doesn't currently expose a stop. For v1 we accept that pressing Escape leaves the loop running until phase=ended; in practice it's harmless because the screen is unmounted. Track for cleanup.
    return () => window.removeEventListener('keydown', onKey);
  },
};
```

Important caveat: the existing sandbox UI (`src/ui/sandbox-ui.ts`) wires up its own DOM. We need to make sure it mounts into the new `sandbox-screen` container, not into `document.body`. **Step 5** patches this.

- [ ] **Step 5: Make sandbox-ui scoped to its container**

Currently `src/ui/sandbox-ui.ts` reaches for `document.body` and adds siblings to the canvas. Refactor it to accept a parent container so the sandbox screen can pass `root`:

In `src/ui/sandbox-ui.ts`, change `mountSandboxUI` (or its equivalent) to accept a `parent: HTMLElement` argument and use `parent.appendChild` instead of `document.body.appendChild`. Update any `document.getElementById(...)` calls that grab the canvas / sidebar to use `parent.querySelector(...)` instead.

This is mechanical but touches several lines — search for `document.body` and `document.getElementById` in `src/ui/sandbox-ui.ts` and rewire.

- [ ] **Step 6: Rewrite src/main.ts**

```typescript
import { startRouter, registerScreen } from './app/router';
import { HomeScreen } from './app/screens/home';
import { SandboxScreen } from './app/screens/sandbox';

registerScreen(HomeScreen);
registerScreen(SandboxScreen);

const root = document.getElementById('screen-root') as HTMLElement;
startRouter(root, screenFromUrl());

function screenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen');
  if (screen === 'sandbox') return 'sandbox';
  return 'home';
}
```

- [ ] **Step 7: Add home-screen CSS**

Append to `src/styles.css`:
```css
.home-screen {
  max-width: 480px;
  margin: 80px auto;
  text-align: center;
  color: var(--text, #eee);
}
.home-screen h1 { font-size: 48px; margin-bottom: 8px; }
.home-tagline { color: var(--text-dim, #aaa); margin-bottom: 32px; }
.home-buttons { display: flex; flex-direction: column; gap: 12px; }
.big-btn {
  padding: 16px 24px;
  background: var(--btn-bg, #2a2a2a);
  color: var(--text, #eee);
  border: 1px solid var(--border, #444);
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  text-align: left;
}
.big-btn:hover { background: var(--btn-bg-hover, #3a3a3a); }
.big-btn .btn-sub { color: var(--text-dim, #888); font-size: 13px; display: block; margin-top: 4px; }
.sandbox-screen { position: relative; }
.back-btn {
  position: fixed; top: 12px; left: 12px;
  background: rgba(0,0,0,0.4); color: #ddd; border: 1px solid #555;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;
}
```

- [ ] **Step 8: Build and verify**

```bash
npm run build
npm test
npx tsc --noEmit
```
Expected: All pass. The sandbox screen runs inside the router. Pressing Escape returns to home.

- [ ] **Step 9: Commit**

```bash
git add src/app/ src/main.ts src/ui/sandbox-ui.ts src/styles.css index.html
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 2: screen router + home menu + sandbox-as-screen"
```

---

## Task 3: Supabase client + env scaffolding

**Files:**
- Create: `src/config/env.ts`
- Create: `src/online/supabase.ts`
- Modify: `.env.example`
- Modify: `package.json` (add @supabase/supabase-js)

Sets up the Supabase client. Works without a live project (env vars empty → client throws clear error on first use).

- [ ] **Step 1: Install dependency**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create .env.example**

```
# Copy to .env.local and fill in from your Supabase project.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ey...your-anon-key
```

- [ ] **Step 3: Create src/config/env.ts**

```typescript
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
```

- [ ] **Step 4: Create src/online/supabase.ts**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../config/env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
```

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts src/online/ .env.example package.json package-lock.json
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 3: Supabase client scaffolding"
```

---

## Task 4: Auth module (Google sign-in)

**Files:**
- Create: `src/online/auth.ts`
- Create: `src/app/screens/sign-in.ts`
- Modify: `src/main.ts` (register sign-in screen)

- [ ] **Step 1: Create src/online/auth.ts**

```typescript
import { getSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/?screen=lobby' },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

export async function ensureProfile(): Promise<Profile> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('not signed in');
  // upsert: insert profile if not exists, else read.
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email!, display_name: user.user_metadata?.full_name ?? null }, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, is_admin')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const supabase = getSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
```

- [ ] **Step 2: Create src/app/screens/sign-in.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { signInWithGoogle, getCurrentUser } from '../../online/auth';
import { isSupabaseConfigured } from '../../config/env';

export const SignInScreen: Screen = {
  name: 'sign-in',
  mount(root) {
    if (!isSupabaseConfigured()) {
      root.innerHTML = `
        <div class="sign-in-screen">
          <h2>Online play unavailable</h2>
          <p>Supabase is not configured. The host of this site needs to set up the backend.</p>
          <button class="big-btn" id="btn-home">Back to home</button>
        </div>
      `;
      root.querySelector('#btn-home')!.addEventListener('click', () => navigate('home'));
      return;
    }
    // Already signed in → skip straight to lobby.
    getCurrentUser().then((user) => {
      if (user) navigate('lobby');
    });
    root.innerHTML = `
      <div class="sign-in-screen">
        <h2>Sign in to play online</h2>
        <p>You need a Google account to create or join rooms.</p>
        <button class="big-btn google-btn" id="btn-google">
          <span class="g-icon">G</span> Sign in with Google
        </button>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    root.querySelector('#btn-google')!.addEventListener('click', () => signInWithGoogle());
    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
  },
};
```

- [ ] **Step 3: Add CSS**

Append to `src/styles.css`:
```css
.sign-in-screen { max-width: 420px; margin: 100px auto; text-align: center; color: var(--text, #eee); }
.sign-in-screen h2 { font-size: 24px; margin-bottom: 12px; }
.sign-in-screen p { color: var(--text-dim, #aaa); margin-bottom: 24px; }
.google-btn { display: flex; align-items: center; justify-content: center; gap: 10px; }
.g-icon {
  background: #fff; color: #444; width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; font-weight: bold;
}
```

- [ ] **Step 4: Register screen in main.ts**

Add to `src/main.ts`:
```typescript
import { SignInScreen } from './app/screens/sign-in';
registerScreen(SignInScreen);
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add src/online/auth.ts src/app/screens/sign-in.ts src/main.ts src/styles.css
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 4: Google sign-in flow"
```

---

## Task 5: Rooms module + lobby screen

**Files:**
- Create: `src/online/rooms.ts`
- Create: `src/app/screens/lobby.ts`

- [ ] **Step 1: Create src/online/rooms.ts**

```typescript
import { getSupabase } from './supabase';
import { ensureProfile } from './auth';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'playing' | 'ended' | 'abandoned';
  current_round: number;
  created_at: string;
  last_activity_at: string;
}

export async function createRoom(password: string | null): Promise<Room> {
  await ensureProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_room', { password_plain: password || null });
  if (error) throw new Error(humanizeRpcError(error.message));
  const row = (data as Array<{ id: string; code: string }>)[0];
  const { data: roomRow } = await supabase.from('rooms').select('*').eq('id', row.id).single();
  return roomRow as Room;
}

export async function joinRoom(code: string, password: string | null): Promise<Room> {
  await ensureProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('join_room', {
    room_code: code.toUpperCase(),
    password_plain: password || null,
  });
  if (error) throw new Error(humanizeRpcError(error.message));
  const { data: roomRow, error: readErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', data as string)
    .single();
  if (readErr) throw readErr;
  return roomRow as Room;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  // Soft-leave: mark room as abandoned if host leaves and game hasn't started; if guest leaves, just clear guest_id.
  const { data: room } = await supabase.from('rooms').select('host_id, guest_id, status').eq('id', roomId).single();
  if (!room) return;
  const profile = await ensureProfile();
  if (room.host_id === profile.id && room.status === 'waiting') {
    await supabase.from('rooms').update({ status: 'abandoned' }).eq('id', roomId);
  } else if (room.guest_id === profile.id) {
    await supabase.from('rooms').update({ guest_id: null }).eq('id', roomId);
  } else {
    await supabase.from('rooms').update({ status: 'abandoned' }).eq('id', roomId);
  }
}

export async function listAdminRooms(): Promise<Room[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function adminDeleteRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) throw error;
}

function humanizeRpcError(msg: string): string {
  if (msg.includes('room cap reached')) return 'The server is full right now — try again later.';
  if (msg.includes('rate limit exceeded')) return 'Slow down — you can only create 3 rooms per minute.';
  if (msg.includes('no such room')) return "That room code doesn't exist.";
  if (msg.includes('room not joinable')) return 'That room is no longer accepting players.';
  if (msg.includes('cannot join your own room')) return 'You can\'t join a room you created.';
  if (msg.includes('room full')) return 'That room is full.';
  if (msg.includes('wrong password')) return 'Wrong password.';
  return msg;
}
```

- [ ] **Step 2: Create src/app/screens/lobby.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { createRoom, joinRoom, listAdminRooms, adminDeleteRoom } from '../../online/rooms';
import { ensureProfile, signOut } from '../../online/auth';

export const LobbyScreen: Screen = {
  name: 'lobby',
  mount(root) {
    let isAdmin = false;
    root.innerHTML = `
      <div class="lobby-screen">
        <div class="lobby-header">
          <span id="lobby-user"></span>
          <button class="link-btn" id="btn-signout">Sign out</button>
        </div>
        <h2>Online Play</h2>
        <div class="lobby-actions">
          <div class="action-card">
            <h3>Create Room</h3>
            <input type="password" id="create-pw" placeholder="Optional password" />
            <button class="big-btn" id="btn-create">Create</button>
          </div>
          <div class="action-card">
            <h3>Join Room</h3>
            <input type="text" id="join-code" placeholder="6-letter code" maxlength="6" />
            <input type="password" id="join-pw" placeholder="Password (if required)" />
            <button class="big-btn" id="btn-join">Join</button>
          </div>
        </div>
        <div id="admin-panel" style="display: none;">
          <h3>Admin: active rooms</h3>
          <ul id="admin-rooms"></ul>
        </div>
        <div id="lobby-err" class="lobby-err"></div>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    const errEl = root.querySelector('#lobby-err') as HTMLDivElement;
    function showErr(msg: string) { errEl.textContent = msg; }

    ensureProfile().then((profile) => {
      isAdmin = profile.is_admin;
      (root.querySelector('#lobby-user') as HTMLElement).textContent =
        `Signed in as ${profile.display_name || profile.email}${isAdmin ? ' (admin)' : ''}`;
      if (isAdmin) {
        (root.querySelector('#admin-panel') as HTMLElement).style.display = 'block';
        refreshAdminRooms();
      }
    }).catch(() => navigate('sign-in'));

    root.querySelector('#btn-create')!.addEventListener('click', async () => {
      showErr('');
      try {
        const pw = (root.querySelector('#create-pw') as HTMLInputElement).value;
        const room = await createRoom(pw || null);
        navigate('room-waiting', { room: room.id });
      } catch (e) { showErr((e as Error).message); }
    });

    root.querySelector('#btn-join')!.addEventListener('click', async () => {
      showErr('');
      try {
        const code = (root.querySelector('#join-code') as HTMLInputElement).value;
        const pw = (root.querySelector('#join-pw') as HTMLInputElement).value;
        const room = await joinRoom(code, pw || null);
        navigate('online-match', { room: room.id });
      } catch (e) { showErr((e as Error).message); }
    });

    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
    root.querySelector('#btn-signout')!.addEventListener('click', async () => {
      await signOut();
      navigate('home');
    });

    async function refreshAdminRooms() {
      try {
        const rooms = await listAdminRooms();
        const ul = root.querySelector('#admin-rooms') as HTMLUListElement;
        ul.innerHTML = '';
        for (const r of rooms) {
          const li = document.createElement('li');
          li.innerHTML = `<code>${r.code}</code> · ${r.status} · created ${new Date(r.created_at).toLocaleTimeString()} <button data-id="${r.id}" class="link-btn">Delete</button>`;
          ul.appendChild(li);
        }
        ul.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this room?')) return;
            await adminDeleteRoom(btn.dataset.id!);
            refreshAdminRooms();
          });
        });
      } catch (e) {
        showErr('Failed to list rooms: ' + (e as Error).message);
      }
    }
  },
};
```

- [ ] **Step 3: Add CSS**

```css
.lobby-screen { max-width: 720px; margin: 60px auto; color: var(--text, #eee); padding: 0 20px; }
.lobby-header { display: flex; justify-content: space-between; margin-bottom: 24px; color: var(--text-dim, #aaa); font-size: 14px; }
.lobby-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.action-card { background: var(--card-bg, #2a2a2a); padding: 20px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
.action-card input { padding: 8px; background: #1a1a1a; color: #eee; border: 1px solid #444; border-radius: 4px; font-family: inherit; }
.action-card h3 { margin-top: 0; }
.lobby-err { color: #f88; margin-top: 16px; min-height: 20px; }
.link-btn { background: none; border: none; color: #9bf; cursor: pointer; text-decoration: underline; padding: 0; font-size: inherit; }
#admin-panel { margin-top: 32px; padding: 16px; border: 1px dashed #555; border-radius: 6px; }
#admin-rooms { list-style: none; padding: 0; }
#admin-rooms li { padding: 6px 0; border-bottom: 1px solid #333; }
#admin-rooms code { background: #1a1a1a; padding: 2px 6px; border-radius: 3px; }
```

- [ ] **Step 4: Register and commit**

Add `registerScreen(LobbyScreen)` to `main.ts`. Build, then commit.

```bash
git add src/online/rooms.ts src/app/screens/lobby.ts src/main.ts src/styles.css
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 5: lobby screen with create/join/admin"
```

---

## Task 6: Room waiting screen

**Files:**
- Create: `src/app/screens/room-waiting.ts`
- Modify: `src/online/rooms.ts` (add subscribeToRoom)

The host sees their code; both wait until two players are present, then auto-navigate to online-match.

- [ ] **Step 1: Add subscribeToRoom to src/online/rooms.ts**

```typescript
import { RealtimeChannel } from '@supabase/supabase-js';

export function subscribeToRoom(roomId: string, onChange: (room: Room) => void): () => void {
  const supabase = getSupabase();
  const channel: RealtimeChannel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => onChange(payload.new as Room))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return data as Room | null;
}
```

- [ ] **Step 2: Create src/app/screens/room-waiting.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { getRoom, leaveRoom, subscribeToRoom, type Room } from '../../online/rooms';

export const RoomWaitingScreen: Screen = {
  name: 'room-waiting',
  mount(root, params) {
    const roomId = params?.room;
    if (!roomId) { navigate('lobby'); return; }

    root.innerHTML = `
      <div class="room-waiting-screen">
        <h2>Waiting for opponent…</h2>
        <p class="room-code-label">Share this code:</p>
        <div class="room-code" id="room-code">------</div>
        <button class="link-btn" id="btn-copy">Copy invite link</button>
        <p id="copy-feedback" class="copy-feedback"></p>
        <button class="big-btn" id="btn-leave">Leave room</button>
      </div>
    `;

    let unmounted = false;
    let unsub: (() => void) | null = null;

    getRoom(roomId).then((room) => {
      if (!room || unmounted) return;
      (root.querySelector('#room-code') as HTMLElement).textContent = room.code;
      if (room.guest_id) navigate('online-match', { room: roomId });
      unsub = subscribeToRoom(roomId, (r: Room) => {
        if (r.guest_id) navigate('online-match', { room: roomId });
      });
    });

    root.querySelector('#btn-copy')!.addEventListener('click', async () => {
      const code = (root.querySelector('#room-code') as HTMLElement).textContent;
      const url = `${window.location.origin}/?room=${code}`;
      await navigator.clipboard.writeText(url);
      (root.querySelector('#copy-feedback') as HTMLElement).textContent = 'Copied!';
      setTimeout(() => {
        const fb = root.querySelector('#copy-feedback') as HTMLElement | null;
        if (fb) fb.textContent = '';
      }, 1500);
    });

    root.querySelector('#btn-leave')!.addEventListener('click', async () => {
      await leaveRoom(roomId);
      navigate('lobby');
    });

    return () => {
      unmounted = true;
      if (unsub) unsub();
    };
  },
};
```

- [ ] **Step 3: CSS**

```css
.room-waiting-screen { max-width: 480px; margin: 120px auto; text-align: center; color: var(--text, #eee); }
.room-code-label { color: var(--text-dim, #aaa); margin-top: 24px; }
.room-code { font-size: 56px; font-family: monospace; letter-spacing: 8px; margin: 8px 0 16px; }
.copy-feedback { color: #6f6; height: 16px; margin: 8px 0; }
```

- [ ] **Step 4: Register, build, commit**

```bash
git add src/app/screens/room-waiting.ts src/online/rooms.ts src/main.ts src/styles.css
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 6: room-waiting screen with realtime opponent-join"
```

---

## Task 7: Submissions module

**Files:**
- Create: `src/online/submissions.ts`
- Create: `tests/online/submissions.test.ts` (mocking supabase client for unit tests)

This is the data layer for round submissions. We mock the supabase client so we can unit-test without a live backend.

- [ ] **Step 1: Create src/online/submissions.ts**

```typescript
import { getSupabase } from './supabase';
import type { Direction, Vec2 } from '../types/game';

export interface DeploymentDTO {
  defId: string;
  anchor: Vec2;
  facing: Direction;
}

export interface RoundSubmission {
  id: string;
  room_id: string;
  round: number;
  player_slot: 'A' | 'B';
  user_id: string;
  deployments: DeploymentDTO[];
  submitted_at: string;
}

export async function submitRound(
  roomId: string,
  round: number,
  slot: 'A' | 'B',
  deployments: DeploymentDTO[],
): Promise<void> {
  const supabase = getSupabase();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('not signed in');
  const { error } = await supabase.from('round_submissions').insert({
    room_id: roomId,
    round,
    player_slot: slot,
    user_id: userId,
    deployments,
  });
  if (error) throw error;
}

export async function fetchSubmissions(roomId: string, round: number): Promise<RoundSubmission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('round_submissions')
    .select('*')
    .eq('room_id', roomId)
    .eq('round', round);
  if (error) throw error;
  return (data ?? []) as RoundSubmission[];
}

export function subscribeToSubmissions(
  roomId: string,
  onInsert: (sub: RoundSubmission) => void,
): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`subs:${roomId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'round_submissions', filter: `room_id=eq.${roomId}` },
      (payload) => onInsert(payload.new as RoundSubmission))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
```

- [ ] **Step 2: Build verify**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/online/submissions.ts
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 7: round submissions module"
```

---

## Task 8: Online match controller

**Files:**
- Create: `src/online/online-match.ts`

The controller wires together: receive submissions, when both arrive run execution, advance round counter on completion. It depends on changes to the sandbox's planning/execution flow — specifically, the local "submitReady" needs to be intercepted in online mode.

- [ ] **Step 1: Create src/online/online-match.ts**

```typescript
import type { MatchState, PlayerId } from '../types/game';
import { createRng, hashSeed } from '../sim/rng';
import { tryDeploy } from '../sim/deploy';
import { submitReady as localSubmitReady } from '../sim/match';
import {
  submitRound,
  fetchSubmissions,
  subscribeToSubmissions,
  type DeploymentDTO,
  type RoundSubmission,
} from './submissions';
import { getSupabase } from './supabase';

export class OnlineMatchController {
  private unsubSubmissions: (() => void) | null = null;
  private pendingDeployments: DeploymentDTO[] = [];
  private readyForCurrentRound = false;
  private opponentReady = false;

  constructor(
    private roomId: string,
    private mySlot: PlayerId,
    private state: MatchState,
  ) {
    // Seed the sim's RNG deterministically per round.
    this.reseedRng();
  }

  attach(): void {
    this.unsubSubmissions = subscribeToSubmissions(this.roomId, (sub) => {
      if (sub.round !== this.state.round) return;
      if (sub.player_slot !== this.mySlot) this.opponentReady = true;
      this.maybeStartRound();
    });
    // Catch up on submissions we may have missed before subscribe registered.
    this.maybeStartRound();
  }

  detach(): void {
    if (this.unsubSubmissions) this.unsubSubmissions();
  }

  // Player added a deployment locally. Track it for submission, but don't add to state.pets yet —
  // pets only enter the board when both submissions are merged at execution-start.
  queueLocalDeployment(d: DeploymentDTO): boolean {
    if (this.readyForCurrentRound) return false;
    this.pendingDeployments.push(d);
    return true;
  }

  cancelLastLocalDeployment(): void {
    this.pendingDeployments.pop();
  }

  async submitMyReady(): Promise<void> {
    if (this.readyForCurrentRound) return;
    await submitRound(this.roomId, this.state.round, this.mySlot, this.pendingDeployments);
    this.readyForCurrentRound = true;
    this.maybeStartRound();
  }

  private async maybeStartRound(): Promise<void> {
    if (this.state.phase !== 'planning') return;
    const subs = await fetchSubmissions(this.roomId, this.state.round);
    if (subs.length < 2) return;
    // Apply both players' deployments to the local state.
    for (const sub of subs.sort((a, b) => a.player_slot.localeCompare(b.player_slot))) {
      for (const d of sub.deployments) {
        tryDeploy(this.state, sub.player_slot, d.defId, d.anchor, d.facing);
      }
    }
    // Reseed RNG for this round.
    this.reseedRng();
    // Trigger local execution-phase transition.
    localSubmitReady(this.state, 'A');
    localSubmitReady(this.state, 'B');
    // Reset for next round.
    this.pendingDeployments = [];
    this.readyForCurrentRound = false;
    this.opponentReady = false;
  }

  // Called by the loop when the local execution phase ends.
  async onExecutionEnd(): Promise<void> {
    this.state.round += 1;
    this.reseedRng();
    // Update server room.current_round so reconnects can sync.
    const supabase = getSupabase();
    await supabase.from('rooms').update({
      current_round: this.state.round,
      last_activity_at: new Date().toISOString(),
    }).eq('id', this.roomId);
  }

  private reseedRng(): void {
    this.state.rng = createRng(hashSeed(this.roomId, this.state.round));
  }
}
```

- [ ] **Step 2: Add `round: number` to MatchState if not already present**

Check `src/types/game.ts`. If it doesn't have `round`, add `round: number;` to MatchState and initialize to 0 in `createInitialMatch`.

- [ ] **Step 3: Build verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/online/online-match.ts src/types/game.ts src/sim/match.ts
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 8: OnlineMatchController for lockstep round merging"
```

---

## Task 9: Online match screen

**Files:**
- Create: `src/app/screens/online-match.ts`

Reuses the sandbox canvas + render, but the deploy UI's Ready button calls `OnlineMatchController.submitMyReady()` instead of `localSubmitReady`. The deploy UI also intercepts deployments and queues them locally rather than committing.

- [ ] **Step 1: Refactor deploy-ui.ts to accept an optional "queue" callback**

In `src/input/deploy-ui.ts`, add an optional callback signature:

```typescript
export interface DeployUIBindings {
  onDeploy?: (defId: string, anchor: Vec2, facing: Direction) => void;
  onReady?: () => void;
}

export function attachDeployUI(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  state: MatchState,
  ui: DeployUIState,
  bindings?: DeployUIBindings,  // new
): void {
  // ...existing handlers, but on click:
  //   if (bindings?.onDeploy) bindings.onDeploy(ui.selectedDefId, ui.hoverTile, ui.facing);
  //   else tryDeploy(...)
  // on Space/Enter:
  //   if (bindings?.onReady) bindings.onReady();
  //   else submitReady(state, state.activePlanningPlayer);
}
```

This keeps sandbox behavior unchanged (no bindings = old behavior) and lets online-match pass its own handlers.

- [ ] **Step 2: Create src/app/screens/online-match.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { createInitialMatch } from '../../sim/match';
import { createRenderContext, clearCanvas } from '../../render/canvas';
import { renderBoard } from '../../render/board';
import { renderPets } from '../../render/pets';
import { renderHUD } from '../../render/ui';
import { createDeployUIState, attachDeployUI, renderDeployPreview } from '../../input/deploy-ui';
import { GameLoop } from '../../loop';
import { OnlineMatchController } from '../../online/online-match';
import { getRoom } from '../../online/rooms';
import { ensureProfile } from '../../online/auth';

export const OnlineMatchScreen: Screen = {
  name: 'online-match',
  mount(root, params) {
    const roomId = params?.room;
    if (!roomId) { navigate('lobby'); return; }

    root.innerHTML = `
      <div class="online-match-screen">
        <div id="ui"></div>
        <canvas id="game" width="600" height="600"></canvas>
        <button class="back-btn" id="btn-back">← Lobby</button>
      </div>
    `;

    const canvas = root.querySelector('#game') as HTMLCanvasElement;
    const rc = createRenderContext(canvas);
    const state = createInitialMatch();
    const ui = createDeployUIState();

    let controller: OnlineMatchController | null = null;

    Promise.all([getRoom(roomId), ensureProfile()]).then(([room, profile]) => {
      if (!room) { navigate('lobby'); return; }
      const mySlot: 'A' | 'B' = room.host_id === profile.id ? 'A' : 'B';
      state.round = room.current_round;
      controller = new OnlineMatchController(roomId, mySlot, state);
      controller.attach();

      attachDeployUI(canvas, rc, state, ui, {
        onDeploy: (defId, anchor, facing) => controller!.queueLocalDeployment({ defId, anchor, facing }),
        onReady: () => controller!.submitMyReady().catch((e) => console.error(e)),
      });
    });

    function render() {
      clearCanvas(rc);
      renderBoard(rc, state.board);
      renderPets(rc, state.pets);
      renderDeployPreview(rc, ui);
      renderHUD(state);
    }

    const loop = new GameLoop(state, render, {
      onExecutionEnd: () => { if (controller) controller.onExecutionEnd(); },
    });
    loop.start();

    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('lobby'));

    return () => {
      if (controller) controller.detach();
    };
  },
};
```

Note this requires GameLoop to accept an `onExecutionEnd` callback. If it doesn't, extend it: in `src/loop.ts`, add an optional `bindings?: { onExecutionEnd?: () => void }` constructor arg, and call it after `endExecution(this.state)`.

- [ ] **Step 3: Build verify**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/screens/online-match.ts src/input/deploy-ui.ts src/loop.ts src/main.ts
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 9: online match screen with controller-bound deploy UI"
```

---

## Task 10: Deep-link handling for ?room=XYZ

**Files:**
- Modify: `src/main.ts`
- Modify: `src/app/screens/lobby.ts` (auto-fill code from URL)

If the page is opened with `?room=XYZ`, the user lands on home, but lobby pre-fills the join form with the code. If they're not signed in, sign-in redirects them back to `?screen=lobby&room=XYZ`.

- [ ] **Step 1: Modify main.ts to honor ?room=**

```typescript
function screenFromUrl(): ScreenName {
  const params = new URLSearchParams(window.location.search);
  if (params.get('room')) return 'lobby';  // route through lobby for join flow
  const screen = params.get('screen') as ScreenName | null;
  return screen ?? 'home';
}
```

- [ ] **Step 2: Modify lobby.ts to auto-fill code**

At the top of `mount`, read `params?.room` and set the `#join-code` value if present. Also focus the password field.

```typescript
const urlParams = new URLSearchParams(window.location.search);
const prefilledCode = urlParams.get('room');
if (prefilledCode) {
  (root.querySelector('#join-code') as HTMLInputElement).value = prefilledCode;
  (root.querySelector('#join-pw') as HTMLInputElement).focus();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main.ts src/app/screens/lobby.ts
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 10: ?room= deep-link prefills join form"
```

---

## Task 11: Settings screen

**Files:**
- Create: `src/app/screens/settings.ts`

Simple screen reusing existing palette toggle / reduced motion / sign-out.

- [ ] **Step 1: Create src/app/screens/settings.ts**

```typescript
import type { Screen } from '../router';
import { navigate } from '../router';
import { applyPalette, getCurrentPalette, type PaletteName } from '../../render/palette';
import { getCurrentUser, signOut } from '../../online/auth';
import { isSupabaseConfigured } from '../../config/env';

export const SettingsScreen: Screen = {
  name: 'settings',
  mount(root) {
    const currentPalette = getCurrentPalette();
    root.innerHTML = `
      <div class="settings-screen">
        <h2>Settings</h2>
        <label>
          Color palette
          <select id="palette-select">
            <option value="default" ${currentPalette === 'default' ? 'selected' : ''}>Default (red/blue)</option>
            <option value="cb-blue-orange" ${currentPalette === 'cb-blue-orange' ? 'selected' : ''}>Colorblind (blue/orange)</option>
          </select>
        </label>
        <div id="auth-section"></div>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    root.querySelector('#palette-select')!.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value as PaletteName;
      applyPalette(v);
    });
    if (isSupabaseConfigured()) {
      getCurrentUser().then((user) => {
        const sec = root.querySelector('#auth-section') as HTMLElement;
        if (user) {
          sec.innerHTML = `<p>Signed in as ${user.email}</p><button class="big-btn" id="btn-signout">Sign out</button>`;
          sec.querySelector('#btn-signout')!.addEventListener('click', async () => {
            await signOut();
            navigate('home');
          });
        }
      });
    }
    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
  },
};
```

- [ ] **Step 2: Register, CSS, commit**

```css
.settings-screen { max-width: 420px; margin: 80px auto; color: var(--text, #eee); }
.settings-screen label { display: flex; flex-direction: column; gap: 6px; margin: 16px 0; }
.settings-screen select { padding: 8px; background: #1a1a1a; color: #eee; border: 1px solid #444; border-radius: 4px; }
```

```bash
git add src/app/screens/settings.ts src/main.ts src/styles.css
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 11: settings screen"
```

---

## Task 12: End-to-end manual test plan

**Files:**
- Modify: `README.md` (online play section)

No code change. Just a checklist to run against a real Supabase project after the hand-off.

- [ ] **Step 1: Append to README.md**

```markdown
## Online play

Online play requires a Supabase project. See `docs/superpowers/handoff/supabase-setup.md` (Task 14 of the multiplayer plan).

### Manual test checklist (run after Supabase setup)

1. Open `/` → Home menu shows. Press 1 → Sandbox loads as before. Esc → back to home.
2. Press 2 → Sign-in screen (if not signed in). Click Google → redirects → returns signed in → lobby.
3. In lobby, click Create Room without a password → room-waiting shows a 6-char code.
4. In another browser (or incognito), sign in as a different account, paste code in Join Room, no password → both clients navigate to online-match.
5. Each client deploys 1 Mouse and presses Ready. Both see their own pets locally during planning. When both ready, execution phase starts on both clients with both players' pets visible.
6. Play to a win. Win overlay appears with Back to Lobby button.
7. As admin (signed in as tctctc888@gmail.com), see Admin Panel in lobby with list of active rooms. Click Delete on one. Refresh — gone.
8. Test password: create room with password "test123". Other client tries to join with wrong password → error message. Try right password → joins.
9. Test capacity: have 3 different accounts each try to create rooms in quick succession; first 3 succeed, 4th hits rate limit error.
10. Test deep link: copy invite link, open in browser without auth → routes to sign-in → after sign-in returns to lobby with code pre-filled.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git -c user.email=tctctc888@gmail.com -c user.name="Timothy Cao" commit -m "online task 12: manual test checklist"
```

---

## Task 13: Final code-level cleanup

- [ ] **Step 1: Run full verification**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: All passing, build clean.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Mark online-play multiplayer code complete**

The code is now end-to-end ready. What remains is *external setup* (Tasks 14-16) which the user does.

---

## Task 14: Hand-off — Supabase project creation

(User does this; no code changes.)

The user creates a Supabase project, enables the Google OAuth provider, and copies the project URL and anon key into `.env.local`.

Generate a `docs/superpowers/handoff/supabase-setup.md` with the exact steps.

---

## Task 15: Hand-off — SQL migrations

(User runs these; no code changes.)

Generate a `docs/superpowers/handoff/supabase-schema.sql` file containing all the SQL from §5 of the design spec, ready to paste into Supabase SQL editor.

---

## Task 16: Hand-off — Google OAuth client

(User configures this; no code changes.)

Steps for creating a Google OAuth client in Google Cloud Console, adding the Supabase callback URL, and pasting credentials into Supabase.

---

## Recap

Tasks 1-13 are code changes that compile and test without a live backend (they'll throw clear errors at runtime if `VITE_SUPABASE_URL` is missing). Tasks 14-16 are the user's setup steps. After both halves are done, online play works end-to-end.
