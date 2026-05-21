import { RenderContext, tileToPixel } from './canvas';
import type { Board } from '../types/game';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

const COLORS = {
  neutral: '#1a1e29',
  A: '#3a567f',
  B: '#7f3a3a',
};
const HOME_A_TINT = 'rgba(91, 141, 239, 0.06)';
const HOME_B_TINT = 'rgba(242, 95, 92, 0.06)';
const GRID_LINE = 'rgba(255, 255, 255, 0.07)';
const HOME_BORDER_A = 'rgba(91, 141, 239, 0.4)';
const HOME_BORDER_B = 'rgba(242, 95, 92, 0.4)';

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
      const homeOwner = isHomeRow(y, 'A') ? 'A' : isHomeRow(y, 'B') ? 'B' : null;

      ctx.fillStyle = COLORS[color];
      ctx.fillRect(px, py, tileSize, tileSize);

      // Neutral tiles get a 2x2 dot pattern — gives empty territory a tactile
      // texture so painted territory reads as visibly more "solid."
      if (color === 'neutral') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        const dotR = 1;
        const inset = tileSize / 4;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            ctx.fillRect(px + inset + dx * (tileSize / 2) - dotR / 2,
                         py + inset + dy * (tileSize / 2) - dotR / 2,
                         dotR, dotR);
          }
        }
      }

      if (color === 'neutral' && homeOwner) {
        ctx.fillStyle = homeOwner === 'A' ? HOME_A_TINT : HOME_B_TINT;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

      if (color !== 'neutral') {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px + inset, py + inset, tileSize - inset * 2, 2);
      }

      // Home-row "permanent" hatch in the bottom-right corner — a small
      // double-tick mark so players can tell painted home from painted ground.
      if (homeOwner) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        const m = tileSize - 5;
        ctx.beginPath();
        ctx.moveTo(px + m, py + tileSize - 3);
        ctx.lineTo(px + tileSize - 3, py + m);
        ctx.moveTo(px + m - 3, py + tileSize - 3);
        ctx.lineTo(px + tileSize - 3, py + m - 3);
        ctx.stroke();
        ctx.restore();
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
