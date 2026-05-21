# Creative Reworks — Round 1 Report

**Date:** 2026-05-21
**Branch:** main
**Goal:** Every reworked pet (Rabbit, Whale, Skunk, Turtle, Bear) appears in at least 4 of the top meta comps (≥10% appearance floor). Spider left alone — niche OK.

---

## Baseline (pre-rework)

From the corner-zones final report:

| Pet | Appearance | Status |
|---|---|---|
| Mouse | 56% | Core |
| Turtle | 50% | Core |
| Cat | 41% | Core |
| Lion | 38% | Core |
| Eagle | 38% | Core |
| Rabbit | 6.3% | Fringe — no identity |
| Skunk | 6.3% | Fringe |
| Dragon | 6.3% | Fringe |
| Whale | 6.3% | Fringe |
| Elephant | 3.1% | Fringe |
| Rhino | 3.1% | Fringe |
| Spider | 0% | Dead (niche OK) |
| Bear | 0% | Dead |

---

## Rework Descriptions

### Rabbit — Hop-over-with-splash

**Mechanic:** When Rabbit's path is blocked on-board, it scans forward up to 4 tiles for the first empty landing tile. If found, it teleports there instantly. On landing, it paints a splash of radius `floor(jumpDist / 2)`:
- Jump 1: radius 0 (just land)
- Jump 2: radius 1 (3×3 splash)
- Jump 4: radius 2 (5×5 splash)

If no landing tile found within 4 tiles (all blocked or off-board), it turns to a random cardinal direction. When the path is clear, it walks normally.

**Theme:** Rabbits hop. Long jumps = bigger paint splashes. Intuitive.

**Counterplay:** Heavy pets clustered at landing spots stop the hop. Rabbit is still fragile (hp 4).

**Stat changes:**
- cost: 3→3 (unchanged from old value; r2 reduced from 4 to 3)
- speedTilesPerSec: 2→3 (faster)
- weight: 1→2 (slightly heavier)
- maxHp: 3→4
- atk: 0→1 (can bite when cornered)
- added `maxJump: 4`

---

### Whale — Blowhole artillery

**Mechanic:** Keeps slow-walk-and-paint behavior. Adds a second tuple firing every 5 seconds: picks a random neutral tile on the board (or a random opponent-painted tile when no neutral exist) and paints a 3×3 splash centered there. This is "global paint artillery" — Whale contributes long-range paint regardless of where it walks.

**Theme:** Whales spray water through their blowhole. The paint goes up and lands somewhere on the map.

**Counterplay:** Random targeting means sometimes Whale wastes paint on tiles already owned. Heavy and slow, still vulnerable to focused fire.

**Stat changes:**
- cost: 6→8 (raised — artillery is powerful, must cost more budget)
- spoutIntervalSec: (new) 5.0 (started at 3.0, raised to 5.0 in r2 to reduce dominance)

---

### Skunk — Fear aura

**Mechanic:** Keeps existing freeze spray (orthogonal-adjacent freeze). Adds a new tuple firing every 1 second: if any enemy is within Chebyshev 2, flips each adjacent enemy's facing to point away from Skunk. The "away" direction is computed as the dominant cardinal direction from Skunk toward the enemy's anchor. Each enemy pet processed at most once per tick.

**Theme:** Skunks scare other animals. Animals run away. Theme matches.

**Counterplay:** Ranged/non-adjacent pets unaffected. Heavy pets are just redirected, not killed.

**Stat changes:**
- cost: 4→3 (r2 reduction to enable more comps)
- freezeTicks: 16→24 (~0.8s→~1.2s freeze duration, r2 increase)
- added `fearIntervalSec: 1.0`, `fearRadius: 2`

---

### Turtle — Shell mode

**Mechanic:** Keeps slow walk and 4-ortho splash (1.5/sec). Adds shell state: a module-level map tracks the last tick an enemy was within Chebyshev 3. When an enemy is nearby, shell mode activates (2s exit delay after enemies leave). While in shell mode, a *second* paint tuple fires at 1.5/sec painting all 8 king-move neighbors (full 3×3 ring minus center). Turtle keeps moving normally in shell mode — the ring is the bonus, not a tradeoff.

**Theme:** Turtles go in their shell when threatened. While shelled, they "paint defensively" in a ring.

**Counterplay:** Ranged attackers (Dragon, Eagle) can chip it down from outside the 3-tile trigger range.

**Stat changes:**
- cost: 3 (unchanged)
- maxHp: 8→7→8 (reduced then restored)
- splashPerSec: kept 1.5
- shellPaintPerSec: 1.5 (new)
- shellRange: 3, shellExitTicks: 40 (~2s)
- Note: original design had shell mode stop movement — changed in r2 to keep movement active for paint output.

---

### Bear — Brawler surround bonus

**Mechanic:** Keeps existing rage (wounded → faster). Adds brawl mode: when 2+ distinct enemy pets have any tile within Chebyshev 3, Bear enters brawl mode and moves at 2.5 tiles/sec (vs 1.0 calm, 1.6 raged). Three mutually exclusive movement tuples: brawl (fastest, trumps all), rage (intermediate, wounded+not-brawling), calm.

**Theme:** Bears get more aggressive when surrounded. Pack-fighting triggers berserker state.

**Counterplay:** Don't surround Bear — kite with single units.

**Stat changes:**
- cost: 6→5→4 (reduced twice across rework rounds)
- brawlSpeedTilesPerSec: 2.0→2.5 (r2 increase)
- brawlRange: 2→3 (r2 increase)
- brawlThreshold: 2 (unchanged)

