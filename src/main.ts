import { createInitialMatch, resetMatchInPlace } from './sim/match';
import { createRenderContext, clearCanvas } from './render/canvas';
import { renderBoard } from './render/board';
import { renderPets } from './render/pets';
import {
  createDeployUIState,
  attachDeployUI,
  renderDeployPreview,
} from './input/deploy-ui';
import { mountSandboxUI, refreshAll, showBanner } from './ui/sandbox-ui';
import { GameLoop } from './loop';
import { renderEffects, clearEffects } from './render/effects';
import { clearRenderHistory } from './render/interpolation';
import { clearEvents } from './ui/event-log';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const rc = createRenderContext(canvas);

const state = createInitialMatch({ sandbox: true });
const ui = createDeployUIState();

function resetMatch(): void {
  resetMatchInPlace(state, { sandbox: true });
  clearEffects();
  clearRenderHistory();
  clearEvents();
  ui.hoverTile = null;
  refreshAll(state, ui);
  showBanner('Match reset');
}

attachDeployUI(canvas, rc, state, ui, { onReset: resetMatch });
mountSandboxUI(state, ui, { onReset: resetMatch });

function render() {
  clearCanvas(rc);
  renderBoard(rc, state.board);
  renderPets(rc, state.pets);
  renderEffects(rc);
  renderDeployPreview(rc, state, ui);
  refreshAll(state, ui);
}

const loop = new GameLoop(state, render);
loop.start();

refreshAll(state, ui);
