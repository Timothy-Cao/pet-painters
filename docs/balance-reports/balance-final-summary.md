# Queen of Critters — Final Balance Summary

**Date:** 2026-05-21  
**Methodology:** Multi-round sim sweeps (455 comps × 15 opponents × 6 samples) + Coevolutionary GA (50 vs 50, 4 samples/matchup, up to 30 gens).

---

## All Changes Made Across All Rounds

### Round 1 (cost sweep)
| Pet | Change | Rationale |
|---|---|---|
| Mouse | cost 2 → 3 | Dominant low-cost spammer |
| Bear | maxHp 18 → 14 | Too tanky vs any damage comp |
| Rhino | cost 7 → 8 | Over-performing A-tier |
| Skunk | cost 3 → 4 | Budget flooding |
| Spider | cost 4 → 2, freezeTicks 12 → 18 | Dead-tier — needed significant buff |
| Eagle | cost 4 → 2 | Dead-tier — too expensive for fragile attacker |
| Lion | cost 6 → 4 | Dead-tier — rage mechanic wasted at high cost |
| Cat | cost 5 → 3 | Underperforming counter pet |

### Round 2 (ability tuning)
| Pet | Change | Rationale |
|---|---|---|
| Bear | maxHp 14 (unchanged), speed tuning | Bear still too dominant |
| Spider | freeze approach reworked | Web ability needed more clarity |

### Rounds 3–4 (fine-tuning)
Various cost and stat adjustments based on multi-round comp data. See balance-round-3.md and balance-round-4.md.

### Meta-sweep + Counter-buffs (Phase 1)
| Pet | Change | Rationale |
|---|---|---|
| Skunk | spray reworked: front-only freeze (16 ticks) | Replace scatter mechanic with reliable freeze |
| Lion | rage mechanic added: +1 dmg per kill (uncapped) | Dead → needed identity |
| Eagle | added eagleTalon tuple (2 dmg base, 4 dmg vs 1×1) | Boosted kill capability |
| Cat | description updated | Clarified counter role |

### Phase 2 — Two-pet fix (this PR)
| Pet | Change | Rationale |
|---|---|---|
| Lion | rage cap: +2 maximum (was uncapped) | Overshot: 100% meta appearance |
| Lion | atk 3 → 2 | GA follow-up: still over-indexing at 73% |
| Skunk | spray restored to omnidirectional (4 ortho tiles), freeze kept | Front-only was wrong restriction; slow speed means enemies rarely in front arc |
| Dragon | cost 8 → 9 | GA identified at 97% combined appearance — AOE cone too cheap |
| Eagle | cost 2 → 3 | GA identified at 93% combined appearance after Dragon nerf |
| Elephant | cost 5 (unchanged) | Reverting cost 4 experiment — triple-Elephant spam unbeatable |

---

## Final Meta Tier List (brute-force sweep, 2026-05-21)

*From report-2026-05-21_22-21-44_60pct.md*

| Meta Tier | Pet | Appearance | Team WR | Cost |
|---|---|---|---|---|
| Core | 🐻 Bear | 60.6% | 60.0% | 8 |
| Core | 🐱 Cat | 48.5% | 57.9% | 3 |
| Core | 🐘 Elephant | 33.3% | 55.7% | 5 |
| Core | 🐭 Mouse | 30.3% | 56.4% | 3 |
| Niche | 🦏 Rhino | 24.2% | 54.4% | 8 |
| Niche | 🦁 Lion | 12.1% | 53.5% | 4 |
| Niche | 🕷️ Spider | 12.1% | 43.2% | 2 |
| Niche | 🐉 Dragon | 12.1% | 50.7% | 9 |
| Fringe | 🐢 Turtle | 6.1% | 52.5% | 3 |
| Fringe | 🦨 Skunk | 6.1% | 42.6% | 4 |
| Fringe | 🐰 Rabbit | 3.0% | 42.3% | 3 |
| Fringe | 🐳 Whale | 3.0% | 47.4% | 6 |
| Dead | 🦅 Eagle | 0.0% | 41.0% | 3 |

### Top 3 meta comps
1. 🦁+🦁+🐻 (lion+lion+bear) — 81.1% WR
2. 🐻+🐻+🐭 (bear+bear+mouse) — 80.0% WR
3. 🐘+🐭+🦏 (elephant+mouse+rhino) — 80.0% WR

### Bottom tier pets
Eagle (Dead), Rabbit (Fringe), Skunk (Fringe), Spider (Niche by appearance but C-tier WR).

---

## Final GA Convergence Findings

**Configuration:** Seed=20260521, pop=50, up to 30 gens, 4 samples/matchup.  
**Converged at:** Generation 6 (top-half fitness stable <2pp for 3 consecutive gens).  

