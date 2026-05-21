import type { MatchState, Direction, Vec2 } from '../types/game';
import { tryDeploy } from '../sim/deploy';
import { submitReady } from '../sim/match';
import { MOUSE, ELEPHANT, getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE } from '../config/constants';
import type { RenderContext } from '../render/canvas';
import { tileToPixel } from '../render/canvas';

const PET_HOTKEYS: Record<string, string> = {
  '1': MOUSE.id,
  '2': ELEPHANT.id,
};

export interface DeployUIState {
  selectedDefId: string | null;
  facing: Direction;
  hoverTile: Vec2 | null;
}

export function createDeployUIState(): DeployUIState {
  return { selectedDefId: null, facing: 'N', hoverTile: null };
}

export function attachDeployUI(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  state: MatchState,
  ui: DeployUIState,
): void {
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'planning') return;
    const k = e.key.toLowerCase();
    if (PET_HOTKEYS[k]) { ui.selectedDefId = PET_HOTKEYS[k]; return; }
    if (k === 'w') ui.facing = 'N';
    else if (k === 's') ui.facing = 'S';
    else if (k === 'a') ui.facing = 'W';
    else if (k === 'd') ui.facing = 'E';
    else if (k === ' ' || k === 'enter') submitReady(state, state.activePlanningPlayer);
    else if (k === 'tab') {
      e.preventDefault();
      state.activePlanningPlayer = state.activePlanningPlayer === 'A' ? 'B' : 'A';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = Math.floor(px / rc.tileSize);
    const y = BOARD_SIZE - 1 - Math.floor(py / rc.tileSize);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      ui.hoverTile = { x, y };
    } else {
      ui.hoverTile = null;
    }
  });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'planning') return;
    if (!ui.selectedDefId || !ui.hoverTile) return;
    tryDeploy(state, state.activePlanningPlayer, ui.selectedDefId, ui.hoverTile, ui.facing);
  });
}

export function renderDeployPreview(rc: RenderContext, ui: DeployUIState): void {
  if (!ui.selectedDefId || !ui.hoverTile) return;
  const def = getPetDef(ui.selectedDefId);
  const { px, py } = tileToPixel(rc, ui.hoverTile.x, ui.hoverTile.y + def.size.h - 1);
  rc.ctx.globalAlpha = 0.5;
  rc.ctx.fillStyle = '#ff0';
  rc.ctx.fillRect(px, py, def.size.w * rc.tileSize, def.size.h * rc.tileSize);
  rc.ctx.globalAlpha = 1;
  rc.ctx.font = `${Math.floor(rc.tileSize * 0.6)}px sans-serif`;
  rc.ctx.textAlign = 'center';
  rc.ctx.textBaseline = 'middle';
  rc.ctx.fillStyle = '#fff';
  rc.ctx.fillText(def.emoji, px + (def.size.w * rc.tileSize) / 2, py + (def.size.h * rc.tileSize) / 2);
}
