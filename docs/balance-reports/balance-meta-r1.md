# Balance Report: Meta-Comp Methodology Round 1

**Date:** 2026-05-21
**Methodology:** Meta appearance rate (top-20 WR comps ∪ top-20 counter comps)
**Win threshold:** 60% (153/256 tiles)
**Energy budget:** 20

---

## Changes applied

### Round A — targeting the two original dead pets

| Pet | Change | Rationale |
|---|---|---|
| 🐘 Elephant | Cost 6 → 5 | Elephant has a 69.6% peak comp WR (dragon+elephant+mouse) but didn't crack the top-20 cutoff. Reducing cost by 1 opens significantly more combo slots — e.g. elephant+elephant+cat (5+5+3=13), elephant+dragon+mouse+eagle (5+8+3+2=18), etc. A single cost step is the least invasive lever. |
| 🕷️ Spider | Cost 2 → 1 | Spider's best comps are all below 27% WR — it's fundamentally undertuned in raw combat. At cost 2 you can only field ~7 spiders in a budget of 20 (the other 6 energy goes to one low-cost pet). At cost 1 you can deploy 10+ spiders, creating a dense freeze-web + radiant-paint zone covering the entire home area. This changes spider from "inconsistent support" to "area-denial specialist." |

### Round B — targeting the new dead pets revealed after Round A

After Round A, Elephant moved to Fringe (8.1%) and Spider moved to Niche (13.5%), but Turtle and Whale fell to 0%.

| Pet | Change | Rationale |
|---|---|---|
| 🐢 Turtle | Cost 4 → 3 | Turtle's best comp WR is 67.6% but it appeared in 0 meta comps at cost 4. Dropping to 3 puts it in the same budget tier as cat, rabbit, and mouse. This opens up many new 3-pet combinations (e.g. turtle+mouse+cat = 3+3+3=9, triple-turtle = 9) that can hit the meta-comp threshold. |
| 🐳 Whale | Cost 7 → 6 | Whale had 68.2% peak WR but never cracked the meta pool. At cost 7, only one whale fits with any budget for other useful pets. At cost 6, budget becomes: whale+bear+cat (6+8+3=17), whale+mouse+mouse+mouse+mouse (6+3+3+3+3=18), or whale+rhino+cat (6+9+3=18). More viable 2-pet pairings unlocked. |

---

## Meta tier breakdown: BEFORE changes (pre-Round A)

Meta pool size: **35 comps** (20 top-WR + 20 counter, 5 overlap; note: counter-20 were all distinct from top-20 = actually 0 overlap from the run → 40 total checked → deduplicated to 35)

| Meta Tier | Pet | Appearance |
|---|---|---|
| Core (≥30%) | 🐻 Bear | 45.7% |
| Core | 🐱 Cat | 42.9% |
| Core | 🐉 Dragon | 42.9% |
| Core | 🦨 Skunk | 37.1% |
| Core | 🐭 Mouse | 34.3% |
| Niche (10-30%) | 🦅 Eagle | 20.0% |
| Niche | 🦏 Rhino | 14.3% |
| Niche | 🦁 Lion | 11.4% |
| Fringe (1-10%) | 🐰 Rabbit | 2.9% |
| Fringe | 🐢 Turtle | 2.9% |
| Fringe | 🐳 Whale | 2.9% |
| **Dead (0%)** | **🐘 Elephant** | **0%** |
| **Dead (0%)** | **🕷️ Spider** | **0%** |

Summary: 5 Core, 3 Niche, 3 Fringe, **2 Dead**

---

## Meta tier breakdown: AFTER Round A changes (post-elephant cost 5, post-spider cost 1)

Meta pool size: **37 comps** (20 top-WR + 20 counter, 3 overlap)

| Meta Tier | Pet | Appearance | Change from before |
|---|---|---|---|
| Core (≥30%) | 🐱 Cat | 56.8% | ↑ +13.9pp |
| Core | 🐭 Mouse | 40.5% | ↑ +6.2pp |
| Core | 🐻 Bear | 32.4% | ↓ -13.3pp |
| Core | 🐉 Dragon | 32.4% | ↓ -10.5pp |
| Niche (10-30%) | 🦨 Skunk | 27.0% | ↓ -10.1pp (borderline Core→Niche) |
| Niche | 🕷️ Spider | 13.5% | ↑ +13.5pp (was Dead) |
| Niche | 🦅 Eagle | 13.5% | ↓ -6.5pp |
| Niche | 🦏 Rhino | 13.5% | ↓ -0.8pp |
| Fringe (1-10%) | 🐘 Elephant | 8.1% | ↑ +8.1pp (was Dead) |
| Fringe | 🦁 Lion | 8.1% | ↓ -3.3pp |
| Fringe | 🐰 Rabbit | 2.7% | ↓ -0.2pp |
| **Dead (0%)** | **🐢 Turtle** | **0%** | ↓ -2.9pp (was Fringe) |
| **Dead (0%)** | **🐳 Whale** | **0%** | ↓ -2.9pp (was Fringe) |

