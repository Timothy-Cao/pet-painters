# Balance Report: Eagle Fix + Dragon 3×3

**Sweep date:** 2026-05-21
**Source report:** `report-2026-05-21_22-32-16-096-60pct.md`

## Changes applied

- **Eagle**: cost 3 → 2, atk 2 → 1. Retains 2× damage vs 1×1 pets.
- **Dragon**: size 2×2 → 3×3, cost 9 → 11, maxHp 20 → 28, weight 9 → 14, cone updated to 3-wide front.

---

## Eagle

**New meta appearance: 12.5% (Niche tier)** — target was 5–25%. ✓

Eagle went from Dead (0%) to Niche, appearing in 4 of 32 meta-pool comps. Notable appearances: `cat+dragon+eagle` (76.1% WR) and `dragon+eagle+turtle` (75.6% WR). Eagle is now a legitimate support pick that pairs well with Dragon coverage. The atk-1 baseline means it's not threatening solo but its 2× small-pet bonus still provides counter value against Mouse/Spider rushes.

---

## Dragon 3×3

**New meta appearance: 87.5% (Core tier)** — target was 10–40%. ✗ Overcorrected.

Dragon dominates the meta at 87.5% presence — it appears in 28 of 32 meta-pool comps. Its team WR of 65.1% is the highest in the roster, a full 6.4pp above Bear (58.7%). The top 20 comps are almost uniformly "some mix of Bear/Cat/Mouse/Rhino/Eagle + 1–2 Dragons."

The 3×3 size + weight 14 makes Dragon effectively unkillable by anything that isn't another Dragon — its 28 HP survives two consecutive breath cycles from an opposing Dragon, and its fire cone now covers 9 tiles per breath, shredding any non-Dragon frontline. At cost 11, it is buyable in a standard 20-energy budget with one other pet (e.g., Mouse at 1 = Dragon+Dragon+Mouse at cost 23... wait, 11+11+1=23 > 20). Correction: double-Dragon is 22 energy — within reach by dropping the third pet to cost 1 (Mouse) or going Dragon+Cat(4)+Rhino(5)=20.

**This is a problem.** Dragon 3×3 at cost 11 is too dominant.

---

## Top 3 meta comps

| Comp | WR | Notes |
|---|---|---|
| Cat + Cat + Dragon | 84.4% | Cat's sustain + Dragon's area denial |
| Cat + Dragon + Mouse | 84.4% | Speed + fire coverage |
| Bear + Dragon + Lion | 83.3% | Triple-sustain frontline |

All three feature Dragon. The one Dragon-free comp in the top 20 is `Bear + Mouse + Rhino` at 76.1%, which serves as the counter pick — indicating Dragon comps are beatable, but only by a specific balanced-speed-tank answer.

---

## Verdict: revert Dragon to 2×2, or keep 3×3?

**Revert to 2×2**, but carry forward the weight bump.

The 3×3 experiment confirms the "premium big pet" hypothesis is real — Dragon at 3×3 is clearly the strongest unit. But 87.5% meta presence and 65.1% team WR indicates the cost (11) is too low for the raw power level. Options:

1. **Revert size to 2×2**: keeps the proven 2×2 geometry; adjust cost/stats from there.
2. **Keep 3×3 but raise cost to 14–15**: would require 2-pet teams or a very cheap third pet; test whether scarcity is enough to bring appearance under 40%.
3. **Keep 3×3, lower stats**: reduce atk or breathRange to make 3×3 a big-body painter rather than a one-shot AOE threat.

The cleanest signal from this sweep: the 3×3 geometry itself is sound (no crash, no stuck-pet issues, 89 tests pass), but the stat package needs significant tuning before Dragon 3×3 ships. For the current meta, **revert Dragon to 2×2 at its previous cost (9)** and open a dedicated Dragon-3×3 tuning task if the premium-big-pet niche is worth pursuing.

---

## Other meta shifts

- **Bear** held at Niche (21.9%), down from its previous always-include Core status (60.6%). The Bear nerf from Phase 2 is working — it's strong but not mandatory.
- **Cat** emerged as the new secondary Core pick (43.8%) — it synergizes with Dragon's fire coverage.
- **Skunk** moved from Fringe → Niche (12.5%) with Dragon comps that use Skunk as a cheap paint-staller.
- **Whale** remains Fringe (6.3%) — Dragon's dominance crowds it out since both fill large-body roles.
- **Spider and Rabbit** remain weak (Fringe/C-tier); they have no answer to Dragon's AoE.
