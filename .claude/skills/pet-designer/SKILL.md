---
name: pet-designer
description: Use this skill whenever the user wants to add a new pet/animal to Pet Painters, redesign an existing pet's behavior or stats, balance the roster, or brainstorm new gameplay traits. Covers the thematic design philosophy, the stat system, behavior-tuple patterns, the reusable behaviors library, the per-pet module layout, and the file-by-file integration checklist.
---

# Pet Painters — Pet Designer

A reusable guide for designing a new pet (or redesigning an existing one). Read this end-to-end before you write any code. Most "weird pet feels off" problems come from skipping the design philosophy.

> Start with `ARCHITECTURE.md` at the repo root for a 5-minute overview of how the sim, render, and UI connect. This skill picks up where that doc ends.

## 1. Design philosophy

A pet earns its slot in the roster if it answers all four of these in one sentence each:

1. **What's the thematic hook?** The trait should feel like the *animal*, not like a mechanic. Mouse = scurry. Elephant = unstoppable. Turtle = paints in a wide splash. If you can't picture the actual animal doing the thing, pick a different animal or a different mechanic.
2. **What's the player's job with it?** "Deploy this when I want X." Mouse = quick early painter. Elephant = lock down a corridor. Turtle = expand a thin column. Cat = wide-area painter that counters mouse swarms.
3. **What's the counter?** Every pet should have a clear weakness. Cat ignores most pets but is fragile + expensive. Rabbit can't fight at all. Skunk is squishy. If a pet has no counter, it warps the meta.
4. **What's the one trait?** Strictly one core mechanic per pet. If you want two, they must be a single thematic idea (e.g. Elephant: "unshakable" = immovable + only walls turn it). Two mechanics that don't share a theme is a sign the pet should be split.

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

Roles still open: a true line-of-sight hunter (Lion?), a stationary denier (Spider?), a ranged projectile painter (Frog spitting?), a follower (Duckling chain?), a reflector (Porcupine?).

## 3. The pet module — one file, top to bottom

Every pet lives in **its own file** at `src/sim/pets/<name>.ts`. The recipe:

```ts
import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrScurry, frontBlocked, KING_DELTAS /* …whatever helpers you need */ } from '../behaviors';
// Optional: paintTile from '../board', pushHit/Pounce/Spray from '../../render/effects'

const STATS = {
  cost: 3,                  // Energy cost (1–6 sane range).
  speedTilesPerSec: 2,      // Forward cadence. 0.5 = elephant. 4 = mouse. >4 too fast.
  weight: 2,                // 1 = chaff, 2–3 = medium, 10 = anchor. Don't use 4–9.
  maxHp: 4,                 // 3 is the practical floor (Elephant deals 2).
  atk: 1,                   // 0 = pacifist (omit the attack tuple).
  atkSpeedPerSec: 1,        // 0 = no attack tuple.
  order: 2,                 // Initiative. Lower acts earlier each tick.
                            // Earlier wins movement conflicts; later wins paint conflicts.
                            // Elephant 1, everyone else 2 currently. There's room for 3.
  // Add bespoke fields freely:
  // sprayPerSec: 2,
  // wanderTurnChance: 0.25,
  // sightRange: 5,
} as const;

function fooStep(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) {
    // turn somehow
  } else {
    // walk
  }
}

export const FOO: PetDefinition = {
  id: 'foo',
  displayName: 'Foo',
  emoji: '🐾',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  ui: {
    hotkey: '7',
    short: '3–5 word blurb',
    ability: 'One paragraph of flavor + mechanics shown in the popup.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: fooStep },
    // …other tuples
  ],
};
```

That's the entire pet. Stats, behavior, def, and UI metadata all in one file.

## 4. Behavior tuples — the AI

Each pet has 1–3 `PetTuple`s. Each tuple is `{ intervalSec, trigger, action }`. The tick loop fires each tuple at its cadence, evaluating triggers fresh each time. Two important consequences:

### Mutual exclusivity matters

If two tuples can both fire on the same tick (same interval, both triggers true), the pet will perform *both* actions. That's how Mouse used to scurry-then-walk in one tick. The fix:

- **Pattern A — single decision tuple.** Default. Most shipped pets use one move-tuple whose action decides between turn / step / pounce internally. Mouse, Elephant, Cat, Rabbit, Turtle, Skunk all do this.
- **Pattern B — distinct intervals.** Only when you genuinely want different cadences per behavior. Make the triggers strictly mutually exclusive so only one ever fires per tick.
- **Pattern C — independent layered tuples.** A behavior that runs *alongside* movement (Turtle's splash, Skunk's spray, attack tuples) is allowed to coexist on the same tick. Make sure the action doesn't conflict with what the move tuple just did.

### Triggers that read like English

Good triggers are one short sentence:
- `frontBlocked(pet, state)` — "if anything blocks my front"
- `enemiesInFront(pet, state).length > 0` — "if there's an enemy I could hit"
- `() => Math.random() < 0.25` — "occasionally"

If you have to read your trigger twice, fold the logic into the action and make the trigger `() => true`.

## 5. The behavior toolbox (`src/sim/behaviors.ts`)

Import these by name; don't reinvent them.

