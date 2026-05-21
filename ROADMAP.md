# Pet Painters — Roadmap

> **North star:** A small, beautifully crafted tactical sandbox where each pet has an unmistakable identity and every match feels juicy from start to finish — clear intent, satisfying execution, immediate feedback.

The architecture is in good shape (see `ARCHITECTURE.md`). What's left is closing the gap between *correctness* and *feel*, and growing the game out beyond the sandbox toy it currently is.

This roadmap is phased so each chunk is independently shippable and ends with a recognizable "the game just leveled up" moment.

---

## Phase 1 — Feel

Pet Painters today looks like a prototype because pets teleport between tiles and there's no payoff at the end of a round. Closing those gaps is the biggest perceived-quality jump we can make.

- **V — Smooth pet movement + facing interpolation.** Pets slide between tiles using a per-frame lerp; facing rotates smoothly via the shorter arc. Render-side cache holds the previous anchor/facing per pet. Vaults/teleports use a special curve.
- **W — Paint-splat tile effect.** Whenever a tile is freshly painted, render a brief brush-stroke bloom in the owner's color. Sells the core mechanic.
- **X — Round summary panel.** At execution end, overlay a card showing territory delta per side, kill counts, MVP pet (most tiles painted), and a momentum arrow. Dismisses on next planning interaction.
- **Y — Tactical right-sidebar additions.** Live tick counter during execution, deployment-count badges on the player chips while planning, and a small recent-events log ("Cat ate Mouse at (5,7)") that fades.

**Phase 1 done when:** a stranger watching for 30 seconds describes the experience as "polished" rather than "interesting concept."

---

## Phase 2 — Content + readability

Now the game feels good, fill out the roster and make pets readable on the board.

- **Click-to-inspect deployed pets.** Tap a pet on the canvas to open an inline popup with live HP, facing, and a preview of which tuple is about to fire and when. Closes by clicking elsewhere.
- **Three new pets** rounding out archetypes:
  - 🦁 **Lion** — true hunter. Walks slowly until an enemy enters its line of sight, then dashes. Reintroduces the `lookAhead` helper.
  - 🕷️ **Spider** — stationary denier. Webs adjacent enemies, causing them to skip a tick.
  - 🦅 **Eagle** — flier. Moves 2 tiles per step, ignores terrain blocking, paints only landing tile.
- **Subtle visual identity per pet.** Owner ring picks up a warm aura for predators and cool for painters, so pet roles are legible at a glance.

**Phase 2 done when:** the roster has a clear rock-paper-scissors loop and players can tell what every pet on the board is doing without looking at the popup.

---

## Phase 3 — Real game

Move beyond sandbox.

- **Versus mode.** The `sandbox` flag already exists. Add a mode selector ("Sandbox" / "Versus") and wire Versus to use the energy economy properly.
- **Win celebration.** When the 75% threshold is hit, full-canvas color confetti tinted in the winner's color, hero text, and Rematch / New Match buttons.
- **Minimal audio.** Paint splat, hit, pounce, win fanfare. Three or four crisp sounds, no music. Mute toggle in the corner.
- **Main menu / mode selector.** Pre-match screen with Sandbox / Versus / Challenges (stub).

**Phase 3 done when:** Versus mode is playable end-to-end and a match win actually feels like one.

---

## Phase 4 — Dev tooling & longevity

For agent-driven future work.

- **Scenario CLI.** `npm run scenario tests/scenarios/mouse-vs-cat.ts` runs a scripted matchup in headless mode and prints the outcome. Useful for balance.
- **Balance harness.** Run a matrix of N matchups M times each and print a win-rate table per pet pair.
- **Replay log.** Record deploy + tick events in a compact format. Replay button on the round summary card.
- **`pet-designer` skill scaffold.** Generate `src/sim/pets/<name>.ts` from a stat block prompt.

**Phase 4 done when:** balancing a new pet takes 5 minutes of running scenarios instead of an hour of manual playtesting.

---

## Intentional non-goals (for now)

- **Online multiplayer.** Out of scope. Hot-seat versus is enough.
- **Per-pet animations beyond movement.** Idle wiggles, breathing, etc. — would be lovely, but interpolation is the 80% win.
- **Complex sound design.** Three sounds, no music, no voice. Keep it tasteful.
- **Mobile.** Desktop is the target. Mobile would require a different control scheme.
- **Save/load to disk.** Replay log can serve this purpose if we ever need it.

## How phases relate to existing skills/docs

- `ARCHITECTURE.md` — the dataflow and folder layout. Stays the canonical "where do I make a change" doc.
- `.claude/skills/pet-designer/SKILL.md` — used heavily in Phase 2 (new pets). Scaffold command will be added in Phase 4.
- `tests/scenario.ts` + `tests/pets-smoke.test.ts` — already in place. Phase 4 builds CLI tooling on top.
