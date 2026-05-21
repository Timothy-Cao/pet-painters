# Pet Painters — Design Spec (v1.1)

**Status:** Draft for review
**Date:** 2026-05-20
**Scope:** v1.1 minimum-viable design. Roster intentionally limited to two pets so the core simulation can be playtested before adding variety. Balance numbers (energy regen, win threshold, pet stats) are deliberately rough — they'll be tuned in playtest, not in design.

---

## 1. Concept

A two-player territory game. Players drop autonomous pets onto a shared board; pets walk and paint tiles in the player's color according to their AI behavior. First to paint 75% of the board wins.

**The genre bend:** movement and territory are the same action — pets paint as they walk. Players don't move pets; players *deploy* pets that move themselves. The strategy is in **what, where, when, and which direction** you deploy.

Visual identity: cute open-source emoji animals (OpenMoji or similar — free for commercial use, vast and consistent art catalog) sliding smoothly across a grid, leaving trails of color behind them.

## 2. Goals & non-goals (v1.1)

**Goals:**
- Understandable in under a minute: drop pets, they walk, they paint, paint wins.
- Watchable: once pets are deployed, the game does interesting things on its own.
- Decisive but not stressful: planning pauses mean no APM pressure.
- Just two pets, so the core simulation can be tuned before adding variety.

**Non-goals (deferred to later versions):**
- A larger pet roster, drafting, synergies, tribes.
- Multiple brain modes per pet, or player-selectable brains.
- Comeback mechanics (user will specify later after playtest).
- Networking, AI opponent, ranked play, accounts.
- Imperfect information / fog of war.
- Pet reorientation mid-execution.

## 3. Match structure

- **Players:** exactly 2.
- **Board:** 12×12 grid (144 tiles).
- **Starting territory:** each player's bottom 2 rows are pre-painted in their color (24 tiles per player, 48 painted from the start, 96 neutral). For the south player, rows 1–2; for the north player, rows 11–12.
- **Win condition:** the first player to ever own ≥75% of the board (108 painted tiles) wins immediately. There is no turn cap; the game runs until one side wins.
- **Tile states:** every tile is one of {Player A color, Player B color, neutral}. A pet entering a tile paints it the pet's owner's color (subject to tie rules in §8).
- **Tile ownership is not "claimed."** Only the most recent paint event determines a tile's color.

## 4. Time model: tick-and-plan

The game alternates between two phases.

**Planning phase** (paused simulation):
- Both players see the full board state. Each has a private side panel showing their current energy and pet hotkeys.
- Each player may queue any number of pet deployments whose total energy cost ≤ their current energy.
- A "deployment" specifies: pet type, anchor tile, and facing direction (N/S/E/W).
- Both players hit "ready." When both are ready, the planning phase ends.
- Planning phase has a **soft timeout** to keep games moving: 15 seconds early game, decreasing to 8 seconds late game (exact curve to be tuned). When the timeout fires, any player not yet readied is auto-readied with their currently queued deployments.
- **The match begins in a planning phase** — both players see the empty contested board with their pre-painted home rows.

**Execution phase** (running simulation):
- Length: 8 seconds per phase (to be tuned; possibly longer early, shorter late).
- Tickrate: **20 ticks per second** (160 ticks per execution phase).
- All queued deployments enter the board at tick 0 of the phase.
- Pets execute their behavior (§6) autonomously each tick.
- Energy regenerates only during execution (§11).
- Animation between tiles is smooth interpolation (a pet at `speed 2` slides across one tile in 0.5 seconds = 10 ticks).

After an execution phase ends, the game returns to a planning phase. This repeats until the win condition is met.

**Pets already on the board are not redirected** during planning phases. Players only queue *new* deployments. Existing pets resume their behavior when execution restarts. This simplification keeps brain modes meaningful and avoids "but I want to retreat my Mouse" UX problems.

## 5. Deployment (placement UX)

During a planning phase:

1. Press a number key (`1`–`6`) to select a pet type. v1.1 uses only `1` and `2`.
2. The mouse cursor shows a preview of the pet's footprint on the hovered tile.
3. Hold **WASD** to set the pet's facing direction (`W` = up/north, `A` = west, `S` = south, `D` = east). Default facing is `W`.
4. Left-click on a legal tile to confirm the deployment. Energy is debited immediately.
5. Right-click a queued (not-yet-executed) deployment to cancel it and refund the energy.

