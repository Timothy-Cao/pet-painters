import { RenderContext, tileToPixel } from './canvas';
import type { Board, PlayerId } from '../types/game';
import {
  BOARD_SIZE,
  HOME_A_MIN_X, HOME_A_MAX_X, HOME_A_MIN_Y, HOME_A_MAX_Y,
  HOME_B_MIN_X, HOME_B_MAX_X, HOME_B_MIN_Y, HOME_B_MAX_Y,
} from '../config/constants';

import { getPalette } from './palette';
import { computeVisibility, tileKey } from '../sim/board';

const GRID_LINE = 'rgba(255, 255, 255, 0.07)';
const FOG_FILL = 'rgba(0, 0, 0, 0.52)';

function isHomeCorner(x: number, y: number): 'A' | 'B' | null {
  if (x >= HOME_A_MIN_X && x <= HOME_A_MAX_X && y >= HOME_A_MIN_Y && y <= HOME_A_MAX_Y) return 'A';
  if (x >= HOME_B_MIN_X && x <= HOME_B_MAX_X && y >= HOME_B_MIN_Y && y <= HOME_B_MAX_Y) return 'B';
  return null;
}

/**
 * Render the board tiles.
 * @param viewer  When set, apply fog of war for that player.
 *                Pass null (or omit) for sandbox/spectator — no fog.
 */
export function renderBoard(rc: RenderContext, board: Board, viewer?: PlayerId | null): void {
  const { ctx, tileSize } = rc;
  const inset = 1;
  const palette = getPalette();
  const fill: Record<'A' | 'B' | 'neutral', string> = {
    A: palette.A.tile,
    B: palette.B.tile,
    neutral: palette.neutral,
  };

  // Pre-compute visibility set when fog of war is active.
  const visSet: Set<number> | null = viewer ? computeVisibility(board, viewer) : null;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const rawColor = board.tiles[y * BOARD_SIZE + x];
      const { px, py } = tileToPixel(rc, x, y);
      const homeOwner = isHomeCorner(x, y);

      // Fog of war: if a viewer is set and this tile is outside their visibility,
      // render it as neutral (opponent paint is hidden) and add fog overlay below.
      const isVisible = !visSet || visSet.has(tileKey(x, y));
      const color: typeof rawColor = isVisible ? rawColor : 'neutral';

      ctx.fillStyle = fill[color];
      ctx.fillRect(px, py, tileSize, tileSize);

      // Neutral tiles get a 2x2 dot pattern — gives empty territory a tactile
      // texture so painted territory reads as visibly more "solid."
      if (color === 'neutral') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        const dotR = 1;
        const dotInset = tileSize / 4;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            ctx.fillRect(px + dotInset + dx * (tileSize / 2) - dotR / 2,
                         py + dotInset + dy * (tileSize / 2) - dotR / 2,
                         dotR, dotR);
          }
        }
      }

      if (color === 'neutral' && homeOwner) {
        ctx.fillStyle = homeOwner === 'A' ? palette.A.soft : palette.B.soft;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

      if (color !== 'neutral') {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px + inset, py + inset, tileSize - inset * 2, 2);
      }

      // Home-zone "permanent" hatch in the bottom-right corner.
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

      // Fog overlay — drawn on top of the tile after all details.
      if (!isVisible) {
        ctx.fillStyle = FOG_FILL;
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }

  // Home zone corner borders (dashed box outlines).
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;

  // Player A corner (bottom-left)
  ctx.strokeStyle = palette.A.glow;
  const aCornerLeft = tileToPixel(rc, HOME_A_MIN_X, HOME_A_MAX_Y);
  ctx.strokeRect(aCornerLeft.px, aCornerLeft.py, (HOME_A_MAX_X - HOME_A_MIN_X + 1) * tileSize, (HOME_A_MAX_Y - HOME_A_MIN_Y + 1) * tileSize);

  // Player B corner (top-right)
  ctx.strokeStyle = palette.B.glow;
  const bCornerLeft = tileToPixel(rc, HOME_B_MIN_X, HOME_B_MAX_Y);
  ctx.strokeRect(bCornerLeft.px, bCornerLeft.py, (HOME_B_MAX_X - HOME_B_MIN_X + 1) * tileSize, (HOME_B_MAX_Y - HOME_B_MIN_Y + 1) * tileSize);

  ctx.restore();
}
