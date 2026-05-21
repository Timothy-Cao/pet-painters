import type { MatchState, PlayerId, Vec2, Direction } from '../../src/types/game';
import { createInitialMatch, submitReady } from '../../src/sim/match';
import { advanceTick } from '../../src/sim/tick';
import { tryDeploy } from '../../src/sim/deploy';
import { scoreFor } from '../../src/sim/board';
import { getPetDef } from '../../src/sim/pet-defs';
import { createRng } from '../../src/sim/rng';
import {
  BOARD_SIZE, TICKS_PER_SEC,
  HOME_A_MIN_X, HOME_A_MAX_X, HOME_A_MIN_Y, HOME_A_MAX_Y,
  HOME_B_MIN_X, HOME_B_MAX_X, HOME_B_MIN_Y, HOME_B_MAX_Y,
} from '../../src/config/constants';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { setEffectsEnabled } from '../../src/render/effects';

// Suppress visual-effect allocation in headless mode. Effects are pushed onto
// a module-level array that nobody reads in the sim, so they're pure waste here.
setEffectsEnabled(false);

export interface Comp {
  /** Pet def IDs to cycle through when filling budget. */
  petIds: string[];
}

export interface MatchResult {
  winner: PlayerId | 'draw';
  scoreA: number;
  scoreB: number;
  ticks: number;
  reason: 'paint_threshold' | 'timeout' | 'stall';
  petsDeployedA: number;
  petsDeployedB: number;
}

export interface MatchOptions {
  energyBudget: number;     // e.g. 20
  maxSeconds: number;       // e.g. 30 → 600 ticks
  seed: number;             // for sim determinism
  stallTicks?: number;      // if no paint change for this many ticks, declare stall (default = 4 * TICKS_PER_SEC)
  winThreshold?: number;    // paint tiles needed to win; defaults to WIN_PAINT_THRESHOLD from balance.ts
}

/**
 * Deploys pets of `comp` for `player` in their home zone using random-affordable picking.
 *
 * Each placement attempt:
 * 1. Build the set of comp pets whose cost ≤ remaining energy.
 * 2. If empty, stop.
 * 3. Pick one randomly using the match RNG (falls back to Math.random if null).
 * 4. Find a placement spot using the existing scan-all-anchors-in-zone approach.
 *    If no spot works for this pet, REMOVE it from the affordable set for this attempt
 *    and retry with the smaller set. If the set empties, stop.
 * 5. Deploy and continue.
 *
 * Returns count of pets deployed.
 */
