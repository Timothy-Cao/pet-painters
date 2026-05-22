/**
 * sandbox-boot.ts
 *
 * Bootstraps the full sandbox experience inside a given container element.
 * Called by SandboxScreen once the container DOM is ready.
 * Previously this logic lived in src/main.ts.
 */

import type { Vec2, Direction } from '../types/game';
import { createInitialMatch, resetMatchInPlace } from '../sim/match';
import { createRenderContext, clearCanvas, tileToPixel } from '../render/canvas';
import type { RenderContext } from '../render/canvas';
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
import { setWinOverlayRoot, setWinOverlayLabels, bindWinOverlay, refreshWinOverlay } from './win-overlay';
import type { DeploymentDTO } from '../online/submissions';
import { getPetDef } from '../sim/pet-defs';
import { loadSoundPref, isSoundEnabled, setSoundEnabled, playRoundStart, playCountdownTick, playCountdownGo } from '../render/sfx';
import { maybeShowTutorial } from './tutorial';
import { scheduleAIDeploy } from '../sim/ai';

/**
 * Draw the 3-2-1-GO countdown overlay on the canvas.
 * elapsed: ms since execution started. duration: total countdown ms (3000).
 */
function renderCountdown(
  rc: RenderContext,
  elapsed: number,
  duration: number,
): void {
  const { ctx, width, height } = rc;
  // Determine which digit to show.
  let label: string;
  let t: number;               // 0..1 progress through this label's 1-second window
  if (elapsed >= duration) {
    // "GO" fade-out phase.
    label = 'GO';
    t = 1 - Math.min(1, (elapsed - duration) / 400);
  } else {
    const sec = Math.floor((duration - elapsed) / 1000) + 1; // 3, 2, 1
    label = String(Math.min(sec, 3));
    t = 1 - ((elapsed % 1000) / 1000);                       // 1→0 within each second
  }
  // Ease-out alpha + scale pulse.
  const alpha = Math.max(0, t);
  const scale = 1 + (1 - t) * 0.35;

  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha * 0.88;

  // Semi-transparent background pill.
  const fontSize = Math.min(width, height) * 0.18;
  ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = width / 2;
  const cy = height / 2;

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Shadow / glow.
  ctx.shadowColor = label === 'GO' ? '#4fd1a5' : '#ffd166';
  ctx.shadowBlur = 24;

  // Outline.
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = Math.max(4, fontSize * 0.07);
  ctx.strokeText(label, cx, cy);

  // Fill.
  ctx.fillStyle = label === 'GO' ? '#4fd1a5' : '#ffffff';
  ctx.fillText(label, cx, cy);

  ctx.restore();
}

/**
 * Draw ghost/preview overlays for deployments the local player has queued this round
 * but that haven't yet been applied to state.pets (they're pending server confirmation).
 */
