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
