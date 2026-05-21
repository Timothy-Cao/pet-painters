# Pet Painters — Architecture

A short overview of how the code is laid out and where to make changes. Optimized for an agent dropping into this repo for the first time and needing to ship a feature without thrashing.

## Top-level dataflow

```
                 (main.ts)
                     │
                     ▼
            ┌────────────────┐
            │   GameLoop     │  20 Hz tick + RAF render
            └───────┬────────┘
                    │ each frame
        ┌───────────┴────────────┐
        ▼                        ▼
   tickMatch(state)         render(state)
        │                        │
        ▼                        ▼
   advanceTick →            renderBoard,
   • each pet, each tuple    renderPets,
   • declareMove → intent    renderEffects,
   • applyAttack → effect    renderDeployPreview,
        │                    refreshAll (DOM)
        ▼
   resolveMovements →
   push/conflict → paint tiles
```

The sim is a pure tick-driven state machine. The renderer is a "draw whatever's in state right now" function. Input mutates `state` (deploy intents) or `ui` (pet selection, facing) directly during planning. **Sim never reads the DOM; render reads (but never mutates) sim state.**

## Folder map

```
src/
  config/
    constants.ts         Board size, tick rate, home rows.
    balance.ts           Global tunables (energy regen, win threshold, phase durations).
                         Per-pet stats live inside each pet module.
  types/
    game.ts              MatchState, PlayerId, Direction, Vec2.
    pet.ts               PetDefinition, PetTuple, Pet, PetStats, PetUiMetadata.
  sim/                   Pure simulation. No DOM, no rendering imports here…
    match.ts             createInitialMatch, tickMatch, submitReady, resetMatchInPlace.
    tick.ts              advanceTick — fires per-pet tuples, calls resolveMovements.
    board.ts             Board init, paintTile (permanent home rows enforced here).
    deploy.ts            tryDeploy / petAtTile / undeploy. Validates ownership.
    combat.ts            enemiesInFront, applyAttack.   …(except `combat.ts` and the
    movement.ts          Push system: evaluatePush, conflict resolution, paint on move.
    geometry.ts          footprintTiles, frontTiles. Pure 2D helpers.
    behaviors.ts         Reusable trigger + action primitives for pet tuples.
    pet-defs.ts          Thin facade. Re-exports ALL_PETS + getPetDef.
    pets/                ◀── one file per pet, single source of truth ──▶
      index.ts             ALL_PETS array; PetId union derived from it.
      mouse.ts
      elephant.ts
      cat.ts
      rabbit.ts
      turtle.ts
      skunk.ts
  render/
    canvas.ts            RenderContext, clearCanvas, tileToPixel.
    board.ts             Tile colors, home tints, hatch marks.
    pets.ts              Sprite rendering with facing-rotated emoji.
    effects.ts           Hit/pounce/spray fade-out animations queued by sim.
    ui.ts                (Empty no-op kept for back-compat.)
  input/
    deploy-ui.ts         Mouse + keyboard handlers; deploy/undeploy; preview render.
                         Builds PET_HOTKEYS by iterating each def's `ui.hotkey`.
  ui/
    sandbox-ui.ts        DOM-driven HUD: pet roster, anchored popup, score bar,
                         facing, energy, phase pill, exec progress, banners.
  loop.ts                requestAnimationFrame driver; alternates tick & render.
  main.ts                Wires everything together.
  styles.css

tests/
  scenario.ts            Scripted simulation harness (newScenario()).
  pets-smoke.test.ts     Three invariants per pet, auto-iterates ALL_PETS.
  sim/                   Targeted unit tests for board, deploy, movement, …

.claude/
  skills/
    pet-designer/SKILL.md   Reusable guide for adding new pets.
```

The two layering rules to remember:

- **`sim/` files don't import from `render/` or `ui/` or `input/`.** The one exception today is `pushHit / pushPounce / pushSpray` from `render/effects.ts`, which the sim calls to signal animations. Tests don't care because the queue just accumulates.
- **`ui/` and `input/` modules can read sim state freely but never reshape its types.** All mutation happens through documented sim entry points (`tryDeploy`, `submitReady`, `tickMatch`, …).

## How a tick happens

1. `GameLoop.frame()` checks if we're in `execution` phase. If yes, it advances real-time by `dt` and pops one `tickMatch(state)` per 50ms (20 Hz).
2. `tickMatch` calls `advanceTick`, which iterates each pet and each tuple. A tuple fires when `state.tick - lastFireTick >= intervalTicks`. Its `trigger` is re-evaluated every interval; if true, `action` runs and may:
   - Push a `MoveIntent` (the normal path)
   - Mutate a pet's facing/HP/anchor directly (special abilities)
   - Call `paintTile` and `pushHit/Pounce/Spray` (paints + effects)
3. Dead pets (`hp <= 0`) are removed.
4. `resolveMovements` runs once at the end of the tick: groups intents by destination, resolves conflicts (heavier wins, ties random), iterates in weight-descending order, walks each push chain, then performs moves and paints.
5. Energy regen + win check.

## How the UI stays in sync

- `main.ts`'s `render()` runs every animation frame. It clears the canvas, redraws board/pets/effects/deploy-preview, then calls `refreshAll(state, ui)` which updates every DOM element (score bar, energy cells, phase pill, exec progress). No diffing — just stamp the current truth.
- The pet roster is built once in `mountSandboxUI` by iterating `ALL_PETS`. Each card binds hover/focus to show the anchored popup positioned via `getBoundingClientRect`.

## Adding a new pet

1. Create `src/sim/pets/<name>.ts`. Define `STATS` (a literal object), any bespoke action functions, and `export const NAME: PetDefinition`. Co-locate the `ui` metadata (hotkey, short blurb, ability).
2. Add the new export to `ALL_PETS` in `src/sim/pets/index.ts`.
3. Done. The roster, hotkeys, popup, type union, and smoke tests pick it up automatically.

The full design checklist (thematic role, stat ranges, tuple patterns, behavior-helper toolbox, balance considerations, worked example) is in `.claude/skills/pet-designer/SKILL.md`.

## Adding a new behavior helper

Put it in `src/sim/behaviors.ts`. Keep it pure (no DOM, no rendering imports). The pet-designer skill lists the existing toolbox — extend that list when you add one.

## Adding a new sim event/effect

The sim → render coupling lives in `src/render/effects.ts`. Add a new `Effect` variant + `pushFoo(x, y, owner)`. Call `pushFoo` from the sim action that triggers it. Render it in `renderEffects`.

## Testing patterns

- **Targeted physics tests**: `tests/sim/<topic>.test.ts`. Use these to lock behavior of movement, combat, deploy validation, etc.
- **Per-pet invariants**: smoke tests auto-iterate `ALL_PETS`. Add new invariants here when you find a pet-shaped bug class (e.g. "every pet's anchor stays integer-valued").
- **Scripted matchups**: `tests/scenario.ts`'s `newScenario()` is the entry point. Place pets, run ticks, assert. Use this when balancing.

## Known intentional gaps

- No save/load. State lives entirely in memory.
- No replay log. The sim is deterministic given Math.random() seeding, but no infrastructure for that yet.
- No multiplayer / no AI opponent. Sandbox is hot-seat single-screen.
- Render effects coupling: `combat.ts` and pet modules import `pushHit / pushPounce / pushSpray` directly. This is intentional for simplicity; if it ever becomes a testability problem we'd convert effects into an event bus on `MatchState`.
