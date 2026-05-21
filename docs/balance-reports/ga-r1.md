# Coevolutionary GA — Balance Report (Round 1)

**Date:** 2026-05-21
**Seed:** 20260521 | **Generations:** 6 | **Pop size:** 50 | **Samples/matchup:** 4
**Total matches:** ~60,000 | **Wall time:** 86.2s

## Top 10 most-frequent OFFENSE comps (smoothed over last 5 gens)

| Rank | Comp | Offense Freq | Defense Freq |
|---|---|---|---|
| 1 | 🐘+🐢+🐉 (elephant+turtle+dragon) | 8.0% | 0.0% |
| 2 | 🐘+🦁+🐻 (elephant+lion+bear) | 6.0% | 0.0% |
| 3 | 🐘+🐘+🐘 (elephant+elephant+elephant) | 4.0% | 0.0% |
| 4 | 🐘+🐘+🦏 (elephant+elephant+rhino) | 4.0% | 0.0% |
| 5 | 🐻+🐘+🦏 (bear+elephant+rhino) | 4.0% | 14.0% |
| 6 | 🐳+🐘+🐱 (whale+elephant+cat) | 4.0% | 0.0% |
| 7 | 🐱+🐢+🐉 (cat+turtle+dragon) | 4.0% | 0.0% |
| 8 | 🐭+🐳+🐻 (mouse+whale+bear) | 4.0% | 0.0% |
| 9 | 🦏+🦁+🐱 (rhino+lion+cat) | 4.0% | 0.0% |
| 10 | 🐻+🐱+🦏 (bear+cat+rhino) | 2.0% | 2.0% |

## Top 10 most-frequent DEFENSE comps (smoothed over last 5 gens)

| Rank | Comp | Defense Freq | Offense Freq |
|---|---|---|---|
| 1 | 🐻+🐘+🦏 (bear+elephant+rhino) | 14.0% | 4.0% |
| 2 | 🐻+🐱+🐉 (bear+cat+dragon) | 12.0% | 0.0% |
| 3 | 🐻+🐱+🐱 (bear+cat+cat) | 10.0% | 0.0% |
| 4 | 🐻+🐱+🐘 (bear+cat+elephant) | 8.0% | 0.0% |
| 5 | 🐱+🐘+🐉 (cat+elephant+dragon) | 6.0% | 2.0% |
| 6 | 🐻+🐱+🐢 (bear+cat+turtle) | 6.0% | 0.0% |
| 7 | 🐉+🐱+🦏 (dragon+cat+rhino) | 4.0% | 2.0% |
| 8 | 🦏+🐘+🐱 (rhino+elephant+cat) | 4.0% | 2.0% |
| 9 | 🐻+🐱+🐻 (bear+cat+bear) | 4.0% | 0.0% |
| 10 | 🐻+🐘+🐻 (bear+elephant+bear) | 4.0% | 0.0% |

## Per-pet appearance rate in final GA populations

| Pet | Offense Pop | Defense Pop | Combined |
|---|---|---|---|
| 🐻 Bear | 38.0% | 88.0% | 63.0% |
| 🐘 Elephant | 70.0% | 46.0% | 58.0% |
| 🐱 Cat | 26.0% | 54.0% | 40.0% |
| 🦏 Rhino | 24.0% | 42.0% | 33.0% |
| 🐉 Dragon | 34.0% | 18.0% | 26.0% |
| 🐢 Turtle | 26.0% | 2.0% | 14.0% |
| 🦁 Lion | 24.0% | 4.0% | 14.0% |
| 🐭 Mouse | 4.0% | 8.0% | 6.0% |
| 🐳 Whale | 8.0% | 0.0% | 4.0% |
| 🦨 Skunk | 0.0% | 6.0% | 3.0% |
| 🐰 Rabbit | 4.0% | 0.0% | 2.0% |
| 🕷️ Spider | 2.0% | 2.0% | 2.0% |
| 🦅 Eagle | 0.0% | 0.0% | 0.0% |

## Comparison to brute-force meta sweep

Top GA offense comps vs brute-force top-WR comps:

