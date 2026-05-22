# Creative Reworks — Final State

After Rabbit/Whale/Skunk/Turtle/Bear got new mechanic-level abilities + 2 additional tuning passes.

## Final tier list (33 comps in meta pool)

| Meta Tier | Pet | Appearance | Comps |
|---|---|---|---|
| **Core** | 🐱 Cat | 72.7% | 24 |
| Core | 🐢 Turtle | 36.4% | 12 |
| Core | 🐭 Mouse | 33.3% | 11 |
| Niche | 🐰 Rabbit | 27.3% | 9 ← REWORKED |
| Niche | 🦁 Lion | 21.2% | 7 |
| Niche | 🦅 Eagle | 21.2% | 7 |
| Niche | 🐳 Whale | 18.2% | 6 ← REWORKED |
| Niche | 🦨 Skunk | 15.2% | 5 ← REWORKED |
| Fringe | 🐘 Elephant | 3.0% | 1 |
| Fringe | 🐻 Bear | 3.0% | 1 ← REWORKED |
| Fringe | 🦏 Rhino | 3.0% | 1 |
| Fringe | 🐉 Dragon | 3.0% | 1 |
| Dead | 🕷️ Spider | 0% | 0 |

## Did we hit the "4+ comps for every pet except Spider" goal?

**8 of 13 met (62%).** Goal partially met.

- ✅ Met: Cat 24, Turtle 12, Mouse 11, Rabbit 9, Lion 7, Eagle 7, Whale 6, Skunk 5
- ❌ Below threshold: Elephant 1, Bear 1, Rhino 1, Dragon 1 (all at 3.0% — sit in fringe just below)
- ✅ Acceptable per user: Spider 0

The 4 reworked-Fringe pets (Rabbit, Whale, Skunk, Bear) all gained representation. Rabbit went 6%→27%, Whale 6%→18%, Skunk 6%→15%, Bear 0%→3%.

## What each rework actually does

### 🐰 Rabbit — "Hop-over-with-splash"
When blocked, scans up to 4 tiles forward, lands on first empty tile. Splash radius scales with jump distance (jump-2 = 3×3, jump-4 = 5×5). At end of map or fully-blocked corridor, turns randomly to a new cardinal direction. Cost 3.
**Result**: 6.3% → 27.3%. Real mid-tier viability. Best with corridor-style placements where hops chain.

### 🐳 Whale — "Blowhole artillery"
Every 7 seconds (after r3 tune from 5s), spouts a 3×3 paint splash to a random neutral tile anywhere on the board. If no neutral tiles remain, targets an opponent-painted tile. Cost 10.
**Result**: 82.8% → 18.2%. r3 nerfs (cost +2, spout interval +2s) brought it from overdominant to a true premium niche pick. Pairs well with cheap painters that can rush while Whale slowly walks + spouts.

### 🦨 Skunk — "Fear aura + freeze"
Every 1 second, all enemy pets within Chebyshev distance 2 have their facing flipped AWAY from Skunk. Freeze spray extended from 16 → 24 ticks (~1.2s). Cost 3.
**Result**: 6.3% → 15.2%. Fear flip alone is mostly cosmetic (enemies turn back quickly) but combined with the longer freeze makes Skunk a real disruption pick.

### 🐢 Turtle — "Shell paint"
When any enemy is within Chebyshev distance 3, Turtle paints an 8-neighbor ring around itself every 0.67s (additive on top of normal painting). Movement is preserved (original design stopped movement during shell, which crashed it to 0%).
**Result**: 50% Core → 36.4% Core. Stayed strong but more share allocated to other pets.

### 🐻 Bear — "Brawl mode"
When 2+ enemy pets are within Chebyshev distance 3, Bear's speed jumps to 2.5 tiles/sec (vs 1.0 calm, 1.6 raged). Cost 4.
**Result**: 0% → 3.0% (just under target). The mechanic works but Bear's 2×2 footprint and slow base speed mean it rarely gets to where 2+ enemies are before matches end. Would need either a smaller footprint or a triggering threshold of 1 enemy to truly hit Niche.

## What the iteration loop revealed

This run produced the **biggest throne-passing example** of the entire balance campaign:

| Round | Top Pet | % |
|---|---|---|
| Pre-reworks | Mouse | 56% |
| Post-reworks | Whale | 82.8% |
| r3 (Whale nerf, Cat buff) | Cat | 93.5% |
| r4 (Cat nerf) | Cat | 72.7% |

This is a clear demonstration of the principle in `iterating-game-balance/SKILL.md`: "After a top-tier pet is nerfed, the next-highest pet often inherits the throne. Expect this — it's not a failure, it's signal."

To dethrone Cat permanently would require one more round (cost 4 → 5 again) but that just reveals the next throne-inheritor. The deeper issue is that on the 20×20 corner-zone geometry, the FAST CHEAP PAINTER role is structurally strong — whoever fills that role (Mouse, Cat, Rabbit) ends up Core.

## What the reworks DID accomplish

1. **Genuine mechanical variety.** The 5 reworked pets each have a distinct identity in code, not just stat numbers. Spider remains Dead but it's the ONLY dead pet — every other roster member has a path to viability.

2. **Mid-tier diversity** is at an all-time high. 8 pets sit in 15-36% appearance — that's real comp-building space.

3. **Heavy pets (Elephant, Rhino, Bear, Dragon) are at parity in Fringe.** None dominates, none is uniquely Dead. They're all "playable but not optimal" — a stable design state.

4. **Spider gracefully accepts its niche.** Per user instruction, Spider being at 0% is acceptable as a designed exception.

## What's still off

- Cat at 72.7% is over the 60% "Core but not mandatory" threshold. Would need ONE more nerf or a buff to a Cat counter (Eagle is the natural option — its 2× vs 1×1 already hits Cat).
- 4 pets stuck at 1-comp Fringe (Elephant, Bear, Rhino, Dragon). These are the "heavies" struggling with the bigger board. May need a focused "heavy pet reach" buff (more speed, or maybe a "charge" tuple that lets them move 2 tiles per move tick).

## Verdict

**Ship this for v1 playtest.** The reworks created genuinely interesting mechanics that the sim verifies as viable. Cat is over-present but not broken — it's the 16×16's Bear-equivalent. The four heavies are a known design problem that mechanic-level work could address later.

**Three concrete next moves available:**

1. **`balance:improve --conservative`** — one more Cat nerf or Eagle buff. Should bring Cat to 50-65%.
2. **`balance:rework` on the four heavies** as a batch — give them a shared "charge" mechanic where they can move 2 tiles in one move-tick action. Probably fixes all four.
3. **Move on**: balance is shippable. Playtest will tell us if Cat actually feels oppressive or if the variety of reworked Fringe pets makes it a "many viable comps" meta.
