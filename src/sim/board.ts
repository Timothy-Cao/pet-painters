import type { Board, TileColor, Vec2, PlayerId } from '../types/game';
import {
  BOARD_SIZE,
  HOME_A_MIN_X, HOME_A_MAX_X, HOME_A_MIN_Y, HOME_A_MAX_Y,
  HOME_B_MIN_X, HOME_B_MAX_X, HOME_B_MIN_Y, HOME_B_MAX_Y,
} from '../config/constants';
import { pushSplat } from '../render/effects';

/** Encodes a Vec2 as a single integer key for use in a Set. */
function tileKey(x: number, y: number): number {
  return y * BOARD_SIZE + x;
}

/**
 * Compute which tiles are visible to the given player.
 * A tile is visible if it is within Chebyshev distance ≤2 of any tile painted
 * in the player's color (including their pre-painted home zone).
 * Returns a Set of encoded tile keys (tileKey(x, y)).
 */
export function computeVisibility(board: Board, player: PlayerId): Set<number> {
  const visible = new Set<number>();
  const size = board.size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board.tiles[y * size + x] === player) {
        // Expand by Chebyshev distance 2
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              visible.add(tileKey(nx, ny));
            }
          }
        }
      }
    }
  }
  return visible;
}

export { tileKey };

function inBounds(board: Board, p: Vec2): boolean {
  return p.x >= 0 && p.x < board.size && p.y >= 0 && p.y < board.size;
}

export function createInitialBoard(): Board {
  const size = BOARD_SIZE;
  const tiles: TileColor[] = new Array(size * size).fill('neutral');
  // Player A: bottom-left 5×5 corner
  for (let y = HOME_A_MIN_Y; y <= HOME_A_MAX_Y; y++) {
    for (let x = HOME_A_MIN_X; x <= HOME_A_MAX_X; x++) tiles[y * size + x] = 'A';
  }
  // Player B: top-right 5×5 corner
  for (let y = HOME_B_MIN_Y; y <= HOME_B_MAX_Y; y++) {
    for (let x = HOME_B_MIN_X; x <= HOME_B_MAX_X; x++) tiles[y * size + x] = 'B';
  }
  return { size, tiles };
}

export function getTile(board: Board, p: Vec2): TileColor {
  if (!inBounds(board, p)) return 'neutral';
  return board.tiles[p.y * board.size + p.x];
}

/** Returns which player's home zone this tile is in, or null if neutral territory. */
export function isHomeZone(p: Vec2): 'A' | 'B' | null {
  if (p.x >= HOME_A_MIN_X && p.x <= HOME_A_MAX_X && p.y >= HOME_A_MIN_Y && p.y <= HOME_A_MAX_Y) return 'A';
  if (p.x >= HOME_B_MIN_X && p.x <= HOME_B_MAX_X && p.y >= HOME_B_MIN_Y && p.y <= HOME_B_MAX_Y) return 'B';
  return null;
}

export function paintTile(board: Board, p: Vec2, color: TileColor): void {
  if (!inBounds(board, p)) return;
  if (isHomeZone(p) !== null) return;
  const idx = p.y * board.size + p.x;
  if (board.tiles[idx] === color) return;     // no-op when nothing changes
  board.tiles[idx] = color;
  if (color === 'A' || color === 'B') {
    pushSplat(p.x, p.y, color);
  }
}

export function scoreFor(board: Board, player: PlayerId): number {
  let n = 0;
  for (const t of board.tiles) if (t === player) n++;
  return n;
}
