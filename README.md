# Pet Painters

> Tactical territory painter for two players. Deploy your animals, hit go, watch your color spread. First to claim 60% of the board wins.

**Status: alpha-ready as of 2026-05-22. Awaiting Supabase setup + playtest.**

Two players. 20×20 grid. Three pets each. Six rounds. Online and sandbox modes.

---

## Quick start (local dev)

```bash
npm install
npm run dev       # http://localhost:5173 — sandbox works immediately
npm test          # 89 tests, ~300ms
npm run build     # production bundle → dist/
```

No credentials needed for sandbox mode. Online play requires Supabase — see [docs/superpowers/handoff/supabase-setup.md](./docs/superpowers/handoff/supabase-setup.md).

---

## Modes of play

### Sandbox (offline, always works)

Both sides are controlled from the same screen. Great for playtesting and learning the pet roster. Select a pet from the left panel, click a tile in your zone to deploy, hit **▶ Start Round**. When the match ends, click **▶ New Match** to reset.

No account required. No server. Runs entirely in the browser.

### Online (requires Supabase)

Sign in with Google → create or join a room → each player deploys their pets privately (fog of war hides the opponent's army) → both players press Ready → the round executes live on both screens simultaneously → repeat for up to 6 rounds.

Share the room code or invite link directly. Rooms support a password option.

---

## The pets (13 total)

| | Pet | Role | Signature trait |
|--|--|--|--|
| 🐭 | Mouse | Fast painter | Scurries — turns randomly when blocked |
| 🐱 | Cat | Wide-area painter | Wanders unpredictably; +2 damage vs Mouse |
| 🐰 | Rabbit | Penetrator | Hops over single-pet blockers; bigger jump = bigger paint splash |
| 🐢 | Turtle | Area expander | Enters shell mode when threatened; slow but sturdy |
| 🦨 | Skunk | Disruptor | Force field pushes and freezes adjacent enemies |
| 🦅 | Eagle | Precision striker | Flies 2 tiles per move; +2× damage vs small (1×1) pets |
| 🐻 | Bear | Brawler | Gets faster when wounded; hits berserk mode when surrounded |
| 🦁 | Lion | Ambush predator | Stalks, then sprints; rages when cornered |
| 🐉 | Dragon | Zone controller | Breathes fire forward; 2×2 body |
| 🐳 | Whale | Slow bruiser | 3×3 body drifts forward; blowhole fires a 3×3 paint splash at a random tile |
| 🦏 | Rhino | Charger | Builds charging momentum — faster with each uninterrupted move |
| 🕷️ | Spider | Niche disruptor | Radiant paint burst + webs enemies in place |
| 🐘 | Elephant | Territory anchor | Stomps small enemies; 2×2 body; immune to being pushed |

Hover any card in-app for full stats (HP, ATK, speed, weight, ability text).

---

## Controls

- **Click a pet card** (or press **1–9, 0**) to select
- **Click your own tile** to deploy
- **R** or **right-click** rotates the facing direction before deploying
- **Space** starts the round / signals Ready (online)
- **Esc** deselects or closes inspector
- **⚙** (top-right) opens accessibility settings

Accessibility options: colorblind-safe palette (swaps red → orange for deuteranopia/protanopia) and sound effects toggle (synthesized, no audio files).

---

## Features

- **Fog of war** — in online mode, you can only see tiles and pets visible from your own territory
- **3-2-1 countdown** — canvas overlay before each execution phase
- **SFX** — synthesized Web Audio: deploy thud, round start, countdown ticks, win fanfare
- **Round summary** — per-round tile delta, momentum arrow, pets lost
- **Colorblind palette** — accessible toggle in settings
- **Tactical sidebar** — live event log, exec tick counter, deployed pet count

---

## Project layout

- `src/sim/` — pure simulation: board, movement, combat, behaviors
- `src/sim/pets/<name>.ts` — one file per pet; stats + behavior + UI metadata co-located
- `src/sim/behaviors.ts` — reusable trigger + action primitives
- `src/render/` — canvas drawing, effects, interpolation, palette, sfx
- `src/ui/` — DOM HUD, event log, win overlay
- `src/input/` — mouse + keyboard deploy handlers
- `src/app/screens/` — router screens: home, sandbox, sign-in, lobby, room-waiting, online-match
- `src/online/` — Supabase client, auth, rooms, submissions
- `tests/` — 89 unit + scenario tests

Deeper docs:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — dataflow, layering rules, how a tick happens
- [`ROADMAP.md`](./ROADMAP.md) — phased plan, north star, intentional non-goals
- [`.claude/skills/pet-designer/SKILL.md`](./.claude/skills/pet-designer/SKILL.md) — design philosophy + checklist for adding new pets
- [`docs/superpowers/handoff/supabase-setup.md`](./docs/superpowers/handoff/supabase-setup.md) — Supabase project setup, SQL schema, env vars

---

## Deploying

### Vercel (recommended)

Push to GitHub → connect in Vercel dashboard → deploy. `vercel.json` at repo root handles SPA routing and build config. Set the following environment variables in the Vercel project settings:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Without these vars, online play shows an "unavailable" message and sandbox continues to work.

### Local build

```bash
npm run build   # outputs to dist/
```

Serve `dist/` from any static host.
