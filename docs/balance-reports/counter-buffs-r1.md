# Counter Buffs R1 — Findings Report

**Date:** 2026-05-21
**Sweep:** 455 comps × 15 opponents × 6 samples = 40,950 matches. Match cap 60s, stall 6s, energy budget 20.

---

## Counter changes applied

### Cat (cat.ts)
No functional change needed — Cat's existing pounce already delivers an instant kill to any adjacent mouse, which already exceeds "+2 damage." Description updated to make the mouse-counter role explicit.

### Skunk (skunk.ts)
**Before:** spray forced each orthogonal neighbour to face away (direction flip, no freeze).
**After:** spray freezes ALL enemies in front (via `enemiesInFront`) for 16 ticks (~0.8 s). This is a significant rework: Skunk now actively locks down the front rather than just redirecting enemies. Atk tuple unchanged.

### Lion (lion.ts)
**Rage mechanic (full implementation, not simplified):**
A module-level `rageBonus: Map<petId, number>` is incremented each time Lion deals lethal damage. Custom `lionAttack` action reads `def.atk + rage`, then increments rage on kill. First kill: 3 dmg, second: 4, third: 5, etc.

### Eagle (eagle.ts)
**Before:** 0 atk, no attack tuple, paint-only specialist.
**After:** atk 2, new `eagleTalon` tuple fires at 1/s; deals 2 dmg vs all enemies, **4 dmg vs 1×1 pets** (doubled). All 1×1 pets: Mouse, Cat, Eagle, Lion, Rabbit, Skunk, Spider, Rhino — so Eagle hard-counters the whole small-pet tier.

---

## Sim methodology changes

| Parameter | Before | After |
|---|---|---|
| `MAX_SECONDS` | 30 | 60 |
| `stallTicks` default | 4 × TICKS_PER_SEC (80) | 6 × TICKS_PER_SEC (120) |
| `TEAM_OPPONENTS` | 25 | 15 |
| `TEAM_SAMPLES` | 10 | 6 |
| Matches per comp | 250 | 90 |
| Total team-sweep matches | 113,750 | 40,950 |
| Energy final-pass (greedy cheapest) | No | Yes |
| Dedup assertion + log | No | Yes (Set keyed by `comp.join('|')`) |

---

## Before/After meta tier list

| Pet | Before Appearance | Before Tier | After Appearance | After Tier | Delta |
|---|---|---|---|---|---|
| 🦁 Lion | 0.0% | **Dead** | 100.0% | **Core** | +100.0% |
| 🐱 Cat | 37.8% | Core | 34.5% | Core | -3.3% |
| 🐭 Mouse | 67.6% | Core | 24.1% | Niche | **-43.5%** |
| 🦅 Eagle | 5.4% | Fringe | 24.1% | Niche | +18.7% |
| 🐢 Turtle | 24.3% | Niche | 17.2% | Niche | -7.1% |
| 🐻 Bear | 32.4% | Core | 13.8% | Niche | -18.6% |
| 🕷️ Spider | 16.2% | Niche | 10.3% | Niche | -5.9% |
| 🦏 Rhino | 10.8% | Niche | 10.3% | Niche | -0.5% |
| 🐉 Dragon | 35.1% | Core | 10.3% | Niche | -24.8% |
| 🦨 Skunk | 18.9% | Niche | 0.0% | **Dead** | -18.9% |
| 🐳 Whale | 8.1% | Fringe | 3.4% | Fringe | -4.7% |
| 🐰 Rabbit | 0.0% | Dead | 6.9% | **Fringe** | +6.9% |
| 🐘 Elephant | 10.8% | Niche | 0.0% | **Dead** | -10.8% |

---

## Did counters work? Specific numbers.

**Mouse dominance broken:** Mouse dropped from 67.6% → 24.1% (−43.5 pp). It fell from the #1 core pet to a mid-tier niche pick. The combination of Lion's rage (kills mice quickly, gains momentum) and Eagle's 4-dmg-vs-small talon are the primary causes.

**Lion revival:** Lion went from 0% (Dead) → 100% (Core, every single meta comp). The rage mechanic made it dominant — every Lion kill makes it stronger, turning a 3-damage hunter into a 4, 5, 6-damage monster mid-match. The synergy table confirms it: 7 of the top 10 pairs have Lion as the support.

**Eagle rise:** Eagle jumped from 5.4% (Fringe) → 24.1% (Niche). Adding a 2/4-dmg attack tuple transformed it from a pure painter to a real threat vs small pets.

**Rabbit escaped Dead:** Rabbit moved from 0% → 6.9% (Fringe). Two counter comps in the meta pool now include it: `eagle+lion+rabbit` (70% WR) and `cat+lion+rabbit` (63.3% WR). Lion carries Rabbit to relevance.

---

## New outliers created by the buffs

### Lion is now oppressively dominant (S tier, 69.5% team WR)
The rage mechanic overshot. Every top-20 comp contains Lion, and 29/29 meta pool comps contain Lion. This is essentially a new single-pet dominance replacing Mouse. The rage snowball compounds hard — once Lion gets a kill or two in a close midfield, it becomes nearly unkillable.

**Specific numbers:** Top comp is `lion+lion+bear` at 91.1% WR. 16 of the top 20 comps include at least one lion. Lion's 69.5% team WR is far above the next pet (Mouse 55.5%).

### Skunk regressed to Dead (0% appearance, 34.7% team WR)
The new skunk freeze only affects enemies "in front" — but Skunk walks at 1 tile/s and often ends up beside enemies, not behind them. Enemies approach from all directions, and the freeze-in-front mechanic has lower coverage than the old 360° spray. The old skunk was Niche at 18.9%; the new skunk never appears in any meta comp.

---

## Recommendation for next steps

### Immediate (before Phase 2 GA)

1. **Nerf Lion's rage**: Cap rage at +2 (so max damage is 5, not unbounded). Alternatively, reset rage on death or add a cooldown between rage increments. The mechanic works narratively but numbers are too strong.

2. **Buff Skunk back**: Revert to the old 360° spray OR change to freeze all orthogonal neighbours (not just `enemiesInFront`). The current rework made Skunk positionally dependent in a bad way. A simple fix: use `ORTHO_DELTAS` to check all 4 neighbours and apply freeze (same as old spray but freeze instead of redirect).

3. **Check Elephant**: Still dead (0%). It has decent peak WR (77.8%) but never reliably appears. Its cost-5 price point means it often can't appear alongside Lion (cost 4) in a budget-20 team. Consider reducing cost to 4 or adding a passive paint aura.

4. **Cat is fine**: 34.5% appearance, A-tier team WR (55.0%). The description update is sufficient — no further buff needed.

### Phase 2 (GA)
With Lion dominant, the GA would likely converge on Lion-heavy comps. Consider running it after the Lion nerf to get more diverse exploration. The GA should use the same energy-final-pass greedy fill added in 2a to ensure full energy utilization across generations.
