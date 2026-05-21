// All numbers here are playtest-tunable. Spec deliberately keeps them rough.
import { BOARD_SIZE } from './constants';

export const STARTING_ENERGY = 3;
export const ENERGY_CAP = 10;
export const ENERGY_PER_EXEC_SECOND = 1;

export const EXECUTION_PHASE_SECONDS = 8;
export const PLANNING_TIMEOUT_EARLY_SECONDS = 15;
export const PLANNING_TIMEOUT_LATE_SECONDS = 8;

export const WIN_PAINT_THRESHOLD = Math.floor(BOARD_SIZE * BOARD_SIZE * 0.75); // 108

// Pet stats — keep in lockstep with src/sim/pet-defs.ts
export const MOUSE_STATS = {
  cost: 2,
  speedTilesPerSec: 2,
  weight: 1,
  maxHp: 2,
  atk: 1,
  atkSpeedPerSec: 1.0,
  order: 2,
};

export const ELEPHANT_STATS = {
  cost: 5,
  speedTilesPerSec: 0.5,
  weight: 10,
  maxHp: 8,
  atk: 2,
  atkSpeedPerSec: 0.5,
  order: 1,
};