**Most-frequent final offense comp:** 🐘+🐘+🐉 (Elephant×2 + Dragon, fitness 56.0%)  
**Most-frequent final defense comp:** 🐻+🐱+🐉 (Bear+Cat+Dragon, fitness 67.0%)

**Per-pet combined appearance rate (final run):**
| Pet | Offense | Defense | Combined |
|---|---|---|---|
| Bear | 38% | 88% | 63% |
| Elephant | 70% | 46% | 58% |
| Cat | 14% | 66% | 40% |
| Rhino | 26% | 40% | 33% |
| Dragon | 24% | 28% | 26% |
| Turtle | 18% | 10% | 14% |
| Lion | 14% | 14% | 14% |
| Mouse | 8% | 4% | 6% |
| Whale | 6% | 2% | 4% |
| Skunk | 4% | 2% | 3% |
| Rabbit | 4% | 0% | 2% |
| Spider | 2% | 2% | 2% |
| Eagle | 0% | 0% | 0% |

---

## 5 Honest Takeaways: Did the GA Surface Anything Brute Force Didn't?

1. **GA confirmed but didn't expand the dominant comps.** The brute-force top comps (Bear+Bear+Mouse, Lion+Lion+Bear, Elephant+Mouse+Rhino) largely appear in GA populations too. The GA didn't find any exotic "sleeper" comp that brute force missed. This suggests the 455-comp brute-force sweep is already capturing the real meta.

2. **GA exposed the Eagle problem brute force couldn't.** At cost 2, Eagle dominated the GA landscape at 93% appearance while barely registering in individual brute-force WR (fragile single-pet evaluation). The GA's competitive fitness metric captured "Eagle is essential to the best comps" in a way average-WR-per-pet misses. After cost 3, Eagle dropped to Dead in both systems — evidence the balance window for Eagle is very narrow.

3. **Tank spam is the dominant strategy.** Across every single GA run (with different cost configurations), the final offensive populations converged on multi-tank builds: Elephant×3, Bear×2+X, Bear+Cat+Elephant. The fundamental reason: tanky high-HP pets survive longer and paint more tiles. The "high DPS" pets (Spider, Rabbit, Whale, Skunk) don't see enough action before dying to justify their cost. This is a game design signal, not just a balance signal.

4. **GA early convergence is a symptom of narrow balance.** The GA consistently converged in 6–21 gens rather than 30, because once a few dominant comps emerge in the elite half, they crowd out the population through crossover. This means the game's comp space has a small number of "valleys" rather than a broad fitness plateau. For a truly balanced game, you'd want the GA to explore longer and find many equally-viable strategies.

5. **Phase 2 changes improved top-tier diversity compared to Phase 1.** In Phase 1, Lion+Dragon were the clear co-dominants (Lion at 100% brute-force appearance, Dragon at 55.9%). Post-Phase 2: Bear+Cat+Elephant+Mouse share the Core tier (30–61% appearance each), and no single pet hits 70% in brute force. The GA still finds Bear as the most essential defensive anchor (63% combined), but this is softer dominance than Phase 1's situation.

---

## Final Verdict: Balanced for v1 Release?

**Short answer: Conditionally yes, with known caveats.**

**What's working:**
- 4 pets share the Core tier in brute force (Bear, Cat, Elephant, Mouse). No single pet is at 100%.
- 4 more pets are Niche/competitive (Rhino, Lion, Spider, Dragon). Experienced players will find viable off-meta builds.
- The top comps are fairly tight in WR (81% down to ~70% for the top 16 comps), meaning there isn't a single "god comp" that wins at 95%+.
- All 89 tests pass. Balance changes are purely data-driven without breaking the sim.

**Known issues for next playtesters:**
1. **Eagle is functionally dead** at cost 3 in both brute force and GA. Its fragility (3 HP) means it dies before the fly-over damage matters. Would need either cost 2 or an HP buff.
2. **Rabbit, Skunk, Spider, Whale are weaklings** — they appear only in counter scenarios. A playtester who grabs these pets randomly will have a bad experience.
3. **Triple-Elephant is a real and oppressive comp** at 76.7% WR. The first time a playtester encounters it, it will feel unfair. It's been in the meta since round 1 and is hard to counter without Bear or Dragon.
4. **Bear is the "glue" pet** — it appears in 60% of meta comps and improves almost every build. Its high HP + rage mechanic means it wins wars of attrition. At cost 8 it's correctly priced but still the clear #1 pet for experienced players.
5. **The game is better balanced than v0** but the skill gap between random pet selection and optimal comp building is very large. New players will frequently encounter unwinnable matchups.

**Recommendation:** Acceptable for a v1 release with the expectation that balance will continue in v1.1. The critical remaining issue (Eagle being Dead) is a 5-minute fix (cost 2 + maybe +1 HP) if desired before launch.
