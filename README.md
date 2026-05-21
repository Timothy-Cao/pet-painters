# Pet Painters

A two-player territory game where you drop autonomous emoji pets onto a board, and they walk and paint tiles in your color. First to paint 75% of the board wins.

**Status:** v1.1 playable — see the [design spec](docs/superpowers/specs/2026-05-20-pet-painters-design.md) and [implementation plan](docs/superpowers/plans/2026-05-20-pet-painters-v1.1.md). 47 unit tests, deterministic simulation, hot-seat 2-player.

## Concept

- Pets are autonomous. You don't move them; you deploy them with a chosen position and facing direction, and they execute their behavior on their own.
- Pets paint the tiles they walk across. Painting = territory.
- The game runs as a 20 Hz simulation, paused every ~8 seconds for a planning phase where both players queue new deployments using accumulated energy.
- v1.1 ships with two pets: a fast 1×1 **Mouse** and a slow 2×2 **Elephant**.

## Known v1.1 limitations

- Pets jump tile-to-tile each move tick instead of interpolating smoothly between them. Interpolation is purely a visual concern and can be added without changing simulation logic. (Tracked for v1.2.)
- Hot-seat planning shows both players' deployed pets on the same screen — there is no "screen handoff" to hide one player's queue from the other. v1.1 is a single-developer playtest tool; secrecy can be added later.
- Planning phase has no timer (the soft-timeout from the spec is unimplemented). Both players must press Space to ready.
- Deployments are committed immediately on left-click (energy is debited and the pet appears on the board right away). The spec's "queue then batch-apply at execution start" flow and right-click cancel/refund are not implemented in v1.1.
- Simultaneous-threshold tiebreak: if both players cross 75% on the exact same tick, A wins on equal score rather than declaring a draw. Mechanically near-impossible in v1.1.
- No sound, no animations, no game-over restart button — refresh the page to play again.

## Running locally

```bash
npm install
npm run dev
```

Open the browser at http://localhost:5173.

## Running tests

```bash
npm test
```
