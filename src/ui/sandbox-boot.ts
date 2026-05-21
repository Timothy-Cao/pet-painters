/**
 * sandbox-boot.ts
 *
 * Bootstraps the full sandbox experience inside a given container element.
 * Called by SandboxScreen once the container DOM is ready.
 * Previously this logic lived in src/main.ts.
 */

import type { Vec2, Direction } from '../types/game';
import { createInitialMatch, resetMatchInPlace } from '../sim/match';
import { createRenderContext, clearCanvas } from '../render/canvas';
import { renderBoard } from '../render/board';
import { renderPets } from '../render/pets';
import {
  createDeployUIState,
  attachDeployUI,
  renderDeployPreview,
} from '../input/deploy-ui';
import { setSandboxRoot, mountSandboxUI, refreshAll, showBanner } from './sandbox-ui';
import { GameLoop } from '../loop';
import { renderEffects, clearEffects } from '../render/effects';
import { clearRenderHistory } from '../render/interpolation';
import { clearEvents } from './event-log';
import { loadPalette, applyPalette, getPaletteName } from '../render/palette';
import { setWinOverlayRoot, bindWinOverlay, refreshWinOverlay } from './win-overlay';

/** Optional bindings for online mode.  All fields are optional so sandbox mode is unaffected. */
export interface SandboxBootBindings {
  /** If set, override the starting round number (for online reconnect). */
  initialRound?: number;
  /**
   * If provided, called instead of tryDeploy when the player clicks to deploy.
   * state.pets is NOT mutated when this is set — the controller owns that transition.
   */
  onDeploy?: (defId: string, anchor: Vec2, facing: Direction) => void;
  /**
   * If provided, called instead of the local submitReady(A/B) when the player
   * presses Space/Enter or clicks the Start Round button.
   */
  onReady?: () => void;
  /** If provided, called each time the local execution phase ends. */
  onExecutionEnd?: () => void;
}

export interface SandboxBootHandle {
  /** The live MatchState — the online controller reads/mutates this. */
  state: ReturnType<typeof createInitialMatch>;
  /** Stop the RAF loop and do whatever cleanup is possible. */
  stop(): void;
}

export function bootSandbox(container: HTMLElement, bindings?: SandboxBootBindings): SandboxBootHandle {
  // Scope all sandbox-ui and win-overlay DOM queries to this container.
  setSandboxRoot(container);
  setWinOverlayRoot(container);

  const canvas = container.querySelector('#game') as HTMLCanvasElement;
  const rc = createRenderContext(canvas);

  const state = createInitialMatch({ sandbox: true });
  if (bindings?.initialRound !== undefined) {
    state.round = bindings.initialRound;
  }
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

  attachDeployUI(canvas, rc, state, ui, {
    onReset: resetMatch,
    onDeploy: bindings?.onDeploy,
    onReady: bindings?.onReady,
  });
  mountSandboxUI(state, ui, {
    onReset: resetMatch,
    onReady: bindings?.onReady,
  });
  bindWinOverlay(resetMatch);

  // Settings + accessibility wiring.
  loadPalette();
  const settingsBtn = container.querySelector('#settings-btn') as HTMLElement | null;
  const settingsMenu = container.querySelector('#settings-menu') as HTMLElement | null;
  const cbCheckbox = container.querySelector('#settings-cb-palette') as HTMLInputElement | null;
  if (cbCheckbox) cbCheckbox.checked = getPaletteName() === 'cb-blue-orange';
  if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = settingsMenu.hasAttribute('hidden');
      settingsMenu.toggleAttribute('hidden', !willOpen);
      settingsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Node)) return;
      if (settingsMenu.contains(e.target) || settingsBtn.contains(e.target)) return;
      settingsMenu.setAttribute('hidden', '');
      settingsBtn.setAttribute('aria-expanded', 'false');
    });
  }
  cbCheckbox?.addEventListener('change', () => {
    applyPalette(cbCheckbox.checked ? 'cb-blue-orange' : 'default');
  });

  // Esc closes the inspector first, then deselects the currently-armed pet.
  // (The SandboxScreen also listens for Escape to go back to Home, but the
  //  inspector handler runs first because it was added earlier; the screen
  //  handler navigates away only when nothing is inspected / selected.)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ui.inspectedPetId != null) {
        ui.inspectedPetId = null;
        e.stopImmediatePropagation();
      } else if (ui.selectedDefId != null) {
        ui.selectedDefId = null;
        e.stopImmediatePropagation();
      }
      refreshAll(state, ui);
    }
  });

  function render() {
    clearCanvas(rc);
    renderBoard(rc, state.board);
    renderPets(rc, state.pets);
    renderEffects(rc);
    renderDeployPreview(rc, state, ui);
    refreshAll(state, ui);
    refreshWinOverlay(state);
  }

  const loop = new GameLoop(state, render, {
    onExecutionEnd: bindings?.onExecutionEnd,
  });
  loop.start();

  refreshAll(state, ui);

  return {
    state,
    stop() { loop.stop(); },
  };
}
