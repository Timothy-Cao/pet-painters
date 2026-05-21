/**
 * Multi-round headless sim.
 *
 * Match flow:
 *   - Up to MAX_ROUNDS rounds per match.
 *   - Each round:
 *     1. Build phase (instant): draw 3 pets randomly from comp (with replacement).
 *        For each drawn pet, attempt random placement in home zone (up to 10 retries).
 *        Skip if insufficient energy or no valid tile found.
 *     2. Execution phase: run for EXEC_SECONDS seconds (EXEC_TICKS ticks).
 *        Energy regens +1/sec during execution. Win condition checked every tick.
 *   - Match ends on paint threshold, round cap, or stall.
 */
import type { MatchState, PlayerId, Vec2, Direction } from '../../src/types/game';
import { createInitialMatch, submitReady, endExecution } from '../../src/sim/match';
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
import { WIN_PAINT_THRESHOLD, ENERGY_CAP, ENERGY_PER_EXEC_SECOND } from '../../src/config/balance';
import { setEffectsEnabled } from '../../src/render/effects';

setEffectsEnabled(false);

export interface Comp {
  petIds: string[];
}

export interface MultiRoundMatchResult {
  winner: PlayerId | 'draw';
  scoreA: number;
  scoreB: number;
  totalTicks: number;
  roundsPlayed: number;
  reason: 'paint_threshold' | 'round_cap' | 'stall';
  petsDeployedA: number;
  petsDeployedB: number;
}

export interface MultiRoundMatchOptions {
  maxRounds?: number;          // default 8
  execSeconds?: number;        // seconds per execution phase, default 5
  startEnergy?: number;        // starting energy, default 3
  seed: number;
  stallSeconds?: number;       // no-change stall threshold across the entire match, default 10s
  winThreshold?: number;
}

const MAX_ROUNDS_DEFAULT = 8;
const EXEC_SECONDS_DEFAULT = 5;
const START_ENERGY_DEFAULT = 3;
const STALL_SECONDS_DEFAULT = 10;
const PLACEMENT_RETRIES = 10;
const DRAWS_PER_ROUND = 3;

/**
 * Attempt to deploy a single pet for a player at a random valid position.
 * Returns true if successfully deployed.
 */
function tryRandomDeploy(
  state: MatchState,
  player: PlayerId,
  defId: string,
  rng: { next(): number },
): boolean {
  const def = getPetDef(defId);
  if (state.energy[player] < def.cost) return false;

  const { w, h } = def.size;
  // Random facing: A gets N or E (50/50), B gets S or W (50/50).
  const facingChoicesA: Direction[] = ['N', 'E'];
  const facingChoicesB: Direction[] = ['S', 'W'];
  const facing: Direction = player === 'A'
    ? facingChoicesA[Math.floor(rng.next() * 2)]
    : facingChoicesB[Math.floor(rng.next() * 2)];

  // Home zone bounds for this player (5×5 corner zones)
  const xMin = player === 'A' ? HOME_A_MIN_X : HOME_B_MIN_X;
  const xMax = player === 'A' ? HOME_A_MAX_X : HOME_B_MAX_X;
  const yMin = player === 'A' ? HOME_A_MIN_Y : HOME_B_MIN_Y;
  const yMax = player === 'A' ? HOME_A_MAX_Y : HOME_B_MAX_Y;

  const maxAnchorX = xMax - w + 1;
  const maxAnchorY = yMax - h + 1;

  // If pet footprint doesn't fit in home zone, skip
  if (maxAnchorX < xMin || maxAnchorY < yMin) return false;

  for (let attempt = 0; attempt < PLACEMENT_RETRIES; attempt++) {
    const x = xMin + Math.floor(rng.next() * (maxAnchorX - xMin + 1));
    const y = yMin + Math.floor(rng.next() * (maxAnchorY - yMin + 1));
    const anchor: Vec2 = { x, y };
    const result = tryDeploy(state, player, defId, anchor, facing);
    if (result.ok) return true;
  }
  return false;
}

/**
 * Build phase: draw DRAWS_PER_ROUND pets randomly from comp and attempt deployment.
 * Returns number of pets successfully deployed.
 */
function buildPhase(
  state: MatchState,
  player: PlayerId,
  comp: Comp,
  rng: { next(): number },
): number {
  let deployed = 0;
  for (let d = 0; d < DRAWS_PER_ROUND; d++) {
    const petIdx = Math.floor(rng.next() * comp.petIds.length);
    const defId = comp.petIds[petIdx];
    if (tryRandomDeploy(state, player, defId, rng)) {
      deployed++;
    }
  }
  return deployed;
}

