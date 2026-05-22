# Pet Painters — Handoff

**Last updated:** 2026-05-22
**Status:** alpha-ready. Code complete. Awaiting Supabase setup + playtest.
**Latest commit:** `e56f410` on `main`.

---

## TL;DR

The game is done from a code perspective. Sandbox mode works locally with `npm run dev`. Online play is implemented but inert until you do the Supabase setup. **5 manual steps will turn it on.** They're in [`docs/superpowers/handoff/supabase-setup.md`](docs/superpowers/handoff/supabase-setup.md).

89 tests pass. Build is clean. Roster is balanced (12 of 13 pets in real meta presence; Spider is intentionally niche at 0%).

---

## What ships in the alpha

### Game
- **20×20 board** with 5×5 corner home zones (player A bottom-left, B top-right)
- **13 pets**, each with a distinct identity (see README pet table)
- **6-round matches**, 60-second execution phases, paint to 60% wins
- **Fog of war** in online mode (Chebyshev 2 expansion of painted territory)
- **3-2-1 countdown** at start of each execution phase
- **Synthesized SFX** (disabled by default; toggle in settings)
- **Colorblind palette** + reduced-motion respect

### Modes
- **Sandbox**: hot-seat, both players on same screen. Works immediately, no setup needed.
- **Online**: Google SSO required → create/join room with optional password → lockstep deterministic sim per round → admin can moderate rooms. Inert until Supabase configured.

### Architecture
- Pure-functional sim engine (deterministic per-seed)
- Canvas2D rendering with frame interpolation
- Vanilla TypeScript + Vite + Vitest — no framework
- Supabase for online (Postgres + Auth + Realtime)
- Coevolutionary GA for balance discovery (`npm run balance:ga`)
- Quick-sweep tool for fast pet-change iteration (`npm run balance:quick <pet>`)

---

## What you need to do when you're back online

### Critical path (~25 min)

Follow [`docs/superpowers/handoff/supabase-setup.md`](docs/superpowers/handoff/supabase-setup.md). Five phases:

1. **Create Supabase project** (~5 min)
2. **Run the SQL** in `docs/superpowers/handoff/supabase-schema.sql` via Supabase SQL Editor (~5 min)
3. **Configure Google OAuth** in Google Cloud Console + paste into Supabase Auth (~10 min)
4. **Add env vars** locally (`cp .env.example .env.local`, fill in) and in your Vercel/Netlify project (~2 min)
5. **Grant yourself admin** with a one-line SQL update after first sign-in (~1 min)

### Verify

After setup, run the manual checklist in README → "Online play" section. Two browsers (or browser + incognito) signed in as different accounts. Create room in one, join from the other, play through.

### Deploy (optional, can wait)

Push to GitHub → connect to Vercel → it auto-detects Vite. `vercel.json` is already in the repo. Add the two env vars. Deploy.

---

## Project map

```
src/
  sim/           pure functional engine (movement, combat, paint, tick)
    pets/        one file per pet — stats + behavior + UI metadata co-located
    behaviors.ts shared trigger + action primitives
  render/        canvas drawing, effects, palette, sfx, interpolation
  ui/            sandbox-ui, win-overlay, event-log, sandbox-boot
  input/         deploy-ui (keyboard + mouse handlers)
  app/screens/   home, sandbox, sign-in, lobby, room-waiting, online-match, settings
  online/        supabase client, auth, rooms, submissions, online-match controller
  config/        balance.ts (tunable), constants.ts (structural), env.ts (Supabase vars)
  loop.ts        RAF game loop (sandbox + online share this)
  main.ts        entry point — registers screens, boots router

tests/           89 unit + scenario tests
scripts/balance/ headless sim — sim.ts, runner.ts (full sweep), quick-sweep.ts, ga.ts (genetic), bench.ts

docs/
  balance-reports/  every sim run + balance-round summary (lots of these)
  superpowers/
    handoff/        supabase-setup.md, supabase-schema.sql ← your manual steps
    skills/         iterating-game-balance, designing-pets ← reusable methodology
    specs/          v1.1 design, online-multiplayer design + plan, explorations
```

---

## Useful commands

```bash
# Everyday
npm run dev                # local sandbox at http://localhost:5173
npm test                   # 89 tests, ~300ms
npm run build              # production bundle → dist/

# Balance
npm run balance            # full sweep, ~6 min, writes docs/balance-reports/report-*-60pct.md
npm run balance:quick <pet> # fast subset sweep, ~35 sec — use after a single-pet change
npm run balance:ga         # genetic algorithm, ~10-15 min, finds Nash-equilibrium comps
```

---

## Where things are if you're trying to remember