**Legal placement:**
- The pet's entire footprint must fit within the player's bottom 2 rows (rows 1–2 for the south player, rows 11–12 for the north player). A 2×2 pet placed at row 1 occupies rows 1–2.
- All tiles in the footprint must be unoccupied by other queued or already-deployed pets.
- The player must have enough energy to pay the cost.

(Rare exceptions to the placement zone — e.g., a teleport pet — may be introduced later. None in v1.1.)

## 6. Pet behavior: trigger / action / timer

A pet is not a state machine with goals or targets. **It is a bundle of `(trigger, action, timer)` tuples.** Each tuple says: "every `T` seconds, check this condition; if it's true, do this action." Pets don't pick targets — they react to whatever happens to be in the right relative position when their timer fires.

This model is the extension point for the entire future roster. AoE = "any enemy in radius 1"; ranged = "any enemy in line within N"; heal = "any ally below max hp"; etc. v1.1 implements only the two tuples below, but the engine should be built to accept arbitrary tuples.

**Every pet's timers start counting from the tick the pet was deployed.** A timer with interval `T` fires at deploy-tick + `20T`, deploy-tick + `40T`, ... — not at the deploy tick itself. The first action of any timer happens one full interval after deployment. (This avoids "free instant attack on deploy" and makes combat outcomes predictable from the numbers alone.)

### v1.1 behavior set (shared by both pets)

**Movement tuple**
- **Timer:** every `1 / speed` seconds.
- **Trigger:** the tile(s) directly in front of the pet's facing edge are unoccupied by other pets and on the board.
- **Action:** advance one tile forward. Paint every newly-entered tile (subject to §8 tiebreaks). For a 2×2 pet, this is the two front-edge tiles entering the new row/column.

**Attack tuple**
- **Timer:** every `1 / atk-speed` seconds.
- **Trigger:** at least one tile directly in front of the pet's facing edge contains a tile of an enemy pet's footprint.
- **Action:** deal `atk` damage to each distinct enemy pet whose footprint touches any of those checked front-edge tiles.

### Emergent consequences

- Movement and attack run on **independent clocks**. A pet facing an enemy will keep firing its move trigger (which fails — front tile occupied) and its attack trigger (which fires successfully).
- A pet **never reorients** during execution. Facing is locked at deployment.
- A pet **blocked by an allied pet** simply has its move trigger fail every fire of its move timer until the path clears. No special "wait" rule needed.
- A pet **at the board edge facing off-board** has its move trigger fail forever. The attack trigger still fires; it just rarely finds anything. Such pets become permanent defenders at the edge.
- A pet **hit from the side or rear** takes damage but does not retaliate, because its attack trigger only checks tiles in front of it. **Flank attacks are real**, and they emerge from the trigger definition, not a special rule.
- For pets larger than 1×1, "the tile in front" means **every tile directly in front of the facing edge** — one tile for 1×1, two tiles for 2×2. A Elephant with two Mouses lined up in front of it hits both on each attack-timer fire. This isn't AoE; it's the natural consequence of having a wider front.

The trigger/action/timer model means everything a pet does is observable: inspect it, see its tuples, predict its behavior.

## 7. Combat

Combat is **not a separate game state.** It is what naturally happens when two pets' attack tuples fire on the right targets.

Two pets meet face-to-face → both attack tuples fire on their own clocks → damage trades until one dies. No targeting, no aggro, no "who started it." Whoever's clock fires first deals the first hit. If their clocks happen to be aligned (depends on each pet's deployment tick), they hit simultaneously.

A pet at 0 hp dies immediately. Its tiles free up. Any other pet whose trigger was firing on it stops firing on it the next time its own timer fires.

## 8. Tile painting & tiebreaks

When a pet enters a new tile during its movement step, the tile is painted the pet's owner's color.

**Tile-entry conflict (two pets attempt to enter the same tile in the same tick):**
1. The pet with higher current `hp` (not max) wins; the other stops one tile short of its destination along its move path.
2. If tied on hp: higher `atk` wins.
3. Still tied: random.

