---
name: pet-designer
description: Use this skill whenever the user wants to add a new pet/animal to Pet Painters, redesign an existing pet's behavior or stats, balance the roster, or brainstorm new gameplay traits. Covers the thematic design philosophy, the stat system, behavior-tuple patterns, the reusable helpers, and the file-by-file integration checklist.
---

# Pet Painters — Pet Designer

A reusable guide for designing a new pet (or redesigning an existing one) for the Pet Painters sandbox. Read this end-to-end before you write any code. Most "weird pet feels off" problems come from skipping the philosophy section.

## 1. Design philosophy

A pet earns its slot in the roster if it answers all four of these in one sentence each:

1. **What's the thematic hook?** The trait should feel like the *animal*, not like a mechanic. Mouse = scurry. Elephant = unstoppable. Turtle = paints in a wide splash. If you can't picture the actual animal doing the thing, pick a different animal or a different mechanic.
2. **What's the player's job with it?** "Deploy this when I want X." Mouse = quick early painter. Elephant = lock down a corridor. Turtle = expand a thin column.
3. **What's the counter?** Every pet should have a clear weakness. Cat ignores most pets but is fragile + expensive. Rabbit can't fight at all. Skunk is squishy. If a pet has no counter, it warps the meta.
4. **What's the one trait?** Strictly one core mechanic per pet. If you want two, they must be a single thematic idea (e.g. Elephant: "unshakable" = immovable + only walls turn it). Two mechanics that don't share a theme is a sign the pet should be split into two pets.

Avoid:
- **Generic stat-bumps.** "It's a bigger mouse" is not a design.
- **Conditional spaghetti.** Trigger functions should be a sentence: "if anything blocks my front", "if there's a mouse in any neighbor tile". If the trigger needs three "and"s, simplify.
- **Counter-everything traits.** "Immune to push and faster than Mouse and attacks twice" is a balance crisis.

## 2. Current roster — don't duplicate

When pitching a new pet, check this list first to make sure the niche isn't already filled:

| Pet | Role | Core trait |
|---|---|---|
| 🐭 Mouse | Cheap quick painter | **Scurry** — random turn when blocked |
| 🐘 Elephant | Territory lock | **Unshakable** — immovable, only walls turn it |
| 🐱 Cat | Wide-area painter / mouse counter | **Curious** — random turns + pounces only on mice |
| 🐰 Rabbit | Penetrator | **Vault** — hops over single pet blockers |
| 🐢 Turtle | Area expander | **Splash** — paints 4 orthogonal neighbors every second |
| 🦨 Skunk | Disruptor | **Spray** — adjacent enemies are forced to face away |

Roles still open: a true line-of-sight hunter (Lion?), an area denier (Spider?), a ranged painter (Frog spitting?), a follower (Duckling chain?), a reflector (Porcupine?).

## 3. The stat block

Every pet has a stats record in `src/config/balance.ts`. Keep the file in lockstep with `src/sim/pet-defs.ts`.

```ts
export const FOO_STATS = {
  cost: 3,                  // Energy cost in non-sandbox play. 1–6 is the sane range.
  speedTilesPerSec: 2,      // Forward step cadence. 0.5 = elephant. 4 = mouse. >4 feels too fast.
  weight: 2,                // Push interactions. 1 = mouse, 10 = elephant.
                            //   A pet can push another only if pusher.weight > 2 * (sum of chain weights).
                            //   Heaviest in conflict resolution wins same-tile races.
  maxHp: 4,                 // 1 = glass cannon, 25 = elephant. Mouse is 3.
  atk: 1,                   // 0 = pacifist (no attack tuple). Mouse 1. Elephant 2. Cat 0 (uses pounce instead).
  atkSpeedPerSec: 1,        // Attacks per second. 0 = no attack tuple.
  order: 2,                 // INITIATIVE / turn order. Lower acts earlier each tick.
                            //   Earlier acts wins movement conflicts (gets to the tile first).
                            //   Later acts wins paint conflicts (paints over earlier pet's paint).
                            //   Elephant is 1 (heaviest, earliest). Mouse/Cat/Skunk are 2.
  // Add bespoke fields for the pet's special behavior:
  // sprayPerSec: 2,
  // wanderTurnChance: 0.25,
  // sightRange: 5,
} as const;
```

