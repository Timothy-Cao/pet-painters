import type { Board, TileColor, Vec2, PlayerId } from '../types/game';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

function inBounds(board: Board, p: Vec2): boolean {
  return p.x >= 0 && p.x < board.size && p.y >= 0 && p.y < board.size;
}

export function createInitialBoard(): Board {
  const size = BOARD_SIZE;
  const tiles: TileColor[] = new Array(size * size).fill('neutral');
  for (let y = 0; y < HOME_ROWS; y++) {
    for (let x = 0; x < size; x++) tiles[y * size + x] = 'A';
  }
  for (let y = size - HOME_ROWS; y < size; y++) {
    for (let x = 0; x < size; x++) tiles[y * size + x] = 'B';
  }
  return { size, tiles };
}

export function getTile(board: Board, p: Vec2): TileColor {
  if (!inBounds(board, p)) return 'neutral';
  return board.tiles[p.y * board.size + p.x];
}

export function paintTile(board: Board, p: Vec2, color: TileColor): void {
  if (!inBounds(board, p)) return;
  board.tiles[p.y * board.size + p.x] = color;
}

export function scoreFor(board: Board, player: PlayerId): number {
  let n = 0;
  for (const t of board.tiles) if (t === player) n++;
  return n;
}
