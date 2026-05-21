import type { MatchState, PlayerId, Vec2, Direction } from '../../src/types/game';
import { createInitialMatch, submitReady } from '../../src/sim/match';
import { advanceTick } from '../../src/sim/tick';
import { tryDeploy } from '../../src/sim/deploy';
import { scoreFor } from '../../src/sim/board';
import { getPetDef } from '../../src/sim/pet-defs';
import { createRng } from '../../src/sim/rng';
import { BOARD_SIZE, HOME_ROWS, TICKS_PER_SEC } from '../../src/config/constants';
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
 * Deploys pets of `comp` for `player` in their home zone until energy is exhausted.
 * Greedy scan: for A, scan rows 0..HOME_ROWS-1 from left to right; for B, rows BOARD_SIZE-HOME_ROWS..BOARD_SIZE-1 from left to right.
 * Cycles through petIds. Skips pets that can't fit at the current scan position; tries next position.
 * Returns count of pets deployed.
 */
function deployComp(state: MatchState, player: PlayerId, comp: Comp): number {
  let deployed = 0;
  let cycleIdx = 0;
  // Build the scan order over home zone anchors.
  const anchors: Vec2[] = [];
  if (player === 'A') {
    for (let y = 0; y < HOME_ROWS; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) anchors.push({ x, y });
    }
  } else {
    for (let y = BOARD_SIZE - HOME_ROWS; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) anchors.push({ x, y });
    }
  }
  const facing: Direction = player === 'A' ? 'N' : 'S';

  // Outer loop: keep cycling petIds while we still have budget
  let safetyIterations = 0;
  while (safetyIterations++ < 2000) {
    const defId = comp.petIds[cycleIdx % comp.petIds.length];
    const def = getPetDef(defId);
    if (state.energy[player] < def.cost) break;

    // Find first anchor where this pet fits
    let placed = false;
    for (const a of anchors) {
      const result = tryDeploy(state, player, defId, a, facing);
      if (result.ok) {
        deployed++;
        placed = true;
        break;
      }
    }
    if (!placed) break; // no more room

    cycleIdx++;
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
  const stallTicks = opts.stallTicks ?? 4 * TICKS_PER_SEC;
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
