/**
 * render.ts — Canvas renderer for Critter Crossing v2.
 *
 * 8×8 board, no water, chess-inspired units with capture/push mechanics.
 * Renders board, units, selection highlights, valid moves, animations, VFX.
 */

import type { CGameState, Vec2, PlayerId, CUnit, VFX } from './types';
import { BOARD_SIZE, GOAL_ROW_A, GOAL_ROW_B } from './board';
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
  return { canvas, ctx, tileSize, width: canvas.width, height: canvas.height };
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

const LAND_DARK = '#1a1f2a';
const LAND_LIGHT = '#1e2430';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const GOAL_TINT_A = 'rgba(91, 141, 239, 0.10)';
const GOAL_TINT_B = 'rgba(242, 95, 92, 0.10)';
const GOAL_LINE_COLOR = 'rgba(255, 209, 102, 0.6)';
const SELECT_GLOW = 'rgba(255, 255, 255, 0.35)';
const VALID_MOVE_COLOR = 'rgba(79, 209, 165, 0.30)';
const VALID_MOVE_STROKE = 'rgba(79, 209, 165, 0.7)';
const CAPTURE_MOVE_COLOR = 'rgba(255, 100, 80, 0.25)';
const CAPTURE_MOVE_STROKE = 'rgba(255, 100, 80, 0.7)';
const PUSH_MOVE_COLOR = 'rgba(255, 180, 50, 0.25)';
const PUSH_MOVE_STROKE = 'rgba(255, 180, 50, 0.7)';
const HOME_A_TINT = 'rgba(91, 141, 239, 0.06)';
const HOME_B_TINT = 'rgba(242, 95, 92, 0.06)';
const HOVER_COLOR = 'rgba(255, 255, 255, 0.08)';
const HOVER_STROKE = 'rgba(255, 255, 255, 0.2)';
const LAST_MOVE_FROM = 'rgba(255, 209, 102, 0.12)';
const LAST_MOVE_TO = 'rgba(255, 209, 102, 0.18)';
const LAST_MOVE_STROKE = 'rgba(255, 209, 102, 0.4)';
const SCORED_GLOW = 'rgba(255, 209, 102, 0.35)';

// ── Main render ─────────────────────────────────────────────────────────