| You want to... | Look at |
|---|---|
| Add a new pet | `docs/superpowers/skills/designing-pets/SKILL.md` (process), `src/sim/pets/mouse.ts` (template), `src/sim/pets/index.ts` (register) |
| Adjust pet stats | `src/sim/pets/<name>.ts` — STATS const at top |
| Change global balance | `src/config/balance.ts` |
| Change board size or constants | `src/config/constants.ts` |
| Iterate balance | `docs/superpowers/skills/iterating-game-balance/SKILL.md` + `docs/superpowers/skills/iterating-game-balance/COMMANDS.md` |
| Supabase env vars | `.env.example` → copy to `.env.local` |
| Supabase setup steps | `docs/superpowers/handoff/supabase-setup.md` |
| Supabase SQL schema | `docs/superpowers/handoff/supabase-schema.sql` |
| Online lockstep model | `src/online/online-match.ts` + spec at `docs/superpowers/specs/2026-05-21-online-multiplayer-design.md` |
| Fog of war | `computeVisibility()` in `src/sim/board.ts`, used by `renderBoard` / `renderPets` |
| SFX | `src/render/sfx.ts` |

---

## What's NOT done (for after playtest)

These are deliberately deferred — playtest signal will tell us if they matter:

1. **"Play Again" button** in win overlay — currently you refresh to reset. Trivial to add later.
2. **Vercel deploy config** — `vercel.json` shipped, but the actual deploy is your manual step.
3. **Cost-ramp mechanic** ("+10% per copy") — explored, deferred. Doc at `docs/superpowers/specs/explorations/2026-05-22-cost-ramp.md`. Lever is identified if variety drops in playtest.
4. **Server-side fog filtering** — fog is currently client-render only. Means a determined cheater could read Realtime stream. Acceptable for alpha private rooms.
5. **Spider rework** — 0% meta presence by design. If playtest says it feels bad, see `balance:rework spider` in COMMANDS.md.
6. **Bear / Elephant heavy-pet polish** — both viable but on the edge (Bear ~14%, Elephant ~3%). They have their identities (brawl mode, stomp); whether to push them is a playtest call.
7. **Replays, spectators, ranked play** — v2 features.

---

## What I'm most uncertain about (places to look first in playtest)

1. **Bear's "brawl when surrounded" trigger** rarely fires on the 20×20 board. May feel like an unused ability in actual play.
2. **Spider's stationary identity** — works in 1-pet "denier" niche, but might feel terrible to deploy and watch sit there.
3. **Whale's random-target blowhole** — feels great when it lands well, frustrating when it paints over your already-owned tiles. Watch how players react.
4. **Skunk force-field** — might feel oppressive when stacked, or might feel underwhelming when paired with weak partners.
5. **Mouse's 56% appearance** — still the highest. Whether this is "swarm rush is fun" or "Mouse is mandatory" is a feel question.

---

## Critical context you might forget

- **The git identity for this repo is `tctctc888@gmail.com`** (your personal). Every commit has been made with `-c user.email=tctctc888@gmail.com -c user.name="Timothy Cao"` overrides. Don't change your global git config.
- **GitHub remote:** https://github.com/Timothy-Cao/pet-painters (pushed via HTTPS, no SSH key configured — your macOS keychain has the credential).
- **The board grew from 12×12 → 16×16 → 20×20** during development. All balance iterations were re-done on each geometry. Don't shrink it without re-balancing.
- **All sim work uses a seeded RNG** (`createRng(seed)` in `src/sim/rng.ts`). Same seed = same outcome. Online play seeds per (room_id, round) — deterministic across clients.
- **The pet design framework** lives at `docs/superpowers/skills/designing-pets/SKILL.md`. If you're adding new pets, fill out the Pet Pitch Template first.

---

## If something goes wrong with Supabase setup

Most-likely failure modes (and fixes) are documented in the bottom of `docs/superpowers/handoff/supabase-setup.md`:

- "redirect URI mismatch" → check Google Cloud Console authorized redirect URI matches Supabase callback URL exactly
- "must be signed in" after sign-in → RLS policy issue; re-run the schema SQL
- "room cap reached" → 20 active rooms is the cap; admin-delete some
- Realtime not firing → confirm `rooms` + `round_submissions` are in `supabase_realtime` publication

---

## Resume

When you're back, the natural next action is:

1. Read this file again.
2. Open `docs/superpowers/handoff/supabase-setup.md`.
3. Spend 25 minutes following it.
4. Open two browsers and play a match with yourself.
5. Tell me how it felt. The first playtest is the biggest signal we'll have gotten in weeks.

Good luck. Everything's where you left it.
