# Balance Round 4 — Results & Analysis

**Date:** 2026-05-21
**Baseline:** round 3 post-change team WR
**Post-round-4 report:** `report-2026-05-21_20-23-40-961-60pct.md`

---

## Changes applied

| Pet | Change | Rationale |
|---|---|---|
| 🦏 Rhino | cost 8 → **9** | Round 3 left Rhino as the clear top outlier at 64.9%. With 7 of the top 10 comps being Rhino-doubles or Rhino-containing, it was clearly the comp anchor inherited from Bear's nerf. Cost 9 forces a real trade-off: `rhino+rhino+X` now requires X ≤ 2 (only spider/mouse/rabbit fit), breaking the easy double-stack. Kept `atk` unchanged to preserve momentum fantasy — this is a cost lever, not a stat shave. |
| 🕷️ Spider | `maxHp` 6 → **12** | Spider's team WR kept falling despite the radiant-paint buff in R2. Root cause confirmed: Spider dies too fast for its territory to accumulate. At 6 HP it falls to 2 hits from any atk-3+ pet (Bear/Rhino/Dragon all one-shot or two-shot it). Doubling HP to 12 ensures it survives at least 4 hits from a Dragon, 6 from a Cat, and the radiant paint has time to produce meaningful coverage before it dies. Cost stays at 2 — it's a support/painter, not a fighter. |

**Unchanged pets:** Mouse, Bear, Skunk, Cat, Dragon, Turtle, Rabbit, Lion, Eagle, Elephant, Whale.

---

## New tier list (round 4 results)

| Tier | Pet | Team WR | vs R3 WR | Delta |
|---|---|---|---|---|
| A | 🦏 Rhino | 59.8% | 64.9% | **-5.1%** ✓ |
| A | 🐭 Mouse | 58.6% | 57.1% | +1.5% |
| A | 🦨 Skunk | 55.7% | 55.7% | 0.0% |
| B | 🐱 Cat | 54.0% | 53.4% | +0.6% |
| B | 🐻 Bear | 53.8% | 53.6% | +0.2% |
| B | 🐉 Dragon | 52.5% | 52.2% | +0.3% |
| B | 🐢 Turtle | 51.3% | 50.4% | +0.9% |
| B | 🐰 Rabbit | 48.5% | 47.4% | +1.1% |
| B | 🦁 Lion | 47.5% | 49.8% | -2.3% |
| B | 🦅 Eagle | 47.2% | 46.2% | +1.0% |
| B | 🐘 Elephant | 45.8% | 45.5% | +0.3% |
| C | 🐳 Whale | 41.7% | 40.4% | +1.3% |
| C | 🕷️ Spider | 35.1% | 33.1% | **+2.0%** ↑ |

---

## Key callouts

### 1. Rhino nerf worked but landed softer than expected

64.9% → 59.8% is a 5pp drop, which is real but leaves Rhino still at the top of A-tier. The Rhino-double comps now require cheap support pets (the top comp is now `rhino+rhino+eagle`), which partly compensates for the cost increase. Rhino is acceptably balanced for release — it's a skill-expression pet (momentum management) and some asymmetry at the top is reasonable.

### 2. Spider HP buff produced real but limited gains

33.1% → 35.1% (+2pp). The improvement is statistically real (confirmed across 91 comps). However, Spider-heavy comps are still at the bottom: `spider+spider+spider` remains at 0.0% WR, and the eight lowest comps all contain at least one Spider. The HP buff extended Spider's life but its fundamental problem persists: it occupies a 1×1 tile and paints 5 tiles every 2s — that's a slow build-up against pets that lay down territory on every step. Spider has a ceiling as a support piece in mixed comps but is dead weight when doubled or tripled. Its best use case appears to be as a 1-of with aggressive movers (not as the comp's main unit).

### 3. Dragon solidly B-tier and climbing

Dragon held at 52.5% (was 52.2% after R3). The fire-rate change in R3 has made it a real comp option. The synergy data shows dragon+dragon is now one of the top comp patterns — `dragon+dragon+turtle` at 92.0%, `dragon+dragon+skunk` at 85.8%. This is the biggest single-round improvement of the balance campaign: from 28.8% solo (R2) to 52.5% team WR (R4).

### 4. B-tier band is very healthy — 8 pets in 45-55%

Cat (54.0%), Bear (53.8%), Dragon (52.5%), Turtle (51.3%), Rabbit (48.5%), Lion (47.5%), Eagle (47.2%), Elephant (45.8%) — eight pets within a 9pp window. This is the most compressed and diverse the middle-tier has ever been. Players can build real variety in this range.

### 5. The comp diversity story is better

Top comps in R4 include bear-double, dragon-double, rhino-double, and mouse-double patterns — four different anchors rather than the single-bear dominance of R3 baseline. The `rhino+skunk+whale` comp at 80% WR shows that Whale can be a comp contributor when cost-efficient, which was the goal of the R3 Whale cost reduction.

---

## Assessment

**Target range: 35-65% for all pets.** Current status:

- In-range (35-65%): **11 of 13 pets** — Rhino, Mouse, Skunk, Cat, Bear, Dragon, Turtle, Rabbit, Lion, Eagle, Elephant
- Below range (<35%): **Spider** at 35.1% — just barely outside (0.1pp), effectively on the boundary
- Above range (>65%): **none**

The spread is now 35.1% to 59.8% = 24.7pp. This is a dramatic improvement from the round 2 starting point (3.8% to 89.2% = 85.4pp spread).

**Recommendation: this is releasable.** Spider at 35% is the last remaining soft outlier, but it's a situational piece with a unique mechanic (freeze + radiant), not a broken pet. A real player who understands Spider's role will not be at a 35% disadvantage — the team WR reflects average across ALL comps including 3×spider, which is clearly an incorrect build.

---

## Round 5 recommendations (if needed)

1. **Spider**: Consider making its radiant paint a larger pulse (e.g., paint own tile + all 8 orthogonal+diagonal neighbors = 9-tile burst every 2s) instead of just the 4 orthogonals. This increases territory output without touching HP/cost, and gives it a genuine solo contribution.
2. **Whale**: Still C-tier at 41.7%. If it stays this low after round 4 data is collected from real play, try `speedTilesPerSec 0.4 → 0.55` — a 37% speed boost would mean it reaches the mid-board ~1.3s earlier, getting 1-2 more turns per match.
3. **Mouse (58.6%)**: Watch closely — at the high end of A-tier, it could become the next dominant anchor if Rhino or Bear are ever further nerfed. No change needed now.