export function renderCrossingGame(rc: CrossingRenderContext, state: CGameState): void {
  const { ctx, tileSize } = rc;
  const now = performance.now();

  // Clean up expired VFX
  state.vfx = state.vfx.filter(v => now - v.startTime < v.duration);

  // Clear
  ctx.fillStyle = '#0e1014';
  ctx.fillRect(0, 0, rc.width, rc.height);

  // Draw board tiles
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const { px, py } = tileToPixel(rc, x, y);
      const checker = (x + y) % 2 === 0;

      ctx.fillStyle = checker ? LAND_DARK : LAND_LIGHT;
      ctx.fillRect(px, py, tileSize, tileSize);

      // Home zone tints (rows 0-1 for A, rows 6-7 for B)
      if (y <= 1) {
        ctx.fillStyle = HOME_A_TINT;
        ctx.fillRect(px, py, tileSize, tileSize);
      } else if (y >= 6) {
        ctx.fillStyle = HOME_B_TINT;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Goal row highlight
      if (y === GOAL_ROW_A) {
        ctx.fillStyle = GOAL_TINT_A;
        ctx.fillRect(px, py, tileSize, tileSize);
      } else if (y === GOAL_ROW_B) {
        ctx.fillStyle = GOAL_TINT_B;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Grid lines
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, tileSize, tileSize);
    }
  }

  // Last move indicator
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
    if (unit) {
      const moves = getValidMoves(state, unit);
      for (const m of moves) {
        const { px, py } = tileToPixel(rc, m.to.x, m.to.y);
        const pulse = 0.7 + Math.sin(now / 400) * 0.3;

        // Color-code: capture=red, push=orange, normal=green
        let fillColor = VALID_MOVE_COLOR;
        let strokeColor = VALID_MOVE_STROKE;
        if (m.captureId != null) {
          fillColor = CAPTURE_MOVE_COLOR;
          strokeColor = CAPTURE_MOVE_STROKE;
        } else if (m.push != null) {
          fillColor = PUSH_MOVE_COLOR;
          strokeColor = PUSH_MOVE_STROKE;
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 * pulse;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.setLineDash([]);

        // Hover-over-move highlight
        if (state.hoverTile && state.hoverTile.x === m.to.x && state.hoverTile.y === m.to.y) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        }
      }
    }
  }

  // VFX
  for (const vfx of state.vfx) {
    renderVFX(rc, vfx, now);
  }

  // Units (with slide animation)
  for (const unit of state.units) {
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

function drawGoalLine(rc: CrossingRenderContext, goalRowY: number, player: PlayerId): void {
  const { ctx, tileSize, width } = rc;
  // For player A, goal is row 7 (top of board visually) — line at top edge of row 7
  // For player B, goal is row 0 (bottom visually) — line at bottom edge of row 0
  const lineY = player === 'A'
    ? (BOARD_SIZE - 1 - goalRowY) * tileSize
    : (BOARD_SIZE - goalRowY) * tileSize;

  ctx.save();
  ctx.strokeStyle = GOAL_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(width, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = GOAL_LINE_COLOR;
  ctx.textAlign = player === 'A' ? 'left' : 'right';
  const labelX = player === 'A' ? 4 : width - 4;
  const labelY = lineY + (player === 'A' ? 12 : -4);
  ctx.fillText(player === 'A' ? 'your goal' : 'AI goal', labelX, labelY);
  ctx.restore();
}

function renderVFX(rc: CrossingRenderContext, vfx: VFX, now: number): void {
  const { ctx, tileSize } = rc;
  const elapsed = now - vfx.startTime;
  if (elapsed < 0) return;

  const progress = Math.min(1, elapsed / vfx.duration);

  if (vfx.type === 'score-flash') {
    const { px, py } = tileToPixel(rc, vfx.pos.x, vfx.pos.y);
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const alpha = (1 - progress) * 0.7;

    ctx.save();

    // Expanding golden ring
    const ringRadius = tileSize * 0.4 + progress * tileSize * 0.8;
    ctx.strokeStyle = `rgba(255, 209, 102, ${alpha * 0.8})`;
    ctx.lineWidth = 3 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow
    const glowAlpha = alpha * 0.4;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, tileSize * 0.6);
    gradient.addColorStop(0, `rgba(255, 209, 102, ${glowAlpha})`);
    gradient.addColorStop(1, `rgba(255, 209, 102, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(px - 10, py - 10, tileSize + 20, tileSize + 20);

    // Particle sparkles (8 particles bursting outward)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + progress * 0.5;
      const dist = progress * tileSize * 0.9;
      const pAlpha = (1 - progress) * 0.9;
      const sparkX = cx + Math.cos(angle) * dist;
      const sparkY = cy + Math.sin(angle) * dist;
      const size = (1 - progress) * 3;

      ctx.fillStyle = `rgba(255, 230, 150, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating "Scored!" text
    if (progress < 0.7) {
      ctx.font = `bold ${Math.floor(tileSize * 0.4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textAlpha = (1 - progress / 0.7) * 0.95;
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.shadowColor = 'rgba(255, 209, 102, 0.8)';
      ctx.shadowBlur = 8;
      const floatY = cy - progress * 30;
      ctx.fillText('\u{2B50} Scored!', cx, floatY);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  if (vfx.type === 'capture') {
    const { px, py } = tileToPixel(rc, vfx.pos.x, vfx.pos.y);
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const alpha = (1 - progress) * 0.6;

    ctx.save();

    // Shockwave ring
    const ringRadius = progress * tileSize * 0.7;
    ctx.strokeStyle = `rgba(255, 80, 60, ${alpha})`;
    ctx.lineWidth = 2.5 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Debris particles (6 particles)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + i * 0.7;
      const dist = progress * tileSize * 0.6 * (0.8 + Math.sin(i * 2.3) * 0.3);
      const pAlpha = (1 - progress) * 0.7;
      const sparkX = cx + Math.cos(angle) * dist;
      const sparkY = cy + Math.sin(angle) * dist - progress * 8; // slight upward drift
      const size = (1 - progress) * 2.5;

      ctx.fillStyle = `rgba(255, 120, 80, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // X mark (early in animation)
    if (progress < 0.4) {
      ctx.globalAlpha = (1 - progress / 0.4) * 0.5;
      ctx.strokeStyle = '#ff5040';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 12, py + 12);
      ctx.lineTo(px + tileSize - 12, py + tileSize - 12);
      ctx.moveTo(px + tileSize - 12, py + 12);
      ctx.lineTo(px + 12, py + tileSize - 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (vfx.type === 'push') {
    const { px, py } = tileToPixel(rc, vfx.pos.x, vfx.pos.y);
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const alpha = (1 - progress) * 0.5;

    ctx.save();
    // Impact ring
    const ringRadius = progress * tileSize * 0.5;
    ctx.strokeStyle = `rgba(255, 180, 50, ${alpha})`;
    ctx.lineWidth = 2 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Speed lines
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + progress;
      const inner = tileSize * 0.2;
      const outer = tileSize * 0.2 + progress * tileSize * 0.4;
      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function renderUnit(rc: CrossingRenderContext, state: CGameState, unit: CUnit, now: number): void {
  const { ctx, tileSize } = rc;
  const def = getUnitDef(unit.defId);
  const palette = side(unit.owner);
  const isSelected = state.selectedUnitId === unit.unitId;
  const isCurrentPlayer = unit.owner === state.currentPlayer;

  // Compute animated position
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
      unit.animFrom = undefined;
      unit.animStart = undefined;
    }
  }

  const { px, py } = tileToPixel(rc, drawX, drawY);

  // Idle bob animation (suppressed during slide)
  const isAnimating = unit.animFrom != null;
  const bobPhase = ((now + unit.unitId * 211) % 2000) / 2000;
  const bobY = isAnimating ? 0 : Math.sin(bobPhase * Math.PI * 2) * 1.5;

  ctx.save();

  // Scored indicator: golden glow
  if (unit.scored) {
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12;
    ctx.fillStyle = SCORED_GLOW;
    roundRect(ctx, px + 1, py + 1, tileSize - 2, tileSize - 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Selection highlight
  if (isSelected) {
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = SELECT_GLOW;
    roundRect(ctx, px + 1, py + 1, tileSize - 2, tileSize - 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Current-player indicator: subtle ring around movable units
  if (isCurrentPlayer && state.phase === 'playing' && !isSelected) {
    const pulseAlpha = 0.1 + Math.sin(now / 600) * 0.05;
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
    ctx.setLineDash([]);
  }

  // Owner-colored background
  ctx.fillStyle = palette.accent.replace(')', ', 0.15)').replace('rgb', 'rgba');
  roundRect(ctx, px + 3, py + 3, tileSize - 6, tileSize - 6, 4);
  ctx.fill();

  // Owner ring
  ctx.strokeStyle = unit.scored ? '#ffd166' : palette.accent;
  ctx.lineWidth = unit.scored ? 2.5 : 2;
  roundRect(ctx, px + 3, py + 3, tileSize - 6, tileSize - 6, 4);
  ctx.stroke();

  // Emoji
  ctx.font = `${Math.floor(tileSize * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(def.emoji, px + tileSize / 2, py + tileSize / 2 + bobY + 1);

  // Scored checkmark
  if (unit.scored) {
    ctx.font = `bold ${Math.floor(tileSize * 0.2)}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('✓', px + tileSize - 4, py + 3);
  }

  // Elephant shield icon (capture-immune indicator)
  if (def.id === 'elephant') {
    ctx.font = `${Math.floor(tileSize * 0.18)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('\u{1F6E1}', px + 2, py + 2);
  }

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
