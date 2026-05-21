import type { MatchState, Direction, Vec2 } from '../types/game';
import { tryDeploy, petAtTile, undeploy } from '../sim/deploy';
import { submitReady } from '../sim/match';
import { MOUSE, ELEPHANT, CAT, getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';
import type { RenderContext } from '../render/canvas';
import { tileToPixel } from '../render/canvas';
import type { SandboxUIState } from '../ui/sandbox-ui';
import { refreshAll, showBanner } from '../ui/sandbox-ui';

const CW_NEXT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

const PET_HOTKEYS: Record<string, string> = {
  '1': MOUSE.id,
  '2': ELEPHANT.id,
  '3': CAT.id,
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
    if (state.phase !== 'planning') return;
    if (PET_HOTKEYS[k]) { ui.selectedDefId = PET_HOTKEYS[k]; refreshAll(state, ui); return; }
    if (k === 'r' && !e.ctrlKey && !e.metaKey) {
      ui.facing = CW_NEXT[ui.facing];
    } else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      submitReady(state, 'A');
      submitReady(state, 'B');
    }
    refreshAll(state, ui);
  });
  void bindings;

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

  // Right-click rotates the facing clockwise; suppress the browser context menu over the canvas.
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.phase !== 'planning') return;
    ui.facing = CW_NEXT[ui.facing];
    refreshAll(state, ui);
  });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'planning') return;
    if (!ui.hoverTile) return;

    // Left-click on an existing pet undeploys it.
    const existing = petAtTile(state, ui.hoverTile);
    if (existing) {
      undeploy(state, existing.petId);
      refreshAll(state, ui);
      return;
    }

    if (!ui.selectedDefId) return;
    const def = getPetDef(ui.selectedDefId);
    const player = inferPlayerFromAnchor(ui.hoverTile.x, ui.hoverTile.y, def.size.w, def.size.h);
    if (!player) {
      showBanner('Click inside a home zone to deploy');
      return;
    }
    const result = tryDeploy(state, player, ui.selectedDefId, ui.hoverTile, ui.facing);
    if (!result.ok) {
      showBanner(`Cannot deploy: ${result.reason}`);
    }
    refreshAll(state, ui);
  });
}

const PREVIEW = {
  fill: 'rgba(160, 168, 184, 0.22)',
  stroke: '#a0a8b8',
  invalidFill: 'rgba(242, 95, 92, 0.20)',
  invalidStroke: '#f25f5c',
};

function inHomeZone(player: 'A' | 'B', x: number, y: number, w: number, h: number): boolean {
  if (x < 0 || x + w > BOARD_SIZE) return false;
  for (let dy = 0; dy < h; dy++) {
    const ty = y + dy;
    if (player === 'A' && (ty < 0 || ty >= HOME_ROWS)) return false;
    if (player === 'B' && (ty < BOARD_SIZE - HOME_ROWS || ty >= BOARD_SIZE)) return false;
  }
  return true;
}

// Returns the player whose home zone fully contains the given footprint, or null.
export function inferPlayerFromAnchor(x: number, y: number, w: number, h: number): 'A' | 'B' | null {
  if (inHomeZone('A', x, y, w, h)) return 'A';
  if (inHomeZone('B', x, y, w, h)) return 'B';
  return null;
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
    rc.ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    rc.ctx.lineWidth = 1.5;
    rc.ctx.strokeRect(px + 1, py + 1, rc.tileSize - 2, rc.tileSize - 2);
  }

  if (!ui.selectedDefId || !ui.hoverTile) return;
  const def = getPetDef(ui.selectedDefId);

  const player = inferPlayerFromAnchor(ui.hoverTile.x, ui.hoverTile.y, def.size.w, def.size.h);
  const valid = player !== null;

  const { px, py } = tileToPixel(rc, ui.hoverTile.x, ui.hoverTile.y + def.size.h - 1);
  const w = def.size.w * rc.tileSize;
  const h = def.size.h * rc.tileSize;

  rc.ctx.fillStyle = valid ? PREVIEW.fill : PREVIEW.invalidFill;
  rc.ctx.fillRect(px, py, w, h);

  rc.ctx.strokeStyle = valid ? PREVIEW.stroke : PREVIEW.invalidStroke;
  rc.ctx.lineWidth = 2;
  rc.ctx.setLineDash(valid ? [] : [4, 3]);
  rc.ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
  rc.ctx.setLineDash([]);

  const FACING_RAD: Record<Direction, number> = {
    N: 0,
    E: Math.PI / 2,
    S: Math.PI,
    W: -Math.PI / 2,
  };
  rc.ctx.save();
  rc.ctx.globalAlpha = 0.85;
  rc.ctx.translate(px + w / 2, py + h / 2);
  rc.ctx.rotate(FACING_RAD[ui.facing]);
  rc.ctx.font = `${Math.floor(rc.tileSize * 0.65)}px sans-serif`;
  rc.ctx.textAlign = 'center';
  rc.ctx.textBaseline = 'middle';
  rc.ctx.fillStyle = '#fff';
  rc.ctx.fillText(def.emoji, 0, 2);
  rc.ctx.restore();
}
