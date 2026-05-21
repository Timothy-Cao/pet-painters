# Balance Round 3 — Results & Analysis

**Date:** 2026-05-21
**Methodology change:** Switched from solo-pet WR to **team-comp WR** (average WR across all 3-pet comps containing the pet). This is the new primary balance signal.
**Baseline:** end-of-round-2 solo WR (solo metric — not directly comparable, but directionally useful)
**Post-round-3 report:** `report-2026-05-21_20-19-01-418-60pct.md`

---

## Context: new methodology

Round 3 is the first round using the team-comp sweep. 455 unique 3-pet comps (13 three-of-one + 156 two:one + 286 all-different), each playing 25 random opponents × 10 samples (5 each side) = 113,750 matches per run. The **team WR** metric reflects how strong a pet is when included in a real 3-pet lineup — the question players actually ask — rather than a degenerate 1v1 that never happens in real play.

Pre-round-3 team WR baseline (before changes):

| Pet | Pre-R3 Team WR |
|---|---|
| 🐻 Bear | 67.3% |
| 🦏 Rhino | 63.6% |
| 🐭 Mouse | 59.2% |
| 🦨 Skunk | 56.7% |
| 🐱 Cat | 54.5% |
| 🐢 Turtle | 49.8% |
| 🐰 Rabbit | 49.7% |
| 🦁 Lion | 49.0% |
| 🦅 Eagle | 48.2% |
| 🐘 Elephant | 45.6% |
| 🐉 Dragon | 39.9% |
| 🕷️ Spider | 37.3% |
| 🐳 Whale | 33.4% |

---

## Changes applied

| Pet | Change | Rationale |
|---|---|---|
| 🐻 Bear | cost 7 → **8** | At 67.3% team WR, Bear is the dominant comp anchor — 8 of the top 10 comps contain a bear. Bumping to cost 8 means at budget 20, a [bear, bear, X] requires X ≤ 4, cutting the viable 2-bear pairings. Triple-bear was already gone at cost 7; this further pressures double-bear stacking. |
| 🐳 Whale | cost 9 → **7** | At 33.4%, Whale is the roster's weakest pet by team WR. Being the most expensive (9) AND the slowest (0.4 tiles/s) means it almost never contributes before the match ends. Dropping cost to 7 lets players fit a Whale alongside a meaningful second pet (e.g., Whale + Rhino at 7+8 = 15 of 20 budget). |
| 🐉 Dragon | `atkSpeedPerSec` 0.5 → **0.75** | Dragon breathed every 2s — at that cadence, it often walked past enemies before a second breath fired. At 0.75/s (every 1.33s), it gets more reliable DPS on the same targets without stat or range changes. Already had a good synergy profile (+33% delta with Skunk); this amplifies its offensive presence. |

**Unchanged pets:** Mouse, Rhino, Skunk, Cat, Turtle, Rabbit, Lion, Eagle, Elephant, Spider.

---

## New tier list (round 3 results)

| Tier | Pet | Team WR | vs Pre-R3 Baseline | Delta |
|---|---|---|---|---|
| A | 🦏 Rhino | 64.9% | 63.6% | +1.3% |
| A | 🐭 Mouse | 57.1% | 59.2% | -2.1% |
| A | 🦨 Skunk | 55.7% | 56.7% | -1.0% |
| B | 🐻 Bear | 53.6% | 67.3% | **-13.7%** ✓ |
| B | 🐱 Cat | 53.4% | 54.5% | -1.1% |
| B | 🐉 Dragon | 52.2% | 39.9% | **+12.3%** ✓ |
| B | 🐢 Turtle | 50.4% | 49.8% | +0.6% |
| B | 🦁 Lion | 49.8% | 49.0% | +0.8% |
| B | 🐰 Rabbit | 47.4% | 49.7% | -2.3% |
| B | 🦅 Eagle | 46.2% | 48.2% | -2.0% |
| B | 🐘 Elephant | 45.5% | 45.6% | -0.1% |
| C | 🐳 Whale | 40.4% | 33.4% | **+7.0%** ✓ |
| D | 🕷️ Spider | 33.1% | 37.3% | -4.2% |

---

## Key callouts

### 1. Bear nerf landed cleanly

Bear dropped 13.7pp (67.3% → 53.6%) from cost 7→8. It's no longer the auto-include anchor. The top comps now show Rhino-double as the dominant pattern (`rhino+rhino+turtle`, `rhino+rhino+rabbit` at ~93-95%), meaning Rhino has inherited the top spot — exactly the "next-best inherits the throne" pattern from rounds 1-2.

### 2. Dragon went from C-tier to solid B — huge win

39.9% → 52.2% is a +12.3pp jump from a single fire-rate change. Dragon is now a legitimate B-tier comp member. The key insight: its fire cone mechanic was sound, it was just time-starved. At 0.75/s it gets ~3-4 breaths in a typical match vs 1-2 before. Synergy data confirms Dragon + Skunk is among the highest-delta pairs (+33%).

### 3. Whale improved but still C-tier

33.4% → 40.4% (+7pp) is progress. Whale is now playable — `lion+turtle+whale` and similar compositions lifted out of the absolute bottom. However, Whale's structural problem remains: it moves so slowly (0.4 tiles/s) that it paints very little territory before the match ends. The cost nerf helps it fit in comps but doesn't change the low-throughput problem. May need a speed tweak in a future round.

### 4. Spider dropped again (37.3% → 33.1%)

Spider fell despite no changes — this is a relative effect: as other pets improved, Spider's team WR naturally declined. Spider's absolute performance is unchanged, but the competition got stronger. This confirms Spider's mechanical ceiling: its radiant-paint output (~5 tiles every 2s) is real but the pet dies too quickly for it to matter in the team-comp context. Multiple spiders in a comp still show near-0% WR (the bottom comp is still `spider+spider+spider` at 0.0%).

### 5. Middle B-tier is now very healthy

Seven pets sit between 45-55% — Turtle, Lion, Rabbit, Eagle, Elephant all within a 5pp band. This is exactly what balanced looks like for the bulk of the roster. The problematic outliers are now only Rhino (top) and Spider (bottom).

---

## Round 4 recommendations

1. **Rhino (64.9%)**: Clear top outlier. `cost 8 → 9` — same cost as the old Whale, forcing a real choice between Rhino-double and a diverse comp. `atk 2 → 1` is an alternative but momentum damage makes the base atk less relevant; cost is the simpler lever.
2. **Spider (33.1%)**: Mechanically limited. The radiant paint fires, but 6 HP means it dies in 2 hits from anything with atk ≥ 3. Try `maxHp 6 → 12` — if it survives longer, the web + paint combo has time to matter.
3. **Whale (40.4%)**: C-tier improvement. Consider `speedTilesPerSec 0.4 → 0.6` in round 5 if cost-only changes aren't enough, but hold off for now.
4. **Mouse (57.1%)**: Watch closely — it crept up slightly as Bear was nerfed. At 57% it's still A-tier; no change needed yet.

---

## Verdict

Round 3 compressed the spread meaningfully. Before R3: 33.4% to 67.3% = 33.9pp spread. After R3: 33.1% to 64.9% = 31.8pp spread. 8 pets now sit in the 45-55% band. The two remaining problems (Rhino at top, Spider at bottom) are both addressable in round 4.
