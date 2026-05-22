/**
 * render.ts — Canvas renderer for Critter Crossing.
 *
 * Renders the 12×12 board, terrain, units, selection highlights, valid moves,
 * slide animations, hover feedback, VFX, and last-move indicators.
 */

import type { CGameState, Vec2, PlayerId, CUnit, VFX } from './types';
import { BOARD_SIZE, WATER_COLS, GOAL_ROW_A, GOAL_ROW_B } from './board';
import { getUnitDef } from './units';
import { getValidMoves } from './moves';
import { side } from '../render/palette';

/** Duration of slide animation in ms. */
const SLIDE_MS = 220;

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

/** Smooth ease-out for animations. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Colors ──────────────────────────────────────────────────────────────

const LAND_COLOR = '#1a1f2a';
const LAND_ALT = '#1e2430';
const WATER_COLOR = 'rgba(30, 70, 130, 0.55)';
const WATER_ALT = 'rgba(25, 60, 115, 0.55)';
const WATER_DEEP = 'rgba(20, 50, 100, 0.3)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const GOAL_LINE_COLOR = 'rgba(255, 209, 102, 0.6)';
const SELECT_GLOW = 'rgba(255, 255, 255, 0.35)';
const VALID_MOVE_COLOR = 'rgba(79, 209, 165, 0.30)';
const VALID_MOVE_STROKE = 'rgba(79, 209, 165, 0.7)';
const HOME_A_TINT = 'rgba(91, 141, 239, 0.08)';
const HOME_B_TINT = 'rgba(242, 95, 92, 0.08)';
const HOVER_COLOR = 'rgba(255, 255, 255, 0.08)';
const HOVER_STROKE = 'rgba(255, 255, 255, 0.2)';
const LAST_MOVE_FROM = 'rgba(255, 209, 102, 0.12)';
const LAST_MOVE_TO = 'rgba(255, 209, 102, 0.18)';
const LAST_MOVE_STROKE = 'rgba(255, 209, 102, 0.4)';

// ── Main render ─────────────────────────────────────────────────────────

export function renderCrossingGame(rc: CrossingRenderContext, state: CGameState): void {
  const { ctx, tileSize } = rc;
  const now = performance.now();

  // Clean up expired VFX
  state.vfx = state.vfx.filter(v => now - v.startTime < v.duration);

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

      // Deeper water center gradient
      if (isWater) {
        ctx.fillStyle = WATER_DEEP;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

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

  // Water wave pattern (more visible)
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (const x of WATER_COLS) {
      const { px, py } = tileToPixel(rc, x, y);
      const t = (now / 2500 + x * 0.3 + y * 0.2) % 1;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#7ab8ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const waveY = py + tileSize / 2 + Math.sin(t * Math.PI * 2) * 3.5;
      ctx.moveTo(px + 2, waveY);
      ctx.quadraticCurveTo(px + tileSize / 2, waveY - 5, px + tileSize - 2, waveY);
      ctx.stroke();
      // Second wave
      const waveY2 = py + tileSize * 0.75 + Math.sin((t + 0.4) * Math.PI * 2) * 2;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(px + 5, waveY2);
      ctx.quadraticCurveTo(px + tileSize / 2, waveY2 - 3, px + tileSize - 5, waveY2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Last move indicator (before goal lines so it's below them)
  if (state.lastMove) {
    drawLastMove(rc, state.lastMove);
  }

  // Goal lines
  drawGoalLine(rc, GOAL_ROW_A, 'A');
  drawGoalLine(rc, GOAL_ROW_B, 'B');

  // Hover highlight
  if (state.hoverTile) {
    const { px, py } = tileToPixel(rc, state.hoverTile.x, state.hoverTile.y);
    ctx.fillStyle = HOVER_COLOR;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = HOVER_STROKE;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
  }

  // Valid move highlights (if a unit is selected)
  if (state.selectedUnitId != null) {
    const unit = state.units.find(u => u.unitId === state.selectedUnitId);
    if (unit && !unit.scored) {
      const moves = getValidMoves(state, unit);
      for (const m of moves) {
        const { px, py } = tileToPixel(rc, m.x, m.y);
        // Pulsing valid move
        const pulse = 0.7 + Math.sin(now / 400) * 0.3;
        ctx.fillStyle = VALID_MOVE_COLOR;
        ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.strokeStyle = VALID_MOVE_STROKE;
        ctx.lineWidth = 2 * pulse;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.setLineDash([]);

        // Hover-over-move highlight (brighter)
        if (state.hoverTile && state.hoverTile.x === m.x && state.hoverTile.y === m.y) {
          ctx.fillStyle = 'rgba(79, 209, 165, 0.25)';
          ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        }
      }
    }
  }

  // VFX: score flash, push effects
  for (const vfx of state.vfx) {
    renderVFX(rc, vfx, now);
  }

  // Units (with slide animation)
  for (const unit of state.units) {
    if (unit.scored) continue;
    renderUnit(rc, state, unit, now);
  }
}

function drawLastMove(rc: CrossingRenderContext, lastMove: { from: Vec2; to: Vec2 }): void {
  const { ctx, tileSize } = rc;

  // From tile (faded)
  const f = tileToPixel(rc, lastMove.from.x, lastMove.from.y);
  ctx.fillStyle = LAST_MOVE_FROM;
  ctx.fillRect(f.px, f.py, tileSize, tileSize);
  ctx.strokeStyle = LAST_MOVE_STROKE;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(f.px + 1, f.py + 1, tileSize - 2, tileSize - 2);
  ctx.setLineDash([]);

  // To tile (brighter)
  const t = tileToPixel(rc, lastMove.to.x, lastMove.to.y);
  ctx.fillStyle = LAST_MOVE_TO;
  ctx.fillRect(t.px, t.py, tileSize, tileSize);
  ctx.strokeStyle = LAST_MOVE_STROKE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(t.px + 1, t.py + 1, tileSize - 2, tileSize - 2);

  // Arrow from center to center
  const fx = f.px + tileSize / 2;
  const fy = f.py + tileSize / 2;
  const tx = t.px + tileSize / 2;
  const ty = t.py + tileSize / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGoalLine(rc: CrossingRenderContext, _goalRow: number, player: PlayerId): void {
  const { ctx, tileSize, width } = rc;
  const lineY = player === 'A'
    ? (BOARD_SIZE - GOAL_ROW_A) * tileSize
    : (BOARD_SIZE - 1 - GOAL_ROW_B) * tileSize + tileSize;

  ctx.save();
  ctx.strokeStyle = GOAL_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(width, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label — use friendly names
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = GOAL_LINE_COLOR;
  ctx.textAlign = player === 'A' ? 'left' : 'right';
  const labelX = player === 'A' ? 4 : width - 4;
  const labelY = lineY + (player === 'A' ? -4 : 14);
  ctx.fillText(player === 'A' ? '⬆ your goal' : '⬇ AI goal', labelX, labelY);
  ctx.restore();
}

function renderVFX(rc: CrossingRenderContext, vfx: VFX, now: number): void {
  const { ctx, tileSize } = rc;
  const elapsed = now - vfx.startTime;
  if (elapsed < 0) return; // not started yet

  const progress = Math.min(1, elapsed / vfx.duration);

  if (vfx.type === 'score-flash') {
    const { px, py } = tileToPixel(rc, vfx.pos.x, vfx.pos.y + vfx.size - 1);
    const w = vfx.size * tileSize;
    const h = vfx.size * tileSize;
    const alpha = (1 - progress) * 0.6;
    const expand = progress * 8;

    ctx.save();
    ctx.fillStyle = `rgba(255, 209, 102, ${alpha})`;
    ctx.fillRect(px - expand, py - expand, w + expand * 2, h + expand * 2);

    // "✓" text
    if (progress < 0.7) {
      ctx.font = `bold ${Math.floor(tileSize * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress / 0.7) * 0.9})`;
      const floatY = py + h / 2 - progress * 20;
      ctx.fillText('✓ Scored!', px + w / 2, floatY);
    }
    ctx.restore();
  }

  if (vfx.type === 'push') {
    const { px, py } = tileToPixel(rc, vfx.pos.x, vfx.pos.y);
    const alpha = (1 - progress) * 0.4;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 150, 50, ${alpha})`;
    ctx.lineWidth = 2;
    const expand = progress * 6;
    ctx.strokeRect(px - expand, py - expand, tileSize + expand * 2, tileSize + expand * 2);
    ctx.restore();
  }
}

function renderUnit(rc: CrossingRenderContext, state: CGameState, unit: CUnit, now: number): void {
  const { ctx, tileSize } = rc;
  const def = getUnitDef(unit.defId);
  const palette = side(unit.owner);
  const isSelected = state.selectedUnitId === unit.unitId;
  const isCurrentPlayer = unit.owner === state.currentPlayer;

  // ── Compute animated position ──
  let drawX = unit.pos.x;
  let drawY = unit.pos.y;

  if (unit.animFrom && unit.animStart != null) {
    const elapsed = now - unit.animStart;
    const t = Math.min(1, elapsed / SLIDE_MS);
    if (t < 1) {
      const ease = easeOutCubic(t);
      drawX = unit.animFrom.x + (unit.pos.x - unit.animFrom.x) * ease;
      drawY = unit.animFrom.y + (unit.pos.y - unit.animFrom.y) * ease;
    } else {
      // Animation done — clean up
      unit.animFrom = undefined;
      unit.animStart = undefined;
    }
  }

  const { px, py } = tileToPixel(rc, drawX, drawY + def.size - 1);
  const w = def.size * tileSize;
  const h = def.size * tileSize;

  // Idle bob animation (suppressed during slide)
  const isAnimating = unit.animFrom != null;
  const bobPhase = ((now + unit.unitId * 211) % 2000) / 2000;
  const bobY = isAnimating ? 0 : Math.sin(bobPhase * Math.PI * 2) * 1.5;

  ctx.save();

  // Selection highlight
  if (isSelected) {
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = SELECT_GLOW;
    roundRect(ctx, px + 1, py + 1, w - 2, h - 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Current-player indicator: subtle ring around movable units
  if (isCurrentPlayer && state.phase === 'playing' && !isSelected) {
    const pulseAlpha = 0.1 + Math.sin(now / 600) * 0.05;
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    ctx.setLineDash([]);
  }

  // Owner-colored background
  ctx.fillStyle = palette.accent.replace(')', ', 0.15)').replace('rgb', 'rgba');
  roundRect(ctx, px + 3, py + 3, w - 6, h - 6, 4);
  ctx.fill();

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