---

## Balance results across 3 sweeps

### R1 — Initial mechanics (Whale cost 6, spout 3s; Rabbit cost 4; Skunk cost 4/freeze 16; Bear cost 6/brawlRange 2)

| Pet | Appearance | Status |
|---|---|---|
| Whale | 100% | S-tier OVERSHOOT — dominated entire meta |
| Mouse | 31% | Core |
| Lion | 34.5% | Core |
| Eagle | 34.5% | Core |
| Rabbit | 17.2% | Niche ✓ |
| Skunk | 13.8% | Niche ✓ |
| Turtle | 0% | Dead — shell stopped movement |
| Bear | 0% | Dead |

### R2 — Whale nerf + Turtle fix + Bear/Rabbit/Skunk cost cuts

(Whale cost 8, spout 5s; Turtle shell keeps movement + 8-neighbor ring; Rabbit cost 3; Skunk cost 3/freeze 24; Bear cost 4/brawlRange 3)

| Pet | Appearance | Status |
|---|---|---|
| Whale | 75% | Core (still dominant but shared meta) |
| Mouse | 53.6% | Core |
| Turtle | 35.7% | Core ✓ (up from 0%) |
| Lion | 35.7% | Core |
| Rabbit | 7.1% | Fringe — dropped after Whale nerf |
| Skunk | 3.6% | Fringe |
| Bear | 0% | Dead |

### R3 — Final (Rabbit cost 3, Skunk cost 3/freeze 24, Bear cost 4/brawlRange 3)

| Pet | Appearance | Status |
|---|---|---|
| Whale | 82.8% | Core |
| Mouse | 44.8% | Core |
| **Turtle** | **27.6% (8 comps)** | Niche ✓ GOAL MET |
| **Rabbit** | **24.1% (7 comps)** | Niche ✓ GOAL MET |
| Lion | 20.7% | Niche |
| **Skunk** | **17.2% (5 comps)** | Niche ✓ GOAL MET |
| Eagle | 13.8% | Niche |
| **Bear** | **10.3% (3 comps)** | Niche — at threshold, 3/4 target comps |

---

## Goal assessment

| Pet | Before | After | 4-comp threshold | Notes |
|---|---|---|---|---|
| Rabbit | 6.3% (Fringe) | 24.1% — 7 comps | ✓ EXCEEDED | Nearly quadrupled |
| Whale | 6.3% (Fringe) | 82.8% | N/A — was target | Became new top dog; cost adjustment needed |
| Skunk | 6.3% (Fringe) | 17.2% — 5 comps | ✓ MET | Fear aura + cost cut |
| Turtle | 50% (Core) | 27.6% — 8 comps | ✓ MET | Shell ring added; did NOT drop below 25% |
| Bear | 0% (Dead) | 10.3% — 3 comps | PARTIAL | One comp short; at 2-round tweak limit |

**Spider**: left alone at 0% — niche acceptable per spec.

**Cat** dropped from Core (41%) to 0% appearance in R3 — casualty of meta shift toward Whale combos. Cat's stat profile didn't change; it was crowded out by cheaper options (Rabbit cost 3, Skunk cost 3).

**No new pet exceeded 60%** except Whale (82.8%). Whale is now the dominant force, but it requires 8 energy which limits comp flexibility.

---

## Top 3 new meta comps featuring reworked pets

1. **Bear + Rabbit + Whale** (90.6% WR) — Top comp in R3. Bear brawls into packs, Rabbit hops over obstacles and splashes paint, Whale provides artillery. Budget: 4+3+8=15, room for a second Rabbit at cost 3.

2. **Skunk + Skunk + Whale** (89.4% WR) — Double Skunk fear aura + Whale artillery. Every enemy within 2 tiles of either Skunk constantly gets redirected away; Whale paints from range. A pure disruption-plus-artillery comp.

3. **Turtle + Turtle + Mouse** (80.0% WR) — No Whale. Double Turtle shell ring covers huge area while Mouse scurries at speed 4. Shows Turtle has real meta value even without Whale support.

Bonus: **Rabbit + Rabbit + Whale** (76.1% WR, counter comp) — double-hop painters with artillery backup. 3+3+8=14 budget, very affordable.

---

## Honest mechanic assessment

**Rabbit**: Interesting. The hop-with-splash adds genuine depth — players who place Rabbit in open corridors get the 5×5 splash; Rabbits blocked by walls just turn. The mechanic is visible and understandable, not just a stat change.

**Whale**: The artillery is strong and thematic. 100% appearance in R1 proved it was too powerful at cost 6/3s — raising to cost 8/5s fixed the dominance but Whale is still the strongest enabler. The mechanic is correct; the tuning took two rounds.

**Skunk**: Fear aura works mechanically (enemies really do redirect away) but its impact is subtle in the sim — enemies are redirected for one tick, then recover. The freeze spray (now 1.2s) is the dominant part of Skunk's kit. Fear aura is flavor that occasionally saves Skunk from a bad situation.

**Turtle**: Shell mode as-implemented is purely additive (extra ring paint when threatened). This was cleaner than the original "stop moving" design which killed paint output. The result is a pet that's stronger near enemies than away from them — interesting decision space about where to deploy it.

**Bear**: Brawl mode is mechanically correct (it does trigger and does speed Bear up) but Bear's 2×2 footprint means it rarely gets into melee packs on a 20×20 board before matches end. The mechanic works; the board geometry limits it. 3 comps vs the 4-comp target is the honest outcome.