/**
 * Manually regen energy during execution: +1 per second elapsed since exec phase start.
 * Called after every tick so we replicate the logic in match.ts regenEnergy().
 */
function doEnergyRegen(state: MatchState): void {
  const elapsed = state.tick - state.execPhaseStartTick;
  if (elapsed > 0 && elapsed % TICKS_PER_SEC === 0) {
    state.energy.A = Math.min(ENERGY_CAP, state.energy.A + ENERGY_PER_EXEC_SECOND);
    state.energy.B = Math.min(ENERGY_CAP, state.energy.B + ENERGY_PER_EXEC_SECOND);
  }
}

export function runMultiRoundMatch(
  compA: Comp,
  compB: Comp,
  opts: MultiRoundMatchOptions,
): MultiRoundMatchResult {
  const maxRounds = opts.maxRounds ?? MAX_ROUNDS_DEFAULT;
  const execSeconds = opts.execSeconds ?? EXEC_SECONDS_DEFAULT;
  const execTicks = execSeconds * TICKS_PER_SEC;
  const startEnergy = opts.startEnergy ?? START_ENERGY_DEFAULT;
  const stallTicks = (opts.stallSeconds ?? STALL_SECONDS_DEFAULT) * TICKS_PER_SEC;
  const winThreshold = opts.winThreshold ?? WIN_PAINT_THRESHOLD;

  // Per-match RNG: single stream drives both placement draws and sim internals.
  const rng = createRng(opts.seed);

  const state: MatchState = createInitialMatch();
  state.rng = rng;
  state.energy.A = startEnergy;
  state.energy.B = startEnergy;

  let totalTicks = 0;
  let totalPetsDeployedA = 0;
  let totalPetsDeployedB = 0;
  let lastScoreA = scoreFor(state.board, 'A');
  let lastScoreB = scoreFor(state.board, 'B');
  let ticksSinceChange = 0;

  for (let round = 1; round <= maxRounds; round++) {
    // --- Build phase ---
    // state is in 'planning' phase at this point (initial or after endExecution)
    totalPetsDeployedA += buildPhase(state, 'A', compA, rng);
    totalPetsDeployedB += buildPhase(state, 'B', compB, rng);

    // Transition to execution
    submitReady(state, 'A');
    submitReady(state, 'B');

    // --- Execution phase ---
    for (let t = 0; t < execTicks; t++) {
      advanceTick(state);
      doEnergyRegen(state);
      totalTicks++;

      const sA = scoreFor(state.board, 'A');
      const sB = scoreFor(state.board, 'B');

      // Track stall across the whole match
      if (sA !== lastScoreA || sB !== lastScoreB) {
        lastScoreA = sA;
        lastScoreB = sB;
        ticksSinceChange = 0;
      } else {
        ticksSinceChange++;
      }

      // Win check
      if (sA >= winThreshold) {
        return {
          winner: 'A', scoreA: sA, scoreB: sB,
          totalTicks, roundsPlayed: round,
          reason: 'paint_threshold',
          petsDeployedA: totalPetsDeployedA, petsDeployedB: totalPetsDeployedB,
        };
      }
      if (sB >= winThreshold) {
        return {
          winner: 'B', scoreA: sA, scoreB: sB,
          totalTicks, roundsPlayed: round,
          reason: 'paint_threshold',
          petsDeployedA: totalPetsDeployedA, petsDeployedB: totalPetsDeployedB,
        };
      }

      // Stall check
      if (ticksSinceChange >= stallTicks) {
        const winner: PlayerId | 'draw' = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
        return {
          winner, scoreA: sA, scoreB: sB,
          totalTicks, roundsPlayed: round,
          reason: 'stall',
          petsDeployedA: totalPetsDeployedA, petsDeployedB: totalPetsDeployedB,
        };
      }
    }

    // End execution phase, transition back to planning for next round
    endExecution(state);
  }

  // Round cap reached
  const sA = scoreFor(state.board, 'A');
  const sB = scoreFor(state.board, 'B');
  const winner: PlayerId | 'draw' = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
  return {
    winner, scoreA: sA, scoreB: sB,
    totalTicks, roundsPlayed: maxRounds,
    reason: 'round_cap',
    petsDeployedA: totalPetsDeployedA, petsDeployedB: totalPetsDeployedB,
  };
}
