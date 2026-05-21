# Pet Painters

> A small tactical sandbox where each pet has unmistakable identity and every match feels juicy from start to finish.

Two players, twelve-by-twelve grid, six animals. Deploy your pets, hit go, and watch your color spread. First side to paint 75% of the board wins.

## Play locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 65 tests, ~600ms
npm run build        # production bundle
```

## The pets

| | Pet | Role | Trait |
|--|--|--|--|
| 🐭 | Mouse | Cheap quick painter | Scurries — turns randomly when blocked |
| 🐘 | Elephant | Territory lock | Unshakable — cannot be pushed, only walls turn it |
| 🐱 | Cat | Wide-area painter / mouse counter | Wanders unpredictably, pounces only on mice |
| 🐰 | Rabbit | Penetrator | Vaults over single pet blockers |
| 🐢 | Turtle | Area expander | Splashes paint onto all 4 neighbors every second |
| 🦨 | Skunk | Disruptor | Adjacent enemies are forced to face away |

Hover a card in-app for full stats. The [`pet-designer` skill](./.claude/skills/pet-designer/SKILL.md) covers adding new ones.

## Controls

- **Click a roster card** (or **1–6**) to select a pet
- **Click a tile** in your color to deploy
- **R** or **right-click** rotates the deploying pet
- **Space** starts the round
- **Esc** deselects
- The ⚙ in the top-right opens accessibility settings (colorblind-safe palette toggle)

## Project layout (where to make changes)

- `src/sim/` — pure simulation: board, movement, combat, behaviors
- `src/sim/pets/<name>.ts` — one file per pet; stats + behavior + UI metadata co-located
- `src/sim/behaviors.ts` — reusable trigger + action primitives
- `src/render/` — canvas drawing, effects, interpolation, palette
- `src/ui/` — DOM HUD, event log
- `src/input/` — mouse + keyboard handlers
- `tests/scenario.ts` — scripted-sim harness for matchup tests
- `tests/pets-smoke.test.ts` — three invariants per pet, auto-iterates `ALL_PETS`

Deeper docs:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — dataflow, layering rules, how a tick happens
- [`ROADMAP.md`](./ROADMAP.md) — phased plan, north star, intentional non-goals
- [`.claude/skills/pet-designer/SKILL.md`](./.claude/skills/pet-designer/SKILL.md) — design philosophy + integration checklist for new pets

## Status

Phase 1 (Feel) is complete: smooth interpolation, paint splats, damage numbers, death poofs, round summary, tactical sidebar, dot-grid texture, accessibility v1. Phase 2 (Content + readability) is next — see the [roadmap](./ROADMAP.md).

Current branch: `sandbox-ui-overhaul`. The history is small, focused commits in single-letter "Part" chunks — easy to follow what each step delivered.

## Online play

Online play requires a Supabase project. After cloning, the Sandbox mode works immediately. To enable online play, follow the setup steps in `docs/superpowers/handoff/supabase-setup.md` (Task 14 of the multiplayer plan, generated separately).

### Manual test checklist (run after Supabase setup)

1. Open `/` → Home menu shows. Press 1 → Sandbox loads. Esc → back to home.
2. Click Online Play → if not signed in, sign-in screen → Google → returns signed in → lobby.
3. Lobby: Create Room (no password) → room-waiting shows 6-char code.
4. In a second browser (or incognito), sign in as a different Google account, paste the code → both navigate to online-match.
5. Each player queues a Mouse and presses Ready. When both ready, both screens execute simultaneously with both pets visible.
6. Play to a win. Win overlay shows on both. Click Leave room → back to lobby.
7. As admin (`tctctc888@gmail.com`), see Admin Panel in lobby. Delete any room.
8. Password test: Create room with password "test123". Other client tries wrong password → error. Right password → joins.
9. Cap test: try to create more than 3 rooms in <60s as one user → 4th hits rate limit.
10. Deep link: copy invite link → open without auth → sign-in → lobby with code pre-filled.
