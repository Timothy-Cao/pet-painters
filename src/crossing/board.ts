/**
 * board.ts — 8×8 board for Critter Crossing v2.
 *
 * Simple land-only board. No water.
 * Player A starts row 0 (bottom), scores at row 7 (top).
 * Player B starts row 7 (top), scores at row 0 (bottom).
 */

import type { Vec2, PlayerId } from './types';

export const BOARD_SIZE = 8;

/** Player A scores at this row. */
export const GOAL_ROW_A = 7;
/** Player B scores at this row. */
export const GOAL_ROW_B = 0;

/** Home row where captured units respawn. */
export function homeRow(player: PlayerId): number {
  return player === 'A' ? 0 : 7;
}

/** The opponent's back row (where you want to reach). */
export function goalRow(player: PlayerId): number {
  return player === 'A' ? GOAL_ROW_A : GOAL_ROW_B;
}

export function inBounds(pos: Vec2): boolean {
  return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

/** Direction: +1 = toward A's goal (up), -1 = toward B's goal (down). */
export function forwardDir(player: PlayerId): number {
  return player === 'A' ? 1 : -1;
}
