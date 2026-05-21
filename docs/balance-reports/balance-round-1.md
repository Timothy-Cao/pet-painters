# Balance Round 1 — Results & Analysis

**Date:** 2026-05-21
**Baseline report:** `report-2026-05-21_19-03-38-108.md`
**Post-change report:** `report-2026-05-21_19-12-48-738-60pct.md`

---

## Changes applied

One change per pet, targeting the smallest meaningful lever.

| Pet | Change | Rationale |
|---|---|---|
| 🐭 Mouse | cost 2 → **3** | At cost 2 the bot deployed ~10 mice, flooding the board with near-unstoppable painters. +1 cost cuts deploys from 10 to 6 and forces the player to make real decisions about slot allocation. |
| 🐻 Bear | maxHp 18 → **14** | Bear's snowball comes from surviving long enough for rage to kick in. -4 HP means it enters the rage phase sooner (at ≤7 HP instead of ≤9), but also dies faster to burst. Keeps the identity without cost-bumping it out of 3-unit comps. |
| 🦏 Rhino | cost 7 → **8** | Rhino momentum was already strong at 74.6%. +1 cost makes it harder to pair with Dragon (combined cost 16→17, forcing a budget choice vs. just filling 20). |
| 🦨 Skunk | cost 3 → **4** | 71.5% WR for a 1×1 disruptor that also paints is too efficient at cost 3 (6 per match). Cost 4 = 5 per match, slightly reduces its flooding. |
| 🕷️ Spider | cost 4 → **2** AND freezeTicks 12 → **18** | Spider mirror score was 48 — the lowest of any pet, meaning it paints almost nothing in 30s. Stationary pets need to be very cheap to justify the dead tile, AND their ability needs to punch through. Cost drop to 2 lets you run 10 spiders; freeze extension from 0.6s → 0.9s makes each web stickier. Both levers together since either alone won't fix a pet that can't contest paint at all. |
| 🦅 Eagle | cost 4 → **2** | 13.2% WR glass cannon that jumps 2 tiles but paints only the landing tile and does zero damage. Needs to flood the board to contribute — cost 2 lets you deploy 10, same as the old Mouse density. |
| 🦁 Lion | cost 6 → **4** | Well-designed kit (patrol → sprint → 3-damage strike) but at cost 6 it competed directly with Bear, which outclasses it in every way. Cost 4 opens Lion+Skunk or Lion+Rabbit comps and lets it serve as a mid-range predator. |
| 🐱 Cat | cost 5 → **3** | Cat's pounce is a hard counter to Mouse, but at cost 5 you'd almost never run it in a Mouse-meta. Dropping to cost 3 (= Cat's own cost was Mouse cost + 1) lets Cat serve as genuine anti-Mouse tech at reasonable slot cost. |

**Unchanged pets:** 🐘 Elephant (72.9% borderline, left as is per design intent), 🐰 Rabbit, 🐢 Turtle, 🐉 Dragon, 🐳 Whale.

---

## New tier list with deltas

| Tier | Pet | New WR | Old WR | Delta |
|---|---|---|---|---|
| S | 🐻 Bear | 90.7% | 84.8% | **+5.9%** |
| S | 🦏 Rhino | 77.2% | 74.6% | +2.6% |
| S | 🐘 Elephant | 73.9% | 72.9% | +1.0% |
| S | 🐭 Mouse | 67.0% | 90.6% | **-23.6%** |
| A | 🦨 Skunk | 57.5% | 71.5% | **-14.0%** |
| A | 🦁 Lion | 57.1% | 27.3% | **+29.8%** |
| B | 🐱 Cat | 50.9% | 32.5% | **+18.4%** |
| C | 🐳 Whale | 39.8% | 48.7% | -8.9% |
| C | 🦅 Eagle | 38.7% | 13.2% | **+25.5%** |
| C | 🐰 Rabbit | 35.4% | 43.2% | -7.8% |
| D | 🐉 Dragon | 28.8% | 39.9% | -11.1% |
| D | 🐢 Turtle | 25.5% | 41.3% | **-15.8%** |
| D | 🕷️ Spider | 5.8% | 5.8% | 0.0% |

---

## Key callouts

### 1. Mouse nerf landed perfectly
Mouse dropped 23.6pp (90.6% → 67.0%) — right in the predicted 15–20pp+ range. It went from "runs 10 mice per match and dominates everything" to a legitimate S-tier pet that still needs counter-play. The Cat counter now actually works: Cat WR vs Mouse jumped from 26% to **95%**, which means the meta has a real answer.

### 2. Lion is now viable as a predator
The biggest mover: +29.8pp. At cost 4, Lion now fires in 2v2 comps and contributes meaningfully to team compositions. It still folds to Bear (100% loss) and has trouble with Elephant (50%), but beats Mouse (90%), Turtle (100%), and Whale (100%) — a real role as mid-cost predator.

### 3. Bear got stronger, not weaker
Counterintuitively, Bear went from 84.8% → **90.7%** after a HP nerf. The reason: the rest of the S-tier (especially Mouse) got weakened. Bear's absolute performance was already near-ceiling against many pets; its relative standing improved because the pets it was struggling against (Mouse, Skunk) got weaker. Bear is now the new #1 problem pet.

### 4. Spider is still broken
Despite cost 2 + longer freeze, Spider remains at **5.8% WR** — zero movement in the data. Root cause: Spider is stationary, paints nothing by itself, and every pet that comes adjacent to it either kills it quickly (Bear 1-shots in 1 hit at 3 atk vs 6 HP, anything with decent damage works) or just walks around it. The freeze mechanic is only valuable at a chokepoint, and the sim's AI doesn't know how to exploit that. The fix here requires either giving Spider its own painting (body tile paint per second), adding HP substantially so it survives contact, or rethinking the mechanic entirely.

### 5. Collateral losers: Whale, Rabbit, Turtle, Dragon
These pets got no direct change but dropped 8–16pp. The reason is meta-shift: previously they were being propped up by opponents running bad single-pet lineups. In the new sample set, the buffed pets (Eagle, Lion, Cat) are more competent opponents, and Turtle in particular now loses to Lion 100% of the time. Dragon's existing 39.9% → 28.8% fall is significant and worth addressing next round.

---

## Round 2 recommendations

Priority order:

1. **Bear** (90.7%): Still clearly S-tier. Try cost 6 → 7 to reduce 3-Bear spam, or atk 3 → 2 to blunt one-shot kill potential on small pets.
2. **Spider** (5.8%): Needs a mechanic fix, not just a stat change. Suggestion: each second, Spider auto-paints its own tile (gives it a reason to exist even if enemies don't come). Also try HP 6 → 10 so it survives a Bear swipe.
3. **Dragon** (28.8%): It's slow, expensive (cost 8), and only deals damage in a 2-tile cone. Try breathRange 2 → 3 (makes the cone cover 6 tiles) so it can affect targets before contact.
4. **Turtle** (25.5%): Getting destroyed by Lion now. Turtle has a strong AoE paint splash but very slow movement (0.5 tiles/sec) means it barely repositions. Try splashPerSec 1 → 1.5 (more frequent splash) to compensate.
5. **Elephant** (73.9%): Crept up slightly and still has 100% WR vs Cat, Rabbit, Turtle, Eagle, Dragon, Whale. Consider cost 5 → 6.
6. **Rhino** (77.2%): The cost nerf didn't land. Consider atk 2 → 1 base (momentum still adds up to +5 so max damage stays) to blunt its non-momentum combat.
