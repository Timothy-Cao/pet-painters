# Balance comparison — 60% vs 75% win threshold

**TL;DR:** Changing the threshold from 60% (153 tiles, the current game default) to 75% (192 tiles, the original v1.1 design) has **almost no effect on the tier list**. All deltas are within statistical noise (±2 percentage points at 100 samples). Mouse stays dominant either way; Spider stays broken either way.

**Why:** the threshold doesn't matter because **most matches don't reach it**. They end at the 30-second match cap with whoever has more paint at the time. Threshold only matters when a comp can actually push past it within the time limit — and currently only Mouse-rush comps can. Even Mouse mirror tops out around 128 tiles average, which is below both thresholds. So a higher threshold just makes Mouse slightly more dominant (it can keep painting longer) and barely touches anything else.

---

## Tier list deltas

| Pet | 60% WR | 75% WR | Δ | Notes |
|---|---|---|---|---|
| 🐭 Mouse | 90.6% | 92.2% | **+1.6%** | Slightly stronger at higher threshold |
| 🐻 Bear | 84.8% | 85.3% | +0.5% | Noise |
| 🦏 Rhino | 74.6% | 74.2% | -0.4% | Noise |
| 🦨 Skunk | 71.5% | 73.1% | +1.6% | Noise |
| 🐘 Elephant | 72.9% | 73.1% | +0.2% | Noise |
| 🐳 Whale | 48.7% | 49.4% | +0.7% | Noise |
| 🐰 Rabbit | 43.2% | 42.7% | -0.5% | Noise |
| 🐢 Turtle | 41.3% | 42.1% | +0.8% | Noise |
| 🐉 Dragon | 39.9% | 39.3% | -0.6% | Noise |
| 🐱 Cat | 32.5% | 31.7% | -0.8% | Noise |
| 🦁 Lion | 27.3% | 27.2% | -0.1% | Noise |
| 🦅 Eagle | 13.2% | 13.1% | -0.1% | Noise |
| 🕷️ Spider | 5.8% | 5.9% | +0.1% | Noise |

**S-tier set unchanged. D-tier set unchanged. Tier rankings identical.**

---

## What actually shifts (other than tier rankings)

A higher threshold tends to amplify the "rich-get-richer" effect for already-dominant comps:

- **Mouse vs Bear** (Mouse's nearest counter): at 60% Bear wins 25% of the time. At 75% Bear wins only ~21%. Higher threshold favors Mouse because Bear runs out of HP before Mouse runs out of paintable tiles.
- **Cat vs Mouse**: Cat goes from 26% → 28%. Mild improvement for Cat. Probably random.
- **Mouse mirror**: 53% A win rate at both thresholds. Mouse's avg score is ~127 in both — neither threshold ever actually gets hit in the mirror.

If we tracked match-end reasons (paint vs timeout vs stall), I'd expect ~90% of matches end via timeout or stall, ~10% via paint threshold at either setting.

---

## Implications for game balance

1. **The threshold is a cosmetic dial, not a balancing dial.** Lowering or raising it doesn't fix the Mouse problem. The fix needs to come from pet stats.

2. **30-second match cap is the real constraint.** A meaningful sim-driven balance change would either:
   - Shorten the match (lower the threshold AND the cap) to make burst painters relatively weaker, or
   - Lengthen the match (higher threshold AND higher cap) to make sustained-pressure pets relatively stronger, or
   - Add comeback mechanics that recover from one-sided early states.

3. **The painter/fighter axis is broken right now.** Fighters (Lion, Eagle, Dragon, Spider) can't compete against pure paint volume because there's no time for combat to matter before paint decides the match. Two paths to fix:
   - Buff fighter damage / range / mobility so they can disrupt painters faster.
   - Nerf painters' raw output, particularly Mouse, so paint pressure doesn't outpace combat reaction.

4. **Spider is mechanically broken**, not just stat-weak. 5.8% WR with the same outcome at both thresholds suggests the freeze ability isn't doing meaningful work in the sim. Worth a per-match trace to confirm — possibly a bug in how the trigger fires.

---

## Recommendation

**Keep the game at 60% threshold for now.** The threshold isn't your problem; pet balance is. Spend tuning effort on:

1. **Mouse**: cost 2 → 3, or hp 2 → 1, or speed 4 → 3. Pick one, re-run sim, repeat until Mouse settles around 60–65% WR (still strong but not autopilot-winning).
2. **Spider**: investigate the freeze mechanic — does it actually fire? If yes, why isn't it helping?
3. **Eagle**: similar question — why is flying not paying off?
4. After that, consider whether the painter/fighter balance is structural (needs design changes) or numeric (just buff fighter atk/range).

Once Mouse is dethroned, re-evaluate the tier list. Other pets are likely closer to balanced than they look — they're just all overshadowed by Mouse.

---

**Reports:**
- 60% (current game default): [`report-2026-05-21_19-03-38-108.md`](report-2026-05-21_19-03-38-108.md)
- 75% (original v1.1 design): [`report-2026-05-21_19-07-52-028-75pct.md`](report-2026-05-21_19-07-52-028-75pct.md)
