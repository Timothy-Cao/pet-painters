import { RenderContext, tileToPixel } from './canvas';
import type { Board } from '../types/game';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

const COLORS = {
  neutral: '#222633',
  A: '#5b8def',
  B: '#f25f5c',
};
const HOME_A_TINT = 'rgba(91, 141, 239, 0.10)';
const HOME_B_TINT = 'rgba(242, 95, 92, 0.10)';
const GRID_LINE = 'rgba(255, 255, 255, 0.04)';
const HOME_BORDER_A = 'rgba(91, 141, 239, 0.55)';
const HOME_BORDER_B = 'rgba(242, 95, 92, 0.55)';

function isHomeRow(y: number, who: 'A' | 'B'): boolean {
  if (who === 'A') return y < HOME_ROWS;
  return y >= BOARD_SIZE - HOME_ROWS;
}

export function renderBoard(rc: RenderContext, board: Board): void {
  const { ctx, tileSize } = rc;
  const inset = 1;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const color = board.tiles[y * BOARD_SIZE + x];
      const { px, py } = tileToPixel(rc, x, y);

      // Base tile color
      ctx.fillStyle = COLORS[color];
      ctx.fillRect(px, py, tileSize, tileSize);

      // Home zone tint overlay on neutral tiles only (don't dim painted tiles)
      if (color === 'neutral') {
        if (isHomeRow(y, 'A')) {
          ctx.fillStyle = HOME_A_TINT;
          ctx.fillRect(px, py, tileSize, tileSize);
        } else if (isHomeRow(y, 'B')) {
          ctx.fillStyle = HOME_B_TINT;
          ctx.fillRect(px, py, tileSize, tileSize);
        }
      }

      // Soft gridline
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

      // Subtle inner highlight on painted tiles for depth
      if (color !== 'neutral') {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px + inset, py + inset, tileSize - inset * 2, 2);
      }
    }
  }

  // Home zone outer borders (dashed)
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = HOME_BORDER_A;
  const aTop = tileToPixel(rc, 0, HOME_ROWS - 1).py;
  ctx.beginPath();
  ctx.moveTo(0, aTop + tileSize);
  ctx.lineTo(BOARD_SIZE * tileSize, aTop + tileSize);
  ctx.stroke();

  ctx.strokeStyle = HOME_BORDER_B;
  const bBottom = tileToPixel(rc, 0, BOARD_SIZE - HOME_ROWS).py;
  ctx.beginPath();
  ctx.moveTo(0, bBottom);
  ctx.lineTo(BOARD_SIZE * tileSize, bBottom);
  ctx.stroke();
  ctx.restore();
}
