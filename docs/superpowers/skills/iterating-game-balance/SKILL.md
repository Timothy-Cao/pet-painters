---
name: iterating-game-balance
description: Use when iterating game balance using a headless simulator, after a sim run produces a tier list, when deciding which pet stats/costs to change between balance rounds, when team-composition WR is the primary balance signal.
---

# Iterating Game Balance

## Overview

Apply minimal-lever balance changes between headless-sim rounds. The loop is: sim → tier list → identify outliers → smallest stat change per outlier → re-sim → compare deltas → repeat until spread is acceptable. Avoid mechanic changes until stat changes are exhausted; avoid touching middle-tier pets even if "they could use a tweak."

## When to Use

- After running a balance sim and getting a tier list with a wide spread (e.g., 5% to 90%).
- When you need to decide which pets to change and how much.
- When you're tempted to rewrite a pet's ability — STOP, try stats first.

## The Loop

1. Run `npm run balance`. Read the markdown report.
2. Identify outliers: top pets >65% team WR, bottom pets <35% team WR.
3. For each outlier, apply ONE change:
   - Top: cost +1 (most impactful). Stat reduction (hp, atk) only if cost change won't move the needle.
   - Bottom: cost -1, OR if stats can't move (e.g., already minimum), check if the ability is firing — possibly a mechanic fix needed.
4. Run tests (`npm test`) — must stay green.
5. Re-run sim. Compare new tier list with previous.
6. If spread is acceptable (~35-65% team WR for all pets), stop. Else, continue.

## Critical Principles

- **ONE change per pet per round.** Multiple changes obscure which lever moved the WR.
- **Cost > stats > mechanics.** Always try the simplest lever first.
- **Don't touch middle-tier pets.** They're balanced. Tweaking them just creates noise — and they often shift on their own as outliers are fixed.
- **After a top-tier pet is nerfed, the next-highest pet often inherits the throne.** Expect this — it's not a failure, it's signal. The round-after nerf must address the new top.
- **After a bottom-tier pet is buffed, it should rise. If it doesn't, the issue is mechanical, not numerical.** Spider was stat-buffed twice (cost, then radiant paint) and stayed bottom tier — the third intervention correctly identified the structural cause (dies too fast) rather than the numerical one.
- **Team WR is the real metric, not solo WR.** A pet that dominates 1v1 can be average in a real team context, and vice versa. The switch from solo to team-comp methodology changed Spider's apparent WR from 3.8% → 37.3% because in team comps, it's never the only unit — its web-denial has real value when paired with fighters.

## Quick Reference

| Symptom | Likely cause | First change to try |
|---|---|---|
| Pet at >70% team WR | Too cheap, too tanky, or too fast | cost +1 |
| Pet at <30% team WR | Dies before contributing | cost -1, OR hp +3-6 |
| Pet unchanged after stat tweak (e.g., 5% → 5%) | Mechanic not firing | inspect ability code, may need tuple change |
| One pet's nerf inflates another | Roster has a "second-best" being held in check | nerf the new top next round — this is normal |
| Bottom-tier pet with expensive cost | Even if buffed statwise, players can't afford it | cost reduction enables it to appear in more comps |
| Solo WR and team WR disagree sharply | Pet is situationally useful (depends on team context) | trust team WR as the real metric |

## Anti-patterns

- Changing 5+ pets at once — you lose the ability to attribute what moved the needle.
- Changing mechanics before stats — mechanics take longer to reason about and may break other things.
- Trying to fix the entire tier in one round — three 10pp improvements are better than one 30pp overcorrection.
- Tuning solo WR when team WR is the real metric — a pet that wins 1v1 may be dead weight in a real 3-pet comp.
- Lowering cost as the only lever for bottom-tier pets — if the mechanic has a ceiling (e.g., Spider's stationary position paints slowly regardless of how cheap it is), cost cuts produce diminishing returns.
- Doubling-down on the same lever when it failed the previous round — if splashPerSec +50% didn't move Turtle, the bottleneck is not paint frequency; look elsewhere.

## Sim Methodology (Pet Painters)

The team-comp sweep replaced the solo sweep starting in Round 3. Do not compare team WR to solo WR numbers directly — they measure different things.

**455 unique 3-pet comps:**
- 13 three-of-one `[X, X, X]`
- 156 two-one `[X, X, Y]` for every ordered (X, Y) pair where X ≠ Y
- 286 all-different `{X, Y, Z}` unordered triples (canonical alphabetical order)

**Per comp:** 25 random opponents × 10 samples (5 each side) = 250 samples per comp, 113,750 total matches. Runs in ~3-4 minutes on a modern Mac.

**Team WR for pet P:** weighted average of comp WR across all comps that contain P, weighted by sample count. Every pet appears in exactly 91 comps.

## Real-World Results (Pet Painters)

- **Rounds 1-2 (solo metric):** Bear and Elephant were tamed, but nerfing Bear revealed Rhino as the new top (89.2% solo). Spider remained broken (3.8% solo) despite stat changes.
- **Round 3 (team-comp methodology debut):** Bear dropped 13.7pp from cost nerf, Dragon jumped 12.3pp from fire-rate buff, Whale improved 7pp from cost reduction. Rhino emerged as top at 64.9%.
- **Round 4:** Rhino cost nerf brought it to 59.8%. Spider HP buff yielded modest +2pp (now 35.1% — confirmed ceiling on stat changes; need mechanic change for further improvement). 8 pets now sit in a 45-55% band.
- **Final spread (R4):** 35.1% to 59.8% = 24.7pp vs the starting spread of ~85pp. 11/13 pets in the 35-65% target range.

The principle confirmed by this campaign: **nerfing top doesn't fix bottom; each end of the tier list needs independent attention.**
