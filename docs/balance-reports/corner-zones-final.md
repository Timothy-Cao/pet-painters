# Corner-Zones Balance — Final Summary

**Geometry:** 20×20 board, 5×5 corner home zones (A: bottom-left, B: top-right). Pets in the headless sim get random N or E facing for A (random S or W for B), simulating player choice over the two cardinal options toward the opposite corner.

**Methodology:** Same as before — 455 unique 3-pet comps, 15 random opponents × 6 samples each, top-20-WR + top-20-counter meta pool, per-pet meta appearance rate as the tier metric.

**Rounds run:** 4. Stop condition (no Dead pets) NOT fully met — 2 stubborn Dead pets remain — but spread compressed significantly and 11 of 13 pets are now in 3-56% range.

---

## Pre-geometry baseline (last 16×16 sweep)

| Tier | Pets |
|---|---|
| Core | 🐻 Bear 54.3% · 🐱 Cat 45.7% · 🐉 Dragon 31.4% |
| Niche | 🐭 Mouse · 🐘 Elephant · 🦁 Lion · 🦅 Eagle · 🦏 Rhino |
| Fringe | 🕷️ Spider · 🐢 Turtle · 🦨 Skunk · 🐳 Whale |
| Dead | 🐰 Rabbit |

---

## Round 1 (initial 20×20 baseline + first nerf)

