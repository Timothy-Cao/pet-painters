import { RenderContext, tileToPixel } from './canvas';
import type { Board } from '../types/game';
import { BOARD_SIZE } from '../config/constants';

const COLORS = {
  neutral: '#3a3a3a',
  A: '#5688f5',   // blue
  B: '#f55656',   // red
};

export function renderBoard(rc: RenderContext, board: Board): void {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const color = board.tiles[y * BOARD_SIZE + x];
      const { px, py } = tileToPixel(rc, x, y);
      rc.ctx.fillStyle = COLORS[color];
      rc.ctx.fillRect(px, py, rc.tileSize, rc.tileSize);
      rc.ctx.strokeStyle = '#222';
      rc.ctx.strokeRect(px, py, rc.tileSize, rc.tileSize);
    }
  }
}
