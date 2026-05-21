---
name: iterating-game-balance-commands
description: Use when invoking pet-painters balance workflows from the user — they may ask for any of the named commands below, or ask "what can you do for balance".
---

# Pet Painters — Balance & Design Commands

A shared vocabulary for iterating on game balance. When you (the user) ask me to run any of these, I have a clear playbook. You can ask "what balance commands do you have?" and I'll surface this list.

---

## Commands

### `balance:report`

**What I do:** Run the latest balance sim (`npm run balance`), summarize the meta tier list, top-20 comps + counters, and per-pet appearance rate. No changes applied.

**When to use:** When you want a status check on the current balance state.

**Time:** ~5 min (most of it is the sim run).

---

### `balance:improve`

**What I do:**
1. Run a fresh sim sweep.
2. Identify outliers: pets with >60% meta appearance (over-present) or 0% (Dead).
3. Apply one targeted change per outlier — cost adjustment first, stat adjustment second, ability tweak last.
4. Re-run sim.
5. Compare deltas and report.
6. Commit + push.

**When to use:** When you want me to iterate balance autonomously with my best judgment.

**Variant flags:**
- `--conservative` — only apply changes if the outlier is clearly broken (>70% or 0%). Skip marginal cases.
- `--aggressive` — apply broader changes (multiple pets per round, mechanic tweaks allowed).

**Time:** ~15 min.

---

### `balance:counter <pet>`

**What I do:** Design and apply a counter mechanic to address ONE specific overpowered pet. Could be:
- Buffing an existing pet's damage vs the target (e.g., Cat +2 vs Mouse)
- Adding a tag-based bonus (anti-small, anti-painter, etc.)
- Suggesting a new pet purpose-built as the counter

I'll propose the design first, then implement after you confirm.

**When to use:** When one specific pet dominates the meta and you want a thematic counter rather than a nerf.

**Example:** `balance:counter mouse` → "Cat gets +2 vs Mouse, Eagle gets 2× vs 1×1 pets, propose Snake (new pet) as a hard counter."

**Time:** ~20-30 min including discussion + implementation + re-sweep.

---

### `balance:rework <pet>`

**What I do:** Rework an underperforming pet's ABILITY MECHANICS (not just stats). If stat tweaks haven't moved a Dead/Fringe pet, the design is the problem. I'll:
1. Read the pet's current behavior carefully
2. Diagnose why it's not working (no engagement opportunities, ability fires at wrong time, too situational, etc.)
3. Propose 2-3 redesign options
4. Implement the one you choose
5. Re-run sim, report

**When to use:** When a pet stays Dead/Fringe across multiple `balance:improve` rounds.

**Time:** ~30-60 min.

---

### `balance:new-pet <role>`

**What I do:** Design and implement a NEW pet to fill a specific role in the roster. Roles:
- `counter:<pet>` — specifically counters another pet (e.g., `counter:mouse`)
- `synergy:<pet>` — synergizes with another pet to enable a new comp archetype
- `support` — buff/heal/utility role currently missing from the roster
- `denier` — anti-paint, anti-movement, area control
- Or describe a custom role in natural language

I'll propose stats, ability, art (emoji), description. After confirmation, I'll implement (new file in `src/sim/pets/`, register in `index.ts`, regenerate `ALL_PETS`). Re-run sim.

**When to use:** When the existing roster has a structural gap that re-balancing can't fix.

**Time:** ~45-60 min including playtest considerations.

---

### `balance:scale <param=value>`

**What I do:** Explore impact of a global parameter change on the meta WITHOUT committing. E.g., `balance:scale BOARD_SIZE=20` or `balance:scale ENERGY_BUDGET=30`. I'll:
1. Temporarily change the param.
2. Run a quick sim (smaller sample, ~3 min).
3. Compare new tier list to baseline.
4. Revert the change.
5. Report whether the change improved diversity / shifted the meta usefully.

**When to use:** When considering a game-design pivot but not sure if it'd help.

**Time:** ~10 min.

---

### `balance:ga`

**What I do:** Run the coevolutionary GA (`npm run balance:ga`). Returns the optimal-comp landscape: which 3-pet teams converge as dominant + their natural counters. Per-pet appearance rate in final populations.

**When to use:**
- As a stress test on top of brute-force sweeps
- To find edge-case dominance the average-WR view misses (Eagle at cost 2 was caught this way)
- When you suspect the meta is narrower than brute force suggests

**Time:** ~10 min.

---

### `balance:summary`

**What I do:** Compact status report. Tier list, change log of recent rounds, current outliers, my best recommendation for next move. No sim run.

**When to use:** When you want a quick check-in without spending 5 min on a sim run.

**Time:** ~2 min.

---

### `design:explore <idea>`

**What I do:** Sandbox a design change. Write a short doc analyzing:
- What the change is
- Implementation cost (LoC, hours)
- Expected impact on balance / fun / strategic diversity
- Risks and edge cases
- Recommendation: do it now, defer to v2, or skip

NO implementation, just thinking on paper. Output: a markdown doc in `docs/superpowers/specs/explorations/`.

**When to use:** Before committing to a big change. The 20×20 corner-zone redesign was a `design:explore`.

**Time:** ~15-20 min.

---

### `design:playtest-debrief <observations>`

**What I do:** Take your playtest observations ("Bear felt mandatory", "matches felt slow", etc.) and:
- Cross-reference against the sim data
- Identify which observations the sim does/doesn't predict
- Propose 2-3 targeted changes to address them
- Apply after you confirm

**When to use:** After actual playtesting. Sim data is one signal; human feel is another. This is where they meet.

**Time:** ~30 min depending on observation count.

---

## Anti-commands (things I won't auto-do)

These need explicit user direction; I won't take them without asking:

- `balance:nerf-everyone` — uniform nerfs across the board. This is almost never the right move; specific outliers need specific fixes.
- `balance:reset-roster` — start over from scratch. Throwaway is rarely correct; iteration accumulates information.
- `design:full-redesign` — change board geometry, energy economy, win condition all at once. Each of these is a separate `design:explore`.

---

## How to invoke

Just say it in plain text. Examples:

- "Show me the balance report" → `balance:report`
- "Improve balance" or "iterate balance" → `balance:improve`
- "Mouse is too strong, counter it" → `balance:counter mouse`
- "I think Skunk needs a rework" → `balance:rework skunk`
- "What if the board were 20×20?" → `design:explore 20x20-board`
- "What balance commands do you have?" → I'll surface this menu

I'll always confirm the interpretation before doing significant work. For quick reports / status, I'll just go.

---

## My judgment thresholds

These are calibrations from the 6-round balance campaign that drive my recommendations:

| Signal | What I do |
|---|---|
| Pet at >70% meta appearance | Top-priority nerf, single largest lever |
| Pet at 30-65% | Healthy — leave alone |
| Pet at 1-30% (Niche/Fringe) | Acceptable — niche pets are fine |
| Pet at 0% (Dead) | Try cost reduction, then stat buff, then mechanic rework, in that order |
| Top comp WR >85% | Comp is too dominant — break its key pet |
| Top comp WR 60-80% | Healthy meta |
| GA converges in <10 generations | Strategic space is narrow — design-level fix needed |
| Same pet appears in 60%+ of all top comps | "Mandatory glue" pet — watch for it limiting diversity |

I'll flag when a signal hits these thresholds.