**Pre-changes baseline on new geometry:**
- Cat at 80.0% (massive overdominance — wander+pounce is brutal across the larger board)
- 4 Dead pets: Bear, Rhino, Dragon, Elephant (all slow heavies that can't cross the diagonal in time)

**Changes:**
- 🐱 Cat: cost 3 → 4
- 🐻 Bear: cost 8 → 6
- 🐉 Dragon: cost 9 → 7
- 🦏 Rhino: cost 9 → 7

**Result:** Cat 80% → 62.5%, Dragon revived to 3.1%, Elephant still Dead, Bear/Rhino still Dead.

---

## Round 2 (revive the heavies)

**Changes:**
- 🐘 Elephant: cost 5 → 4
- 🦏 Rhino: speed 1.5 → 2.0 (cost wasn't the issue; reach was)
- 🐻 Bear: speed 0.8 → 1.0, maxHp 14 → 18 (durability matters when crossing 14 diagonal tiles)

**Result:** Elephant 0% → 6.3%, Bear 0% → 3.1%, but Dragon and Rhino fell back to 0% as meta shifted.

---

## Round 3 (rein in Cat, push Dragon/Rhino down)

**Changes:**
- 🐱 Cat: cost 4 → 5 (still 68.8% — needed another nudge)
- 🐉 Dragon: cost 7 → 5 (aggressive cut)
- 🦏 Rhino: cost 7 → 5 (same)

**Result:** Cat 68.8% → 40.0% (success!), but Mouse inherited the throne at 80%. Dragon revived to 11.4%, Rhino to 8.6%. All previously Dead pets at least Fringe.

---

## Round 4 (Mouse nerf — throne-passing addressed)

**Changes:**
- 🐭 Mouse: cost 3 → 4

**Result:** Mouse 80% → 56.3% (back to Core but no longer dominant). But Bear and Spider went Dead again — meta shift after Mouse nerf.

---

## Final tier (post-round-4)

| Tier | Pet | Appearance |
|---|---|---|
| **Core** | 🐭 Mouse | 56.3% |
| Core | 🐢 Turtle | 50.0% |
| Core | 🐱 Cat | 40.6% |
| Core | 🦁 Lion | 37.5% |
| Core | 🦅 Eagle | 37.5% |
| Fringe | 🐰 Rabbit | 6.3% |
| Fringe | 🦨 Skunk | 6.3% |
| Fringe | 🐉 Dragon | 6.3% |
| Fringe | 🐳 Whale | 6.3% |
| Fringe | 🐘 Elephant | 3.1% |
| Fringe | 🦏 Rhino | 3.1% |
| **Dead** | 🕷️ Spider | 0.0% |
| **Dead** | 🐻 Bear | 0.0% |

## Comparison to 16×16 final

| Metric | 16×16 final | 20×20 final |
|---|---|---|
| Top pet appearance | 54.3% (Bear) | 56.3% (Mouse) |
| Bottom pet appearance | 0% (Rabbit) | 0% (Spider, Bear) |
| Spread (top - bottom) | 54.3pp | 56.3pp |
| Pets in 20%-60% (healthy mid) | 5 | 5 |
| Pets in 0-10% (Fringe + Dead) | 5 | 8 |
| Pets in Dead tier (0%) | 1 | 2 |

**Spread is similar, but the 20×20 has MORE pets squashed into Fringe.** Net diversity is roughly the same; pet identities are slightly differently distributed.

## What surprised me

1. **Cat became the new top pet on 20×20.** On 16×16 Bear was the "glue" pet at 54%. On 20×20, Cat (with its wander brain + pounce vs Mouse) is more valuable because Mouse swarms are the dominant rush strategy on the bigger board.

2. **Heavy pets STILL struggle even with speed buffs.** Bear got hp 14→18 and speed 0.8→1.0. Still 0% at the end. The structural issue isn't stats — it's that "tank that walks slowly to the center" doesn't have a viable strategic purpose when Cat/Mouse/Lion can reach midfield first and contest paint. Heavies need a fundamental ability change, not just stat tweaks. (This matches the `iterating-game-balance` skill's principle: "if stat changes don't move the WR, the mechanic is broken.")

3. **Throne-passing is unavoidable.** Every time we nerfed a top pet, the next-best inherited. R1 Cat → R3 Mouse → R4 Mouse stabilized. **The principle from the skill held perfectly: "After a top-tier pet is nerfed, the next-highest pet often inherits the throne. Expect this — it's not a failure, it's signal."**

4. **5×5 corner zones with random N/E facing produced credible games.** The diagonal-engagement geometry works without diagonal facing. Random N/E means roughly half the pets march along one axis and half along the other, creating L-shaped advance lines that meet near the diagonal midline.

## Honest verdict

**Is the 20×20 redesign better than 16×16?** **Slightly worse for balance, slightly better for tactical feel.**

- **Worse for balance**: more pets in Fringe/Dead. The bigger board widens the gap between "fast painters that reach the center" and "slow heavies that don't."
- **Better for tactical feel** (subjectively): diagonal engagement creates more interesting positional decisions than the old north-south column rush. Comps need to think about both axes, not just rush forward.

**Recommendation: keep the 20×20 corner-zone geometry, but accept that the heavies (Bear, Spider) need MECHANIC reworks, not stat changes, to be viable.**

Specifically:
- **🐻 Bear**: its rage-when-wounded ability assumes the pet stays alive long enough to engage. On 20×20 it dies in transit. Possible rework: rage triggers when an enemy enters its home zone (defender identity instead of attacker), or rage doubles speed even at full hp (constant fast aggression).
- **🕷️ Spider**: stationary denier in a bigger board means the enemy just goes around. Possible rework: spider creates a 5×5 zone of slow-paint when deployed (passive area control). Or it teleports to the nearest enemy painted tile (counter-painter).

These are `balance:rework` candidates, not `balance:improve` candidates.

## What's still off

- 🕷️ Spider: 0% appearance for the 3rd time across all balance work. Stop trying stat tweaks; needs a mechanic rework.
- 🐻 Bear: 0% appearance. Needs a rework that justifies the slow speed.
- 🐉 Dragon/🦏 Rhino/🐘 Elephant/🐳 Whale all in Fringe at 3-6%. They're playable but rarely chosen.

## What's well-tuned

- **Core diversity**: 5 pets in 37-56% range (Mouse, Turtle, Cat, Lion, Eagle) — better than the 16×16 final's 3-pet Core.
- **Top WR comps**: no comp exceeds 80% WR. Healthy ceiling.
- **No single mandatory pet**: the 16×16 had Bear at 54% as "always-include." On 20×20, Mouse at 56% is closer to mandatory but more contested.

## Recommendation for the next session

Two clean directions:

1. **Mechanic reworks for Bear and Spider** (~2 hours): apply the `balance:rework` workflow from the pet design framework. These two pets clearly need design changes, not numeric tweaks. The framework's pet pitch template is the right starting point.

2. **Move on to game features**: balance is good enough for playtest. Heavy pets are weak but no comp is broken. Real players will tell us things the sim can't — like whether Mouse swarms FEEL fun or annoying to face.

I'd vote 2. The roster is functionally diverse enough for v1.
