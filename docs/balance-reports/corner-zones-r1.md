# Corner-Zones Balance — Round 1

**Geometry:** 20×20 board, 5×5 corner home zones (A: bottom-left, B: top-right)
**Baseline sweep:** report-2026-05-21_22-53-43-428-60pct.md

---

## Baseline meta (pre-round-1)

| Meta Tier | Pet | Appearance |
|---|---|---|
| Core (overdominant) | 🐱 Cat | 80.0% |
| Core | 🐭 Mouse | 40.0% |
| Core | 🦁 Lion | 33.3% |
| Core | 🦅 Eagle | 30.0% |
| Niche | 🐢 Turtle | 26.7% |
| Dead | 🐘 Elephant | 0.0% |
| Dead | 🐻 Bear | 0.0% |
| Dead | 🦏 Rhino | 0.0% |
| Dead | 🐉 Dragon | 0.0% |

**Issues identified:**
- Cat at 80% — massively overdominant (threshold: >60%)
- Four dead pets — all slow/large heavies (Elephant, Bear, Rhino, Dragon)
- Root cause: 20×20 board rewards fast painters that can reach the center; slow 2×2 pets never cross in time

---

## Changes applied

| Pet | Stat | Before | After | Rationale |
|---|---|---|---|---|
| 🐱 Cat | cost | 3 | 4 | 80% appearance — too cheap for its strong wander+pounce kit |
| 🐻 Bear | cost | 8 | 6 | Dead at 0%; 8 cost too expensive, rarely worth deploying |
| 🐉 Dragon | cost | 9 | 7 | Dead at 0%; AOE cone is strong but comp slot cost was prohibitive |
| 🦏 Rhino | cost | 9 | 7 | Dead at 0%; momentum mechanic wasted without affordability |

---

## Post-round-1 meta (report-2026-05-21_23-00-13-204-60pct.md)

| Meta Tier | Pet | Appearance |
|---|---|---|
| Core | 🐱 Cat | 62.5% |
| Core | 🐭 Mouse | 59.4% |
| Core | 🐢 Turtle | 34.4% |
| Niche | 🦁 Lion | 25.0% |
| Niche | 🦅 Eagle | 25.0% |
| Fringe | 🐰 Rabbit | 12.5% |
| Fringe | 🐳 Whale | 9.4% |
| Fringe | 🕷️ Spider | 6.3% |
| Fringe | 🦨 Skunk | 3.1% |
| Fringe | 🐉 Dragon | 3.1% |
| Dead | 🐘 Elephant | 0.0% |
| Dead | 🐻 Bear | 0.0% |
| Dead | 🦏 Rhino | 0.0% |

**Assessment:**
- Cat dropped from 80% → 62.5% — still borderline core but no longer smothering the meta
- Mouse rose to 59.4% — forms a strong dual-core with Cat
- Dragon got 1 comp into the pool (dragon+dragon+mouse = 84.4% WR!) — cost cut worked
- Bear and Rhino cost cuts (8→6, 9→7) were not enough: still 0% appearance
- Elephant untouched — still dead

**Stop condition not met:** 3 dead pets remain (Elephant, Bear, Rhino). Cat at 62.5% is borderline but acceptable for now. Proceeding to round 2.
