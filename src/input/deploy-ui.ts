import type { MatchState, Direction, Vec2 } from '../types/game';
import { tryDeploy } from '../sim/deploy';
import { submitReady } from '../sim/match';
import { MOUSE, ELEPHANT, getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';
import type { RenderContext } from '../render/canvas';
import { tileToPixel } from '../render/canvas';
import type { SandboxUIState } from '../ui/sandbox-ui';
import { refreshAll, showBanner } from '../ui/sandbox-ui';

const PET_HOTKEYS: Record<string, string> = {
  '1': MOUSE.id,
  '2': ELEPHANT.id,
};

export interface DeployUIState extends SandboxUIState {
  hoverTile: Vec2 | null;
}

export function createDeployUIState(): DeployUIState {
  return { selectedDefId: MOUSE.id, facing: 'N', hoverTile: null };
}

export interface DeployUIBindings {
  onReset: () => void;
}

export function attachDeployUI(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  state: MatchState,
  ui: DeployUIState,
  bindings: DeployUIBindings,
): void {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'r') {
      e.preventDefault();
      bindings.onReset();
      return;
    }
    if (state.phase !== 'planning') return;
    if (PET_HOTKEYS[k]) { ui.selectedDefId = PET_HOTKEYS[k]; refreshAll(state, ui); return; }
    if (k === 'w') ui.facing = 'N';
    else if (k === 's') ui.facing = 'S';
    else if (k === 'a') ui.facing = 'W';
    else if (k === 'd') ui.facing = 'E';
    else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      submitReady(state, 'A');
      submitReady(state, 'B');
    }
    else if (k === 'tab') {
      e.preventDefault();
      state.activePlanningPlayer = state.activePlanningPlayer === 'A' ? 'B' : 'A';
    }
    refreshAll(state, ui);
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(px / rc.tileSize);
    const y = BOARD_SIZE - 1 - Math.floor(py / rc.tileSize);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      ui.hoverTile = { x, y };
    } else {
      ui.hoverTile = null;
    }
  });

  canvas.addEventListener('mouseleave', () => { ui.hoverTile = null; });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'planning') return;
    if (!ui.selectedDefId || !ui.hoverTile) return;
    const result = tryDeploy(state, state.activePlanningPlayer, ui.selectedDefId, ui.hoverTile, ui.facing);
    if (!result.ok) {
      showBanner(`Cannot deploy: ${result.reason}`);
    }
    refreshAll(state, ui);
  });
}

const PLAYER_COLOR = {
  A: { fill: 'rgba(91, 141, 239, 0.30)', stroke: '#5b8def', invalid: 'rgba(242, 95, 92, 0.35)' },
  B: { fill: 'rgba(242, 95, 92, 0.30)', stroke: '#f25f5c', invalid: 'rgba(242, 95, 92, 0.35)' },
};

function inHomeZone(player: 'A' | 'B', x: number, y: number, w: number, h: number): boolean {
  // anchor is (x, y) bottom-left in board coords; footprint covers y..y+h-1
  if (x < 0 || x + w > BOARD_SIZE) return false;
  for (let dy = 0; dy < h; dy++) {
    const ty = y + dy;
    if (player === 'A' && (ty < 0 || ty >= HOME_ROWS)) return false;
    if (player === 'B' && (ty < BOARD_SIZE - HOME_ROWS || ty >= BOARD_SIZE)) return false;
  }
  return true;
}

export function renderDeployPreview(
  rc: RenderContext,
  state: MatchState,
  ui: DeployUIState,
): void {
  if (state.phase !== 'planning') return;

  // Hover highlight (even without selection)
  if (ui.hoverTile) {
    const { px, py } = tileToPixel(rc, ui.hoverTile.x, ui.hoverTile.y);
    rc.ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    rc.ctx.lineWidth = 1.5;
    rc.ctx.strokeRect(px + 1, py + 1, rc.tileSize - 2, rc.tileSize - 2);
  }

  if (!ui.selectedDefId || !ui.hoverTile) return;
  const def = getPetDef(ui.selectedDefId);
  const player = state.activePlanningPlayer;
  const colors = PLAYER_COLOR[player];

  const valid = inHomeZone(player, ui.hoverTile.x, ui.hoverTile.y, def.size.w, def.size.h);

  // Pet footprint top-left in screen coords
  const { px, py } = tileToPixel(rc, ui.hoverTile.x, ui.hoverTile.y + def.size.h - 1);
  const w = def.size.w * rc.tileSize;
  const h = def.size.h * rc.tileSize;

  rc.ctx.fillStyle = valid ? colors.fill : colors.invalid;
  rc.ctx.fillRect(px, py, w, h);

  rc.ctx.strokeStyle = valid ? colors.stroke : '#f25f5c';
  rc.ctx.lineWidth = 2;
  rc.ctx.setLineDash(valid ? [] : [4, 3]);
  rc.ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
  rc.ctx.setLineDash([]);

  rc.ctx.globalAlpha = 0.85;
  rc.ctx.font = `${Math.floor(rc.tileSize * 0.65)}px sans-serif`;
  rc.ctx.textAlign = 'center';
  rc.ctx.textBaseline = 'middle';
  rc.ctx.fillStyle = '#fff';
  rc.ctx.fillText(def.emoji, px + w / 2, py + h / 2);
  rc.ctx.globalAlpha = 1;

  // Facing arrow
  drawFacingArrow(rc, px, py, w, h, ui.facing, valid ? colors.stroke : '#f25f5c');
}

function drawFacingArrow(
  rc: RenderContext,
  px: number, py: number, w: number, h: number,
  facing: Direction,
  color: string,
): void {
  const { ctx } = rc;
  const cx = px + w / 2;
  const cy = py + h / 2;
  const r = Math.min(w, h) * 0.4;
  let tx = cx, ty = cy;
  switch (facing) {
    case 'N': tx = cx; ty = cy - r; break;
    case 'S': tx = cx; ty = cy + r; break;
    case 'E': tx = cx + r; ty = cy; break;
    case 'W': tx = cx - r; ty = cy; break;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // Arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  const ah = 5;
  if (facing === 'N') { ctx.moveTo(tx, ty - ah); ctx.lineTo(tx - ah, ty + ah); ctx.lineTo(tx + ah, ty + ah); }
  else if (facing === 'S') { ctx.moveTo(tx, ty + ah); ctx.lineTo(tx - ah, ty - ah); ctx.lineTo(tx + ah, ty - ah); }
  else if (facing === 'E') { ctx.moveTo(tx + ah, ty); ctx.lineTo(tx - ah, ty - ah); ctx.lineTo(tx - ah, ty + ah); }
  else { ctx.moveTo(tx - ah, ty); ctx.lineTo(tx + ah, ty - ah); ctx.lineTo(tx + ah, ty + ah); }
  ctx.closePath();
  ctx.fill();
}