This applies regardless of whether the conflicting pets are enemies or both belong to the same player.

**Same-tick paint conflict (two pets paint the same tile in the same tick — e.g., future AoE-paint pets, or two marchers brushing past each other after entry conflicts are resolved):**
- The pet with the **higher `order` number** wins the paint. `order` is a per-pet stat shown on inspection.
- v1.1 has no AoE pets, so this rule is rarely triggered, but it is defined so the engine doesn't need patching when AoE arrives.

**Painting an already-your-color tile:** no effect on score; effectively a no-op.
**Painting an enemy-color tile:** the tile becomes yours. Net score swing of +2 (you gain 1; opponent loses 1).
**Painting a neutral tile:** the tile becomes yours. Net score swing of +1.

## 9. Keyword vocabulary (v1.1)

Only what the two v1.1 pets need. Each pet card shows these inline.

- `cost(N)` — energy required to deploy.
- `size(W×H)` — footprint in tiles. 1×1 is a normal pet; 2×2 occupies a 2-tile-wide square.
- `speed(N)` — tiles per second of movement.
- `hp(N)` — health. At 0, the pet dies and its tiles free up.
- `atk(N)` — damage per attack instance.
- `atk-speed(N)` — attacks per second.
- `order(N)` — paint priority for same-tick paint tiebreaks. Higher wins. Visible on pet inspection.
- `brain: <mode>` — AI behavior label. v1.1 supports only `march-forward`, which is the behavior expressed by the §6 tuples.

## 10. The 2 starter pets

### 🐭 Mouse (Fast Painter)

| Field | Value |
|---|---|
| `cost` | 2 |
| `size` | 1×1 |
| `speed` | 2 tiles/sec |
| `hp` | 2 |
| `atk` | 1 |
| `atk-speed` | 1.0/sec |
| `order` | 2 |
| `brain` | march-forward |

**Role:** Fast, fragile painter. Sprints across open territory painting a 1-tile-wide trail. Loses any head-on fight that lasts more than a second or two. The cheapest deploy — used to race, harass, and force the opponent to commit defenders.

**Reference numbers** (one 8-sec execution phase, unobstructed):
- Tiles crossed: 16
- Tiles painted: 16
- Survives 1 Elephant hit (Elephant deals 2 damage, Mouse has 2 hp).

### 🐘 Elephant (Big Painter)

| Field | Value |
|---|---|
| `cost` | 5 |
| `size` | 2×2 |
| `speed` | 0.5 tiles/sec |
| `hp` | 8 |
| `atk` | 2 |
| `atk-speed` | 0.5/sec |
| `order` | 1 |
| `brain` | march-forward |

**Role:** Slow, tough, wide painter. Each forward step paints the 2 new tiles along its front edge. Can absorb sustained combat. The expensive deploy — used to anchor a column of territory and break through enemy defense.

**Reference numbers** (one 8-sec execution phase, unobstructed):
- Steps advanced: 4
- Tiles painted: 8 (2 per step)
- Survives ~4 Mouse hits if facing them head-on.

### Why these two

- **Speed vs. mass trade-off:** Mouse outpaces, Elephant outlasts. Mouse dies in one Elephant hit; Elephant dies to roughly 4 Mouse hits — but Elephant advances slowly, so Mouse has time to paint before contact.
- **Energy curve:** Mouse (cost 2) is playable from the first planning phase (starting energy 3). Elephant (cost 5) needs ~2 seconds of execution-time regen first, so it shows up in the second or third planning phase.
- **Real decision space despite only two units:** swarm with Mouses? Save for a Elephant? Mix? Which direction? Defend or attack?

## 11. Energy

- Starting energy: **3** per player.
- Regeneration: **+1 energy per second of execution time** (i.e., +8 per default 8-second execution phase). Energy does not regenerate during planning phases.
- Cap: **10**.
- Unspent energy carries over to the next planning phase.

**Tuning note:** these numbers are deliberately generous in v1.1. The implementation should expose all balance constants (energy regen rate, cap, starting value, pet costs, win threshold, phase lengths) in a single configuration file so playtesting can iterate quickly.