| Helper | What it does |
|---|---|
| `declareMove(pet, state)` | Push a forward-step intent through the standard push system + paint. **Default movement.** |
| `walkOrScurry(pet, state)` | Walk forward when clear; scurry-turn otherwise. Mouse + Skunk use this. |
| `walkOrTurnAtWall(pet, state)` | Walk forward in-bounds; about-face only at walls. Elephant uses this. |
| `walkOrRotateCW(pet, state)` | Walk forward when clear; rotate CW when blocked. Turtle uses this. |
| `scurryTurn(pet)` | 45% CCW / 45% CW / 10% U-turn. |
| `turnAround(pet)` | 180° flip. |
| `rotateCW(pet)` / `rotateCCW(pet)` | 90° turns. |
| `CW_NEXT[dir]` / `CCW_NEXT[dir]` / `OPPOSITE[dir]` | Direction maps for explicit turns. |
| `facingDelta(dir)` | `{x,y}` step for a direction. |
| `tileInBounds(state, t)` | In-bounds check for any tile. |
| `frontInBounds(pet, state)` | Front tiles all on the board. |
| `frontHasPet(pet, state)` | Front tiles contain any pet. |
| `frontIsWall(pet, state)` | Not `frontInBounds`. |
| `frontBlocked(pet, state)` | Wall OR pet in front. |
| `anyPetAt(state, t, except?)` | Returns the pet at tile `t`, excluding `except`. Use for spatial searches. |
| `ORTHO_DELTAS` | 4 orthogonal `{x,y}` neighbors. |
| `DIAG_DELTAS` | 4 diagonal `{x,y}` neighbors. |
| `KING_DELTAS` | All 8 surrounding tiles (king's move). |

From `combat.ts`:
- `enemiesInFront(pet, state)` — list of enemies adjacent to front edge.
- `applyAttack(pet, state)` — standard attack: damages each enemy in front by `def.atk`, emits the hit-ring effect.

From `board.ts`:
- `paintTile(state.board, p, owner)` — direct paint. **Respects permanent home rows.** Use for splash / pounce / instant-kill paints.

From `render/effects.ts`:
- `pushHit / pushPounce / pushSpray(x, y, owner)` — trigger a fade-out visual.

## 6. Bypassing vs. participating in the movement system

`declareMove` queues a `MoveIntent`. The mover then participates in:
- **Push chains** (heavier pushes lighter, until total chain weight stops it)
- **Conflict resolution** (two pets to the same tile, heavier wins, tie random, loser blocked)
- **Painting** (every newly-entered footprint tile is painted in the mover's color)

For specials (Rabbit's vault, Cat's pounce, future teleports), it's fine to **mutate `pet.anchor` directly** in the action and call `paintTile` yourself — but you give up conflict resolution. Always check `anyPetAt(state, landing, pet)` first or risk two pets stacking on one tile.

The `immovable: true` flag on `PetDefinition` makes a pet unconditionally block all push chains, regardless of weight. Use sparingly — currently only Elephant has it.

## 7. Integration checklist (the new short version)

1. **Create `src/sim/pets/<name>.ts`** with the recipe above.
2. **Add the export to `ALL_PETS`** in `src/sim/pets/index.ts`. That's it for code.
3. **Run `npx tsc --noEmit && npm test`.** The smoke test suite picks up your new pet automatically and asserts:
   - Doesn't crash for 8 seconds solo.
   - Stays in-bounds.
   - Paints at least one tile (if speed > 0).
4. **(Optional)** Add a focused unit test under `tests/sim/` if your trait is novel enough to warrant pinning behavior (e.g. cat's pounce range).
5. **Run the dev server** (`npm run dev`) and try the pet in sandbox. Hover the card → popup should show the right stats/blurb.

The sandbox UI roster, hotkeys, type union (`PetId`), and tooltip are all derived from `ALL_PETS` — no other files to touch.

## 8. Worked example — designing **Spider** (territorial denier)

Walk through these in your head before pulling out the keyboard.

1. **Hook**: spiders sit still and build webs.
2. **Job**: deploy on a chokepoint to lock it down — anything that touches the web stops moving for a moment.
3. **Counter**: it can't paint much on its own and it's expensive.
4. **One trait**: enemies on the spider's 4 neighbor tiles have their facing rotated 90° randomly (a one-tile, less-targeted Skunk).

Stats:
```ts
const STATS = {
  cost: 4,
  speedTilesPerSec: 0,           // doesn't move
  weight: 2,
  maxHp: 4,
  atk: 0, atkSpeedPerSec: 0,
  order: 3,                       // late, so anything it cancels has already failed to move
  webPerSec: 2,
} as const;
```

Tuples:
- Single Web tuple (`intervalSec: 0.5`, `trigger: () => true`): look at the 4 ortho neighbors; for each enemy pet there, set a flag/tag or rotate them. `pushSpray` for a quick visual.

Note how the design fell out of one sentence ("spiders sit still and build webs"). That's the test.

## 9. When you're done

- Could a player explain this pet's purpose in one sentence?
- Has it taken a slot from a pet on this roster? If yes, are you removing/replacing the duplicate?
- Did you give it a clear weakness?
- Did you keep its trigger language plain?
- Did the smoke tests pass on the first try? (If they didn't, you may have an in-bounds bug or a "doesn't paint anything" balance issue.)

If yes to all five, ship it.
