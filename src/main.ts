import { createInitialMatch } from './sim/match';
import { createRenderContext, clearCanvas } from './render/canvas';
import { renderBoard } from './render/board';
import { renderPets } from './render/pets';
import { renderHUD } from './render/ui';
import {
  createDeployUIState,
  attachDeployUI,
  renderDeployPreview,
} from './input/deploy-ui';
import { GameLoop } from './loop';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const rc = createRenderContext(canvas);
const state = createInitialMatch();
const ui = createDeployUIState();
attachDeployUI(canvas, rc, state, ui);

function render() {
  clearCanvas(rc);
  renderBoard(rc, state.board);
  renderPets(rc, state.pets);
  renderDeployPreview(rc, ui);
  renderHUD(state);
}

const loop = new GameLoop(state, render);
loop.start();