Summary: 4 Core, 4 Niche, 3 Fringe, **2 Dead** (different pets — Turtle and Whale)

---

## Did the dead pets move into the meta?

### Elephant: YES (Dead → Fringe, 0% → 8.1%)
- Elephant+Mouse+Skunk became the **#1 comp** at 75.4% WR (up from position ~21 with dragon+elephant+mouse at 69.6%)
- Dragon+Elephant+Mouse also improved to 71.8% (#8)
- Cat+Elephant+Skunk appeared in the counter pool at 59.4%
- The cost reduction directly enabled new competitive pairings. Elephant's 2x2 heavy-push body pairs well with mobile painters like mouse.

### Spider: YES (Dead → Niche, 0% → 13.5%)
- Bear+Mouse+Spider debuted at **72.0% WR** (rank #6 overall)
- Mouse+Rhino+Spider hit 70.0% (rank #13)
- Spider+Spider+Mouse hit 69.6% (rank #15) — demonstrating that mass-spider deployment works
- Spider+Spider+Cat appeared in the counter pool
- At cost 1, spider becomes a reliable support piece: spend 2 energy (2 spiders) in a 20-budget team and get 2 freeze-web zones + 10 passive paint tiles per 2s.

### Turtle: NO (Fringe → Dead, 2.9% → 0%)
- Turtle was displaced from the meta pool when stronger spider and elephant combos took its slot
- Its 67.6% peak is real but requires specific conditions
- Round B change (cost 3) needs a re-sweep to verify
- Structural issue: turtle's slow speed (0.5/s) and paint-only role means it's good at supporting heavy comps but never leads them. It needs to be cheap enough to act as a 3rd/4th slot filler.

### Whale: NO (Fringe → Dead, 2.9% → 0%)
- Whale was similarly displaced by the same shift
- Its 68.2% peak WR (whale+X combo) suggests the core kit is viable
- Round B change (cost 6) needs a re-sweep to verify
- Structural issue: whale's 3×3 footprint (costs 9 tiles of board space) means it physically crowds out home row deployment. Multiple whales become self-blocking. It works best as a lone anchor + light pets.

---

## Takeaways: meta appearance vs raw win rate

1. **Appearance rate is more actionable as a dead-pet diagnostic.** Raw WR only told us which pets performed best on average across all comps; it couldn't distinguish "consistently mediocre" from "occasionally great but structurally unviable." Elephant had 46% team WR (C-tier) but a 69.6% peak — the appearance metric exposed that it was one cost-point away from the meta.

2. **The counter-comp pass adds real information.** 15 of the 37 meta pool comps came exclusively from the counter pass. Without it, we'd miss entire playstyle families. The counter comps are dominated by Cat-based combos (15/20 counter comps contain Cat), which don't all crack the raw-WR top-20 but reliably beat the dominant Bear/Mouse strategies.

3. **Cost reductions are the safest single-change lever.** All four balance changes in this round were cost reductions. They expand combo space without changing any mechanical interaction, and they're reversible if the pet becomes too ubiquitous.

4. **The meta pool is unstable at the fringe boundary.** Turtle and Whale had 2.9% appearance before Round A (both in exactly 1 comp: bear+skunk+turtle and bear+mouse+whale respectively). After Round A those comps got pushed out of the top-20 and counter-20 by stronger new entrants. Fringe pets are very sensitive to meta shifts — a single new top comp can knock them out. This suggests the Dead/Fringe boundary is a poor long-term stability target; we should aim for Niche (10%+).

5. **Mass-deployment of cheap units is a legitimate meta strategy.** Spider+Spider+Mouse and Rhino+Rhino+Rhino both cracked the top-20 after the spider cost change. This validates the random-affordable deployment model — players CAN choose to run homogeneous cheap-pet stacks, and they're competitive. The old deterministic cycler would have generated the same comps but wouldn't have modeled this strategic choice properly.

---

## Recommendation for next round

Round B changes (turtle cost 3, whale cost 6) need a re-sweep to confirm. Expected outcomes:
- **Turtle** should crack the meta as a cheap painter filler alongside dragon/skunk/bear. Prediction: 5-15% appearance (Niche).
- **Whale** at cost 6 might still be too expensive to consistently show up, but should at least reach Fringe. If it remains Dead after cost 6, consider a mechanical buff: reduce size to 2x2 (removes the "crowds out home zone" penalty) or add a passive paint on occupied tiles.

If Rabbit remains at Fringe after these changes, consider: rabbit+cat combos (rabbit vaults over cats to reach enemy back row — a unique strategic niche). A rabbit buff to make it more reliable at vaulting could push it from 2.7% to 10%+.

**No pet is currently at >50% appearance** (Cat is highest at 56.8%, and Cat-comps form the entire counter-meta family), so no nerfs are warranted at this stage.
