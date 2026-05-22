/**
 * render.ts — Canvas renderer for Critter Crossing.
 *
 * Renders the 12×12 board, terrain, units, selection highlights, valid moves.
 */

import type { CGameState, Vec2, PlayerId } from './types';
import { BOARD_SIZE, WATER_COLS, GOAL_ROW_A, GOAL_ROW_B } from './board';
import { getUnitDef } from './units';
import { getValidMoves } from './moves';
import { side } from '../render/palette';

export interface CrossingRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tileSize: number;
  width: number;
  height: number;
}

export function createCrossingRC(canvas: HTMLCanvasElement): CrossingRenderContext {
  const ctx = canvas.getContext('2d')!;
  const tileSize = canvas.width / BOARD_SIZE;
  return {
    canvas,
    ctx,
    tileSize,
    width: canvas.width,
    height: canvas.height,
  };
}

/** Convert board coords to pixel coords (top-left of tile). Y is inverted (row 0 = bottom). */
function tileToPixel(rc: CrossingRenderContext, x: number, y: number): { px: number; py: number } {
  return {
    px: x * rc.tileSize,
    py: (BOARD_SIZE - 1 - y) * rc.tileSize,
  };
}

// ── Colors ──────────────────────────────────────────────────────────────

const LAND_COLOR = '#1a1f2a';
const LAND_ALT = '#1e2430';
const WATER_COLOR = 'rgba(40, 80, 140, 0.45)';
const WATER_ALT = 'rgba(35, 70, 125, 0.45)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const GOAL_LINE_COLOR = 'rgba(255, 209, 102, 0.5)';
const SELECT_GLOW = 'rgba(255, 255, 255, 0.35)';
const VALID_MOVE_COLOR = 'rgba(79, 209, 165, 0.35)';
const VALID_MOVE_STROKE = 'rgba(79, 209, 165, 0.7)';
const HOME_A_TINT = 'rgba(91, 141, 239, 0.08)';
const HOME_B_TINT = 'rgba(242, 95, 92, 0.08)';

// ── Main render ─────────────────────────────────────────────────────────

export function renderCrossingGame(rc: CrossingRenderContext, state: CGameState): void {
  const { ctx, tileSize } = rc;

  // Clear
  ctx.fillStyle = '#0e1014';
  ctx.fillRect(0, 0, rc.width, rc.height);

  // Draw terrain tiles
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const { px, py } = tileToPixel(rc, x, y);
      const isWater = WATER_COLS.has(x);
      const checker = (x + y) % 2 === 0;

      ctx.fillStyle = isWater
        ? (checker ? WATER_COLOR : WATER_ALT)
        : (checker ? LAND_COLOR : LAND_ALT);
      ctx.fillRect(px, py, tileSize, tileSize);

      // Home zone tints
      if (y <= 1) {
        ctx.fillStyle = HOME_A_TINT;
        ctx.fillRect(px, py, tileSize, tileSize);
      } else if (y >= 10) {
        ctx.fillStyle = HOME_B_TINT;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Grid lines
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, tileSize, tileSize);
    }
  }

  // Water wave pattern (subtle)
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (const x of WATER_COLS) {
      const { px, py } = tileToPixel(rc, x, y);
      const t = (performance.now() / 2000 + x * 0.3 + y * 0.2) % 1;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#88bbff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const waveY = py + tileSize / 2 + Math.sin(t * Math.PI * 2) * 3;
      ctx.moveTo(px + 2, waveY);
      ctx.quadraticCurveTo(px + tileSize / 2, waveY - 4, px + tileSize - 2, waveY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Goal lines
  drawGoalLine(rc, GOAL_ROW_A, 'A');
  drawGoalLine(rc, GOAL_ROW_B, 'B');

  // Valid move highlights (if a unit is selected)
  if (state.selectedUnitId != null) {
    const unit = state.units.find(u => u.unitId === state.selectedUnitId);
    if (unit && !unit.scored) {
      const moves = getValidMoves(state, unit);
      for (const m of moves) {
        const { px, py } = tileToPixel(rc, m.x, m.y);
        ctx.fillStyle = VALID_MOVE_COLOR;
        ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.strokeStyle = VALID_MOVE_STROKE;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.setLineDash([]);
      }
    }
  }

  // Units
  for (const unit of state.units) {
    if (unit.scored) continue;
    renderUnit(rc, state, unit);
  }
}

function drawGoalLine(rc: CrossingRenderContext, _goalRow: number, player: PlayerId): void {
  const { ctx, tileSize, width } = rc;
  // The goal line sits at the border between rows
  // For A (scoring at row >= 6): line at bottom of row 6 = top of row 5 visually
  // Since Y is inverted: row 6 pixel-top = (BOARD_SIZE - 1 - 6) * tileSize
  const lineY = player === 'A'
    ? (BOARD_SIZE - GOAL_ROW_A) * tileSize  // bottom edge of the row below goal
    : (BOARD_SIZE - 1 - GOAL_ROW_B) * tileSize + tileSize; // top edge of row above goal

  ctx.save();
  ctx.strokeStyle = GOAL_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(width, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = GOAL_LINE_COLOR;
  ctx.textAlign = player === 'A' ? 'left' : 'right';
  const labelX = player === 'A' ? 4 : width - 4;
  const labelY = lineY + (player === 'A' ? -4 : 12);
  ctx.fillText(player === 'A' ? 'A goal' : 'B goal', labelX, labelY);
  ctx.restore();
}

function renderUnit(rc: CrossingRenderContext, state: CGameState, unit: import('./types').CUnit): void {
  const { ctx, tileSize } = rc;
  const def = getUnitDef(unit.defId);
  const { px, py } = tileToPixel(rc, unit.pos.x, unit.pos.y + def.size - 1);
  const w = def.size * tileSize;
  const h = def.size * tileSize;
  const palette = side(unit.owner);
  const isSelected = state.selectedUnitId === unit.unitId;
  const isCurrentPlayer = unit.owner === state.currentPlayer;

  // Idle bob animation
  const bobPhase = ((performance.now() + unit.unitId * 211) % 2000) / 2000;
  const bobY = Math.sin(bobPhase * Math.PI * 2) * 1.5;

  ctx.save();

  // Selection highlight
  if (isSelected) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = SELECT_GLOW;
    ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
    ctx.shadowBlur = 0;
  }

  // Current-player indicator: subtle ring around movable units
  if (isCurrentPlayer && state.phase === 'playing' && !isSelected) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    ctx.setLineDash([]);
  }

  // Owner-colored background
  ctx.fillStyle = palette.accent.replace(')', ', 0.15)').replace('rgb', 'rgba');
  ctx.fillRect(px + 3, py + 3, w - 6, h - 6);

  // Owner ring
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  roundRect(ctx, px + 3, py + 3, w - 6, h - 6, 4);
  ctx.stroke();

  // Emoji
  ctx.font = `${Math.floor(h * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(def.emoji, px + w / 2, py + h / 2 + bobY + 1);

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Input helpers ───────────────────────────────────────────────────────

/** Convert a canvas click to board coordinates. */
export function pixelToTile(rc: CrossingRenderContext, clientX: number, clientY: number): Vec2 | null {
  const rect = rc.canvas.getBoundingClientRect();
  const scaleX = rc.canvas.width / rect.width;
  const scaleY = rc.canvas.height / rect.height;
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  const x = Math.floor(px / rc.tileSize);
  const y = BOARD_SIZE - 1 - Math.floor(py / rc.tileSize);
  if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
    return { x, y };
  }
  return null;
}
