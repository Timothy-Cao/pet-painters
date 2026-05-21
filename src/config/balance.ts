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
  speedTilesPerSec: 4,
  weight: 1,
  maxHp: 3,
  atk: 1,
  atkSpeedPerSec: 1.0,
  order: 2,
};

export const ELEPHANT_STATS = {
  cost: 5,
  speedTilesPerSec: 0.5,
  weight: 10,
  maxHp: 25,
  atk: 2,
  atkSpeedPerSec: 0.5,
  order: 1,
};

export const RABBIT_STATS = {
  cost: 3,
  speedTilesPerSec: 2,
  weight: 1,
  maxHp: 3,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 3,
};

export const SKUNK_STATS = {
  cost: 3,
  speedTilesPerSec: 1,
  sprayPerSec: 2,             // pushes adjacent enemies' facing twice a second
  weight: 2,
  maxHp: 4,
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
};

export const TURTLE_STATS = {
  cost: 4,
  speedTilesPerSec: 0.5,      // very slow walker
  splashPerSec: 1,            // paints adjacent tiles every second
  weight: 3,
  maxHp: 8,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 2,
};

export const CAT_STATS = {
  cost: 4,
  speedTilesPerSec: 1,        // wander speed
  huntSpeedTilesPerSec: 3,    // when enemy spotted ahead
  weight: 2,
  maxHp: 5,
  atk: 3,
  atkSpeedPerSec: 1.5,
  order: 2,
  sightRange: 5,
};
