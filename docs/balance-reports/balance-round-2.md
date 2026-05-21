# Balance Round 2 — Results & Analysis

**Date:** 2026-05-21
**Baseline report:** `report-2026-05-21_19-12-48-738-60pct.md` (end of round 1)
**Post-change report:** `report-2026-05-21_19-17-20-238-60pct.md`

---

## Changes applied

One change per pet except Spider (which received both a mechanical fix and a stat addition).

| Pet | Change | Rationale |
|---|---|---|
| 🐻 Bear | cost 6 → **7** | At 90.7% WR, Bear was the new Mouse — too cheap to be triple-stacked. +1 cost reduces spam (budget 20 → max 2 bears at cost 7, same floor as before, but it now competes harder for budget with a Rhino or Elephant). Kept atk/hp unchanged to preserve rage-mode identity. |
| 🕷️ Spider | Added `radiantPerSec: 0.5` — every 2 s, Spider paints its own tile and all 4 orthogonal neighbors | Cost changes did nothing (5.8% → 5.8% after round 1). Root cause: Spider is stationary AND paints zero tiles by itself, so it has no intrinsic territory contribution when enemies walk around it. The radiant paint gives it a 5-tile footprint every 2 s while keeping its "web-denial chokepoint" identity intact. |
| 🐉 Dragon | `breathRange` 2 → **3** | Dragon's 2-tile cone meant it almost never landed a hit before contact. Extending to 3 tiles makes the cone 2×3 (six tiles), giving it genuine reach to soften enemies before they close. No cost change — at cost 8 it's still the premium option. |
| 🐢 Turtle | `splashPerSec` 1 → **1.5** | Turtle's design is all about area painting while being a slow walker. Collateral damage from round 1 brought it to 25.5% WR; the more-frequent splash (every 0.67 s instead of 1 s) lets it lay down paint faster to compensate for low speed. Keeps cost at 4. |
| 🐘 Elephant | cost 5 → **6** | 73.9% borderline S-tier with 100% WR vs Cat, Rabbit, Turtle, Eagle, Dragon, Whale — too many free wins at the cheap cost-5 slot. +1 cost (budget 20 → 3 elephants instead of 4) nudges it toward the B range. |

**Unchanged pets:** Mouse, Rhino, Skunk, Lion, Cat, Eagle, Whale, Rabbit.

---

## New tier list with deltas vs round 1

| Tier | Pet | Round 2 WR | Round 1 WR | Delta |
|---|---|---|---|---|
| S | 🦏 Rhino | 89.2% | 77.2% | **+12.0%** (now top — see callout 1) |
| S | 🐭 Mouse | 72.2% | 67.0% | +5.2% |
| A | 🦨 Skunk | 64.3% | 57.5% | +6.8% |
| A | 🐻 Bear | 63.6% | 90.7% | **-27.1%** ✓ |
| A | 🦁 Lion | 60.4% | 57.1% | +3.3% |
| A | 🐱 Cat | 55.5% | 50.9% | +4.6% |
| B | 🐘 Elephant | 51.5% | 73.9% | **-22.4%** ✓ |
| B | 🦅 Eagle | 48.5% | 38.7% | +9.8% |
| C | 🐳 Whale | 42.0% | 39.8% | +2.2% |
| C | 🐰 Rabbit | 37.2% | 35.4% | +1.8% |
| C | 🐉 Dragon | 35.1% | 28.8% | **+6.3%** ✓ |
| D | 🐢 Turtle | 25.3% | 25.5% | -0.2% (flat) |
| D | 🕷️ Spider | 3.8% | 5.8% | -2.0% (worse — see callout 5) |

---

## Key callouts

### 1. Bear nerf landed clean — but Rhino emerged as the new #1
Bear dropped 27pp (90.7% → 63.6%), exactly as hoped. However, Rhino shot from 77.2% → **89.2%**, taking the crown. Rhino now goes 100% vs Bear (Bear previously kept Rhino in check at that budget slot). It also has no real counter: its best matchup against it is Mouse at 54.5% — barely above a coin flip. Round 3 must address Rhino.

### 2. Elephant cost nerf worked perfectly
73.9% → **51.5%** — a 22pp drop. Elephant is now squarely in the B tier as intended. It still has its "immovable tank" identity and good matchups vs small painter pets, but it's no longer an auto-include at every budget level. The cost-6 slot now forces a real choice between Elephant and Bear (both cost 6–7).

### 3. Dragon improvement is real but still C-tier
28.8% → **35.1%** (+6.3pp). The wider breath cone lets Dragon actually deal damage before contact. It now goes 100% vs Turtle (previously inconsistent) and 100% vs Dragon mirror match paint score improved to 68 tiles (same as Bear and Rhino). Still a D/C-border pet, but Dragon now has a playable niche in comps paired with disruption.

### 4. Turtle did not respond to the splash buff
25.5% → **25.3%** — essentially flat despite increasing splash frequency 50%. Root cause: Turtle's losses are structural. It goes 0% vs Lion, 0% vs Rhino, 0% vs Bear. Its splash radius is only 4 tiles per pulse, which cannot overcome aggressive melee pets closing distance. The splash-rate lever does nothing if the pet is killed before it gets enough pulses. A HP buff or cost reduction to 3 is needed in round 3.

### 5. Spider passive paint backfired (or wasn't enough)
5.8% → **3.8%** — mirror score improved (48 → 53 tiles, confirming the radiant paint fires), but its solo WR dropped. The radiant paint generates territory but also "advertises" the spider's position, making enemies prioritize destroying it. At 6 HP and cost 2, it's too fragile for the territory it generates to matter before it dies. Round 3 options: HP 6 → 10, or keep the radiant but lower cost to 1 so you can run a dense web of spiders that collectively cover more ground.

---

## Round 3 recommendations

Priority order:

1. **Rhino** (89.2%): Now the top problem. Try `atk 2 → 1` base (max momentum damage stays at 7) — this blunts non-momentum hits without touching the charge fantasy.
2. **Spider** (3.8%): Radiant paint is the right direction but the spider dies too fast. Try `maxHp 6 → 10` so it survives long enough for the territory to matter.
3. **Turtle** (25.3%): Splash-rate lever did nothing. Try `cost 4 → 3` (can deploy 6 instead of 5 per budget) OR `maxHp 8 → 12` to let it weather some combat.
4. **Mouse** (72.2%): Crept back up +5pp after Elephant nerf removed its hardest counter. Still below S-tier threshold, but worth watching. May need cost 3 → 4 if Rhino is fixed and Mouse stays this high.
5. **Skunk** (64.3%): Moved to A-tier without a change. It now counters both Elephant (100%) and Bear (82%), which is a new and powerful role. No change needed yet, but flag for round 3 observation.

---

## Verdict: needs round 3

The roster made meaningful progress — Bear and Elephant both came down dramatically, A-tier is now genuinely diverse (Skunk, Bear, Lion, Cat all in 55–65%), and Dragon is at least usable. However:

- **Rhino is now the dominant pet** at 89.2% with no hard counter.
- **Spider and Turtle remain D-tier** — two out of thirteen pets are non-functional, which is too many.
- The target range for a "balanced" roster is roughly 35–70% for all pets; currently 5/13 pets sit outside that range (Rhino above, Spider/Turtle/Rabbit/Dragon below).

**Round 3 is needed** to fix Rhino, give Spider survivability, and address Turtle. After round 3, the roster should be in a releasable state.