- 🐘+🐢+🐉 (elephant+turtle+dragon) — GA-only discovery
- 🐘+🦁+🐻 (elephant+lion+bear) — GA-only discovery
- 🐘+🐘+🐘 (elephant+elephant+elephant) — GA-only discovery
- 🐘+🐘+🦏 (elephant+elephant+rhino) — GA-only discovery
- 🐻+🐘+🦏 (bear+elephant+rhino) — GA-only discovery
- 🐳+🐘+🐱 (whale+elephant+cat) — GA-only discovery
- 🐱+🐢+🐉 (cat+turtle+dragon) — GA-only discovery
- 🐭+🐳+🐻 (mouse+whale+bear) — GA-only discovery
- 🦏+🦁+🐱 (rhino+lion+cat) — GA-only discovery
- 🐻+🐱+🦏 (bear+cat+rhino) — GA-only discovery

GA offense recovered 0/10 brute-force top comps.

Brute-force top comps NOT in GA top-10 offense:
- 🐭+🐭+🐭 (mouse+mouse+mouse) WR=88.2%
- 🐻+🐱+🐭 (bear+cat+mouse) WR=86.8%
- 🐭+🐭+🐱 (mouse+mouse+cat) WR=86.0%
- 🐱+🐘+🐭 (cat+elephant+mouse) WR=84.6%
- 🐱+🐭+🐢 (cat+mouse+turtle) WR=84.4%
- 🐱+🦁+🐭 (cat+lion+mouse) WR=84.0%
- 🦁+🐭+🦨 (lion+mouse+skunk) WR=84.0%
- 🐘+🐭+🐢 (elephant+mouse+turtle) WR=83.6%
- 🐭+🐢+🐳 (mouse+turtle+whale) WR=83.2%
- 🐱+🐭+🦨 (cat+mouse+skunk) WR=82.8%

## Per-generation fitness curve

| Gen | Top Off | Top Def | Mean Off | Mean Def | Top Off Comp | Top Def Comp |
|---|---|---|---|---|---|---|
| 1 | 70.3% | 75.3% | 50.1% | 49.9% | 🦏+🐘+🐘 | 🐱+🦏+🐘 |
| 2 | 65.3% | 70.5% | 48.6% | 51.4% | 🐭+🐻+🦁 | 🐻+🐱+🐱 |
| 3 | 56.0% | 72.2% | 45.1% | 54.9% | 🐳+🐻+🐢 | 🐻+🐱+🐱 |
| 4 | 59.0% | 73.3% | 43.1% | 56.9% | 🐘+🐘+🐉 | 🐻+🐱+🐻 |
| 5 | 58.5% | 67.3% | 44.9% | 55.1% | 🐘+🐘+🐘 | 🐻+🐱+🐉 |
| 6 | 57.3% | 66.3% | 43.9% | 56.1% | 🐻+🐢+🐉 | 🐻+🐻+🦁 |

## Takeaways

1. **Dominant pets (≥70% appearance):** 🐘 Elephant, 🐻 Bear. These over-index in GA and may need a cost increase or ability nerf.
2. **Absent pets (0% in final pops):** 🦅 Eagle. GA never selected them — they are fundamentally undertuned relative to budget.
3. **GA convergence:** Mean offense fitness improved by -6.1pp from gen 1 to gen 6, indicating genuine selection pressure.
4. **Nash-like stable comps:** 🐻+🐘+🦏 appear in both top-10 offense AND defense, suggesting they are close to Nash-equilibrium strategies.
5. **Best final comp:** Offense: 🐘+🐘+🐉 (fitness 56.0%), Defense: 🐻+🐱+🐉 (fitness 67.0%).

## Balance verdict

**GA triggered follow-up:** One or more pets exceed the 70% / 0% threshold.

Recommended nerfable pets (>70% appearance):
- 🐘 Elephant (off: 70%, def: 46%) — consider cost +1 or ability cap
- 🐻 Bear (off: 38%, def: 88%) — consider cost +1 or ability cap

Recommended buffable pets (0% appearance):
- 🦅 Eagle (cost 3) — consider cost -1 or small ability buff
