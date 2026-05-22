/**
 * board.ts — 12×12 board with vertical water columns.
 *
 * Layout:
 *   Cols 0-4:  land (left lane, 5 wide)
 *   Cols 5-8:  water (channel, 4 wide)
 *   Cols 9-11: land (right lane, 3 wide)
 *
 * Player A starts rows 0-1 (moves UP toward row 11).
 * Player B starts rows 10-11 (moves DOWN toward row 0).
 * A scores when a unit reaches row >= 6. (past center)
 * B scores when a unit reaches row <= 5. (past center)
 */

import type { CBoard, Terrain, Vec2, PlayerId } from './types';

export const BOARD_SIZE = 12;

/** Columns that are water. */
export const WATER_COLS = new Set([5, 6, 7, 8]);

/** Player A's home rows (deploy zone). */
export const HOME_A_ROWS = [0, 1];
/** Player B's home rows (deploy zone). */
export const HOME_B_ROWS = [10, 11];

/** The row threshold: A scores at row >= this. */
export const GOAL_ROW_A = 6;
/** B scores at row <= this. */
export const GOAL_ROW_B = 5;

export function createBoard(): CBoard {
  const size = BOARD_SIZE;
  const terrain: Terrain[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      terrain.push(WATER_COLS.has(x) ? 'water' : 'land');
    }
  }
  return { size, terrain };
}

export function getTerrain(board: CBoard, pos: Vec2): Terrain {
  if (pos.x < 0 || pos.x >= board.size || pos.y < 0 || pos.y >= board.size) return 'land';
  return board.terrain[pos.y * board.size + pos.x];
}

export function inBounds(pos: Vec2): boolean {
  return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

/** Check if a position is in a player's home zone. */
export function isHomeZone(pos: Vec2, player: PlayerId): boolean {
  if (player === 'A') return HOME_A_ROWS.includes(pos.y);
  return HOME_B_ROWS.includes(pos.y);
}

/** Check if a unit at this position has crossed the goal for the given player. */
export function hasCrossedGoal(pos: Vec2, player: PlayerId): boolean {
  if (player === 'A') return pos.y >= GOAL_ROW_A;
  return pos.y <= GOAL_ROW_B;
}

/** Get all tiles in a unit's footprint (for 2×2 units, returns 4 tiles). */
export function footprint(pos: Vec2, size: number): Vec2[] {
  const tiles: Vec2[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      tiles.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return tiles;
}

/** Check if a full footprint is in bounds. */
export function footprintInBounds(pos: Vec2, size: number): boolean {
  return pos.x >= 0 && pos.x + size <= BOARD_SIZE && pos.y >= 0 && pos.y + size <= BOARD_SIZE;
}