### Stat ranges to keep balance honest

- **cost** scales roughly with HP×ATK plus an "ability tax." A 25-HP wall costs 5. A glass-cannon utility costs 3. A bespoke ability that disables an entire archetype (cat vs. mouse) costs 5.
- **weight** intentionally lives on a coarse scale. There are really only three tiers: 1 (chaff), 2–3 (medium), 10 (anchor). Don't introduce 4–9; nothing pushes between those tiers cleanly.
- **order**: pick deliberately. Lower wins movement races (great for chargers); higher wins paint contests (great for painters that need their color to "stick"). Elephant takes 1 to barrel through; everyone else has been 2 so far. There's room for a 3.
- **maxHp** rule of thumb: any pet that can be one-shot by Elephant's 2 ATK feels bad. 3 is the practical floor unless the design *wants* fragility.

## 4. Behavior tuples — the AI

Each pet has 1–3 `PetTuple`s in its `tuples: PetTuple[]` array. Each tuple is:

```ts
{
  intervalSec: number,                                    // Fire cadence, real seconds.
  trigger: (pet, state) => boolean,                       // Re-evaluated every interval.
  action: (pet, state) => void,                           // Run if trigger returns true.
}
```

The tick loop fires each tuple in order at its cadence, evaluating triggers fresh each time. Two important consequences:

### Mutual exclusivity matters

If two tuples can both fire on the same tick (same interval, both triggers true), the pet will perform *both* actions. That's how Mouse used to scurry-then-walk in one tick. The fix:

**Pattern A — single decision tuple.** Most pets we've shipped use one move-tuple whose action decides between turn / step / pounce internally. Mouse, Elephant, Cat, Rabbit, Turtle, Skunk all do this. This is the cleanest default.

```ts
function fooStep(pet, state) {
  if (frontBlocked(pet, state)) scurryTurn(pet);
  else declareMove(pet, state);
}
```