function deployComp(state: MatchState, player: PlayerId, comp: Comp): number {
  let deployed = 0;
  // Build the scan order over home zone anchors (5×5 corner zones).
  const anchors: Vec2[] = [];
  if (player === 'A') {
    for (let y = HOME_A_MIN_Y; y <= HOME_A_MAX_Y; y++) {
      for (let x = HOME_A_MIN_X; x <= HOME_A_MAX_X; x++) anchors.push({ x, y });
    }
  } else {
    for (let y = HOME_B_MIN_Y; y <= HOME_B_MAX_Y; y++) {
      for (let x = HOME_B_MIN_X; x <= HOME_B_MAX_X; x++) anchors.push({ x, y });
    }
  }
  // Unique pet ids in comp
  const uniquePetIds = [...new Set(comp.petIds)];

  // Helper: use match RNG if available, else Math.random
  const rand = (): number => state.rng ? state.rng.next() : Math.random();

  // Random facing per deployment: A gets N or E (50/50), B gets S or W (50/50).
  const facingChoicesA: Direction[] = ['N', 'E'];
  const facingChoicesB: Direction[] = ['S', 'W'];
  const pickFacing = (): Direction => player === 'A'
    ? facingChoicesA[Math.floor(rand() * 2)]
    : facingChoicesB[Math.floor(rand() * 2)];

  let safetyIterations = 0;
  while (safetyIterations++ < 2000) {
    // Build affordable set: unique pet ids whose cost <= remaining energy
    let affordable = uniquePetIds.filter(id => getPetDef(id).cost <= state.energy[player]);
    if (affordable.length === 0) break;

    // Placement attempt: try randomly picked pets from affordable set until one places
    let placed = false;
    while (affordable.length > 0) {
      // Pick one randomly
      const idx = Math.floor(rand() * affordable.length);
      const defId = affordable[idx];

      // Try to find an anchor for this pet
      let foundAnchor = false;
      const f = pickFacing();
      for (const a of anchors) {
        const result = tryDeploy(state, player, defId, a, f);
        if (result.ok) {
          deployed++;
          foundAnchor = true;
          placed = true;
          break;
        }
      }

      if (foundAnchor) break;
      // No anchor worked for this pet — remove it from affordable for this attempt
      affordable.splice(idx, 1);
    }

    if (!placed) break; // No pet could be placed anywhere — board is full
  }

  // Final pass: ensure no energy is wasted. Greedy fill with the cheapest still-affordable pet
  // until either no pet fits in budget OR no anchor accepts the cheapest.
  const sortedByCost = [...new Set(comp.petIds)].sort(
    (a, b) => getPetDef(a).cost - getPetDef(b).cost,
  );
  let finalSafety = 0;
  while (finalSafety++ < 200) {
    const cheapestAffordable = sortedByCost.find(id => getPetDef(id).cost <= state.energy[player]);
    if (!cheapestAffordable) break;
    let placed = false;
    const f = pickFacing();
    for (const a of anchors) {
      if (tryDeploy(state, player, cheapestAffordable, a, f).ok) {
        deployed++;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }

  return deployed;
}

/**
 * Runs a single headless match.
 * Uses tickMatch (from match.ts) which handles advanceTick + regenEnergy + checkWin.
 */
export function runHeadlessMatch(compA: Comp, compB: Comp, opts: MatchOptions): MatchResult {
  const state = createInitialMatch();
  state.energy.A = opts.energyBudget;
  state.energy.B = opts.energyBudget;
  state.rng = createRng(opts.seed);

  const petsA = deployComp(state, 'A', compA);
  const petsB = deployComp(state, 'B', compB);

  // Transition to execution
  submitReady(state, 'A');
  submitReady(state, 'B');

  const maxTicks = opts.maxSeconds * TICKS_PER_SEC;
  const stallTicks = opts.stallTicks ?? 6 * TICKS_PER_SEC;
  const winThreshold = opts.winThreshold ?? WIN_PAINT_THRESHOLD;
  let lastScoreA = scoreFor(state.board, 'A');
  let lastScoreB = scoreFor(state.board, 'B');
  let ticksSinceChange = 0;

  for (let t = 1; t <= maxTicks; t++) {
    // Use advanceTick directly so we can apply our own win-threshold override.
    // We skip energy regen because no further deployments happen during the headless match.
    advanceTick(state);

    const sA = scoreFor(state.board, 'A');
    const sB = scoreFor(state.board, 'B');
    if (sA !== lastScoreA || sB !== lastScoreB) {
      lastScoreA = sA;
      lastScoreB = sB;
      ticksSinceChange = 0;
    } else {
      ticksSinceChange++;
    }

    if (sA >= winThreshold) {
      return { winner: 'A', scoreA: sA, scoreB: sB, ticks: t, reason: 'paint_threshold', petsDeployedA: petsA, petsDeployedB: petsB };
    }
    if (sB >= winThreshold) {
      return { winner: 'B', scoreA: sA, scoreB: sB, ticks: t, reason: 'paint_threshold', petsDeployedA: petsA, petsDeployedB: petsB };
    }

    if (ticksSinceChange >= stallTicks) {
      // Stall: no paint movement for a while. End early.
      const winner: PlayerId | 'draw' = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
      return { winner, scoreA: sA, scoreB: sB, ticks: t, reason: 'stall', petsDeployedA: petsA, petsDeployedB: petsB };
    }
  }

  const sA = scoreFor(state.board, 'A');
  const sB = scoreFor(state.board, 'B');
  let winner: PlayerId | 'draw';
  if (sA > sB) winner = 'A';
  else if (sB > sA) winner = 'B';
  else winner = 'draw';
  return {
    winner,
    scoreA: sA,
    scoreB: sB,
    ticks: maxTicks,
    reason: 'timeout',
    petsDeployedA: petsA,
    petsDeployedB: petsB,
  };
}
