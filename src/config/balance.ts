// Global, non-pet-specific tunables. Pet stats live alongside each pet in
// src/sim/pets/<name>.ts — keeping them co-located makes single-file pet
// authoring possible.
import { BOARD_SIZE } from './constants';

export const STARTING_ENERGY = 3;
export const ENERGY_CAP = 10;
export const ENERGY_PER_EXEC_SECOND = 1;

export const EXECUTION_PHASE_SECONDS = 6;
export const PLANNING_TIMEOUT_EARLY_SECONDS = 15;
export const PLANNING_TIMEOUT_LATE_SECONDS = 8;

export const WIN_PAINT_THRESHOLD = Math.floor(BOARD_SIZE * BOARD_SIZE * 0.50); // 20*20*0.50 = 200