**Pattern B — distinct intervals.** If you want a different cadence per behavior (e.g. Cat's hunt-mode used to step faster than wander-mode), make the triggers strictly mutually exclusive so only one ever fires per tick:

```ts
{ intervalSec: 0.33, trigger: hasTargetInSight, action: dashForward },     // hunt
{ intervalSec: 1.0,  trigger: noTargetInSight,  action: walkOrTurn },     // wander
```

**Pattern C — independent layered tuples.** A behavior that runs *alongside* movement (Turtle's splash, Skunk's spray, attack tuples) is allowed to coexist on the same tick. Make sure the action doesn't conflict with what the move tuple just did.

### Triggers that read like English

Good triggers are one short sentence:
- `frontBlocked(pet, state)` — "if anything blocks my front"
- `enemiesInFront(pet, state).length > 0` — "if there's an enemy I could hit"
- `(pet, state) => Math.random() < 0.25` — "occasionally"

If you have to read your trigger twice to understand it, fold the logic into the action and make the trigger `() => true`.

## 5. The toolbox in `pet-defs.ts`

Use these existing helpers; don't reinvent them. They live above the pet definitions in `src/sim/pet-defs.ts`.

| Helper | What it does |
|---|---|
| `declareMove(pet, state)` | Push a forward-step intent. Goes through the push system, can be conflict-resolved, and paints the new tiles. **Default movement.** |
| `scurryTurn(pet)` | Random 45% left / 45% right / 10% U-turn. |
| `turnAround(pet)` | 180° flip. |
| `CW_NEXT[dir]` / `CCW_NEXT[dir]` / `OPPOSITE[dir]` | Direction maps for explicit turns. |
| `facingDelta(dir)` | The `{x, y}` step for a given direction. |
| `frontTiles(anchor, size, facing)` | The one row of tiles immediately past the pet's front edge. |
| `footprintTiles(anchor, size)` | All tiles the pet currently occupies. |
| `frontInBounds(pet, state)` | Front tiles all on the board. |
| `frontHasPet(pet, state)` | Front tiles contain any pet. |
| `frontIsWall(pet, state)` | Not `frontInBounds`. |
| `frontBlocked(pet, state)` | Wall OR pet in front. |
| `tileInBounds(state, t)` | Generic in-bounds check for any tile. |
| `anyPetAt(state, t, except)` | Returns the pet whose footprint covers `t`, excluding `except`. Use for spatial searches like Cat's 8-neighbor pounce. |
| `enemiesInFront(pet, state)` (in `combat.ts`) | The list of enemy pets adjacent to your front edge. |
| `applyAttack(pet, state)` (in `combat.ts`) | Standard attack: damages each enemy in front by `def.atk`, emits the hit-ring effect. |
| `paintTile(state.board, p, owner)` (in `board.ts`) | Direct paint. Respects permanent home rows. Use for splash / pounce / instant-kill paints. |
| `pushHit / pushPounce / pushSpray(x, y, owner)` (in `render/effects.ts`) | Trigger a fade-out visual at a tile. |

If you need *line-of-sight* logic later (the now-removed `lookAhead` helper was a clean implementation; rebuild it from git history when the first sight-using pet lands).

## 6. Bypassing vs. participating in the movement system

`declareMove` queues a `MoveIntent`. The mover then participates in:
- **Push chains** (heavier pushes lighter, until total chain weight stops it)
- **Conflict resolution** (two pets to the same tile, heavier wins, tie is random, loser blocked)
- **Painting** (every newly-entered footprint tile is painted in the mover's color)

For specials (Rabbit's vault, Cat's pounce, future teleports), it's fine to **mutate `pet.anchor` directly** in the action and call `paintTile` yourself — but you give up conflict resolution, so **always check `anyPetAt(state, landing, pet)`** first or risk two pets stacking on one tile.

The `immovable: true` flag on `PetDefinition` makes a pet unconditionally block all push chains, regardless of weight. Use sparingly — currently only Elephant has it.

## 7. Integration checklist

When adding `FOO`, edit these files in order:

1. **`src/config/balance.ts`** — Add `FOO_STATS`.
2. **`src/sim/pet-defs.ts`** —
   - Import `FOO_STATS`.
   - Write a `fooStep` (and any bespoke action functions) above the existing pet defs.
   - Export `export const FOO: PetDefinition = { ... }`.
   - Add `[FOO.id]: FOO` to the `REGISTRY` map at the bottom.
3. **`src/ui/sandbox-ui.ts`** —
   - Import `FOO` and `FOO_STATS`.
   - Add an entry to the `ROSTER` array (hotkey is next-available number).
   - Add `[FOO.id]: FOO_STATS` to `STAT_LABELS`.
4. **`src/input/deploy-ui.ts`** —
   - Import `FOO`.
   - Add `'<hotkey>': FOO.id` to `PET_HOTKEYS`.
5. **`index.html`** — Bump the footer-hint range (e.g. `<kbd>1</kbd>–<kbd>7</kbd>`).
6. **Run `npx tsc --noEmit` and `npm test`.** No new tests are required, but run the existing suite at least five times if your pet uses randomness — flaky behaviors will surface as flaky tests.

## 8. Worked example — designing **Spider** (territorial denier)

Walk through these in your head before pulling out the keyboard.

1. **Hook**: spiders sit still and build webs.
2. **Job**: deploy on a chokepoint to lock it down — anything that touches the web stops moving for a moment.
3. **Counter**: it can't paint much on its own and it's expensive.
4. **One trait**: enemies on the spider's 4 neighbor tiles have their next move intent cancelled.

Resulting stats:
```ts
SPIDER_STATS = {
  cost: 4,
  speedTilesPerSec: 0,           // doesn't move at all
  webPerSec: 2,
  weight: 2,
  maxHp: 4,
  atk: 0, atkSpeedPerSec: 0,
  order: 3,                       // late, so anything it cancels has already failed to move
}
```

Tuples:
- Web tuple (`intervalSec: 0.5`, `trigger: () => true`): look at the 4 neighbors; for each enemy pet there, set a flag/tag (or simpler: rotate them 90° randomly so they walk somewhere harmless, like a one-tile Skunk variant). Push a visual via `pushSpray` (or add a `pushWeb` if you want a new asset).

Note how the design fell out of one sentence ("spiders sit still and build webs"). That's the test.

## 9. When you're done

After implementation, ask yourself:
- Could a player explain this pet's purpose in one sentence?
- Has it taken a slot from a pet on this roster? If yes, are you removing/replacing the duplicate?
- Did you give it a clear weakness?
- Did you keep its trigger language plain?

If yes to all four, ship it.