## 12. Match end

- A player wins immediately the instant their painted tile count reaches ≥108 (75% of 144).
- If both players cross 108 in the same tick (extremely unlikely in v1.1 mechanics): player with strictly more painted tiles wins; exact tie = draw.
- There is no other win condition (no king-capture, no last-pet-standing, no turn cap).

## 13. Out of scope for v1.1

- Additional pet roster, drafting, synergies, tribes/tags.
- Additional brain modes: `wander`, `seek-foreign-tile`, `seek-enemy`, `random-roam`, `smart`. (Design space mapped; implementation deferred.)
- Additional trigger/action types: AoE attack/paint, ranged, heal, deathrattle, on-paint, on-kill, summons, status effects (freeze, stun, slow).
- Pet reorientation, retreats, manual movement orders.
- Comeback mechanics — deferred until user has playtested.
- AI opponent, networking, persistence, accounts.
- Sound, animation polish beyond linear tile interpolation.

## 14. Known gaps & open questions

These are *known* limitations of the v1.1 spec. The user has explicitly deferred balance and "feels wrong" issues to playtest — implementation should make balance numbers easy to change.

### Spec-clarity (rules the implementer needs)
1. **Pet stacking:** at most one pet's footprint occupies any tile. A 2×2 pet claims all four of its tiles exclusively. Friendly or enemy — no overlap.
2. **Tile-entry conflict, both pets are allies:** same rules as enemy conflict (higher hp, then higher atk, then random; loser stops one tile short).
3. **Pets walking off the board:** spec says they stop at the edge and their move trigger keeps failing. Confirmed intent.
4. **Pet sandwiched between an ally in front and an enemy behind:** spec is consistent — front blocked, attack trigger fails, rear enemy hits without retaliation, pet dies. No special rule needed.
5. **Same-tick paint conflict edge case:** if pet A and pet B both attempt to enter tile X in the same tick, the §8 entry-conflict rules decide who enters (and therefore who paints). `order` only matters when two pets *both* successfully paint the same tile in the same tick (e.g., future AoE overlapping a marcher's path). Not used in v1.1.
6. **Pet inspection UI:** during planning phases, hovering or clicking any pet on the board should display its full tuple set, current hp, facing, and `order` number.
7. **Initial planning phase energy:** both players start with 3 energy in the first planning phase. Neither can afford a Elephant (cost 5) yet — first deployment will likely be a Mouse or empty.

### Deferred to playtest (don't pre-solve)
8. **75% win threshold, energy regen rate, pet costs/stats:** all placeholders. Tuned by user after playing.
9. **Execution phase length (8s) and planning timeout curve (15s → 8s):** also placeholders.
10. **Stagnation, symmetry, comeback mechanics:** user has flagged these as "I'll see when I play." Do not pre-design solutions in v1.1.

### Out of scope for v1.1 but anticipated
11. **More brain modes** (`wander`, `seek-foreign`, `seek-enemy`, `random`, `smart`) — design space mapped, not implemented.
12. **More trigger/action types** (ranged, AoE, heal, deathrattle, on-paint, on-kill) — the model is designed to absorb these.
13. **Adjacency convention** (Chebyshev vs. Manhattan) — irrelevant for v1.1 because nothing uses radius. Choose when the first radius-based pet is added.
14. **Diagonal facing** — explicitly disallowed in v1.1; facing is N/S/E/W only.
15. **Tech stack** — not chosen. Browser-first (TypeScript + Canvas/WebGL) is likely the simplest path, but the user hasn't picked yet. The spec is engine-agnostic.

## 15. Recap

v1.1 is intentionally small. The simulation runs at 20 Hz, paused every 8 seconds for a planning phase where both players queue new deployments using accumulated energy. Each pet is a bundle of `(trigger, action, timer)` tuples — for v1.1 just two tuples: "if front tile is clear, walk forward and paint" and "if front tile has an enemy, deal `atk`." Players win by painting 75% of a 12×12 board, starting with their bottom 2 rows already in their color. Only two pet types — a fast 1×1 Mouse and a slow 2×2 Elephant. The trigger/action/timer model is the foundation; every future pet, brain mode, and ability slots into it without changing the rules engine.