function renderPendingGhosts(rc: RenderContext, pending: readonly DeploymentDTO[]): void {
  if (pending.length === 0) return;
  const { ctx, tileSize } = rc;
  for (const d of pending) {
    const def = getPetDef(d.defId);
    const { px, py } = tileToPixel(rc, d.anchor.x, d.anchor.y + def.size.h - 1);
    const w = def.size.w * tileSize;
    const h = def.size.h * tileSize;
    // Semi-transparent fill + dashed outline so the player knows "this is queued."
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(100, 200, 255, 0.25)';
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    // Emoji centered
    ctx.font = `${Math.floor(h * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.emoji, px + w / 2, py + h / 2 + 2);
    ctx.restore();
  }
}

/** Optional bindings for online mode and AI.  All fields are optional so sandbox mode is unaffected. */
export interface SandboxBootBindings {
  /** If true, Player B is controlled by the AI. Player A is the human. */
  withAI?: boolean;
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
  /** If provided, called once when the match ends (winner determined). */
  onWin?: () => void;
  /**
   * The local player's slot ('A' or 'B') — enables fog of war in render so only
   * tiles/pets visible to this player are shown.  Omit (or null) for sandbox.
   */
  viewer?: import('../types/game').PlayerId | null;
  /**
   * Getter that returns the current pending deployments queued this round.
   * When set, ghost overlays of queued pets are shown to the local player.
   */
  getPendingDeployments?: () => readonly import('../online/submissions').DeploymentDTO[];
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
  setWinOverlayLabels(bindings?.withAI ? { A: 'You', B: 'AI' } : null);

  const canvas = container.querySelector('#game') as HTMLCanvasElement;
  const rc = createRenderContext(canvas);

  const isOnline = !!bindings?.onReady;
  const aiMode = !!bindings?.withAI && !isOnline;
  // AI mode uses finite energy for real strategy; pure sandbox is infinite.
  const state = createInitialMatch({ sandbox: !isOnline && !aiMode });
  if (bindings?.initialRound !== undefined) {
    state.round = bindings.initialRound;
  }
  const ui = createDeployUIState();

  function resetMatch(): void {
    cancelAI?.();
    resetMatchInPlace(state, { sandbox: state.sandbox });
    clearEffects();
    clearRenderHistory();
    clearEvents();
    ui.hoverTile = null;
    winFired = false;
    refreshAll(state, ui);
    showBanner('Match reset');
    triggerAIDeploy();
  }

  attachDeployUI(canvas, rc, state, ui, {
    onReset: resetMatch,
    onDeploy: bindings?.onDeploy,
    onReady: bindings?.onReady,
    // In AI mode, restrict the human player to their own territory (A).
    viewer: aiMode ? 'A' : (bindings?.viewer ?? null),
  });
  mountSandboxUI(state, ui, {
    onReset: resetMatch,
    onReady: bindings?.onReady,
  });
  bindWinOverlay(resetMatch);

  // Settings + accessibility wiring.
  loadPalette();
  loadSoundPref();
  const settingsBtn = container.querySelector('#settings-btn') as HTMLElement | null;
  const settingsMenu = container.querySelector('#settings-menu') as HTMLElement | null;
  const cbCheckbox = container.querySelector('#settings-cb-palette') as HTMLInputElement | null;
  const soundCheckbox = container.querySelector('#settings-cb-sound') as HTMLInputElement | null;
  if (cbCheckbox) cbCheckbox.checked = getPaletteName() === 'cb-blue-orange';
  if (soundCheckbox) soundCheckbox.checked = isSoundEnabled();
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
  soundCheckbox?.addEventListener('change', () => {
    setSoundEnabled(soundCheckbox.checked);
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

  // Fog of war: undefined/null means sandbox (no fog).
  const viewer = bindings?.viewer ?? null;

  // ── AI opponent ──────────────────────────────────────────────────────
  const aiEnabled = !!bindings?.withAI && !isOnline;
  let cancelAI: (() => void) | null = null;

  function triggerAIDeploy(): void {
    if (!aiEnabled) return;
    if (state.phase !== 'planning') return;
    cancelAI?.();
    cancelAI = scheduleAIDeploy(state, () => {
      refreshAll(state, ui);
      showBanner('AI deployed its pets', 'info');
    });
  }

  // Kick off the first AI deploy at match start.
  if (aiEnabled) {
    triggerAIDeploy();
  }

  // Phase-change tracking for round-start SFX and countdown overlay.
  let winFired = false;
  let lastPhase = state.phase;
  // countdownStartMs is set when execution begins; the 3s countdown runs from there.
  let countdownStartMs: number | null = null;
  let countdownSfxFired = { at1: false, at2: false, go: false };
  const COUNTDOWN_DURATION_MS = 3000;

  function render() {
    const now = performance.now();

    // Detect execution start.
    if (state.phase === 'execution' && lastPhase === 'planning') {
      countdownStartMs = now;
      playCountdownTick();           // "3"
    }
    lastPhase = state.phase;

    clearCanvas(rc);
    renderBoard(rc, state.board, viewer);
    renderPets(rc, state.pets, viewer, viewer ? state.board : null);
    renderEffects(rc);
    renderDeployPreview(rc, state, ui);
    // Ghost overlay for pending deployments (online planning phase feedback).
    if (bindings?.getPendingDeployments) {
      renderPendingGhosts(rc, bindings.getPendingDeployments());
    }

    // 3-2-1 GO countdown overlay during the first 3 s of execution.
    if (countdownStartMs !== null) {
      const elapsed = now - countdownStartMs;
      if (elapsed < COUNTDOWN_DURATION_MS) {
        renderCountdown(rc, elapsed, COUNTDOWN_DURATION_MS);
        // Fire tick sounds at 1 s and 2 s marks (approx), and GO at 3 s.
        if (elapsed >= 1000 && !countdownSfxFired.at1) {
          countdownSfxFired.at1 = true;
          playCountdownTick();   // "2"
        }
        if (elapsed >= 2000 && !countdownSfxFired.at2) {
          countdownSfxFired.at2 = true;
          playCountdownTick();   // "1"
        }
      } else {
        if (!countdownSfxFired.go) {
          countdownSfxFired.go = true;
          playCountdownGo();     // "GO"
          playRoundStart();
        }
        // Fade out GO text for 400 ms after countdown ends.
        if (elapsed < COUNTDOWN_DURATION_MS + 400) {
          renderCountdown(rc, elapsed, COUNTDOWN_DURATION_MS);
        } else {
          countdownStartMs = null;
          countdownSfxFired = { at1: false, at2: false, go: false };
        }
      }
    }

    refreshAll(state, ui);
    refreshWinOverlay(state);
    if (state.phase === 'ended' && state.winner && !winFired) {
      winFired = true;
      bindings?.onWin?.();
    }
  }

  const loop = new GameLoop(state, render, {
    onExecutionEnd: () => {
      bindings?.onExecutionEnd?.();
      // Schedule AI deploy for the next planning phase.
      triggerAIDeploy();
    },
  });
  loop.start();

  refreshAll(state, ui);

  maybeShowTutorial(container, bindings?.viewer);

  return {
    state,
    stop() {
      cancelAI?.();
      loop.stop();
    },
  };
}
