/**
 * screen.ts — Critter Crossing game screen.
 *
 * Full game experience: board, HUD, turn management, AI opponent.
 */

import type { Screen } from '../app/router';
import { navigate } from '../app/router';
import type { CGameState } from './types';
import { createCrossingGame, performMove, skipTurnIfNeeded } from './game';
import { createCrossingRC, renderCrossingGame, pixelToTile } from './render';
import { getValidMoves } from './moves';
import { getUnitDef, ALL_CROSSING_UNITS } from './units';
import { footprint } from './board';
import { scheduleAIMove } from './ai';

export const CrossingScreen: Screen = {
  name: 'crossing',
  mount(root) {
    root.innerHTML = `
<div class="crossing-screen" id="crossing-container">
  <div class="crossing-app">
    <header class="crossing-topbar">
      <div class="brand">
        <span class="brand-mark">\u{1F3C1}</span>
        <span class="brand-name">Critter Crossing</span>
        <span class="brand-mode">vs AI</span>
      </div>
      <div class="crossing-turn-indicator" id="cx-turn">
        <span class="cx-turn-dot" id="cx-turn-dot"></span>
        <span id="cx-turn-text">Your turn</span>
      </div>
      <div class="crossing-scores">
        <div class="cx-score cx-score-a">
          <span class="cx-score-tag">You</span>
          <span class="cx-score-val" id="cx-score-a">0 / 12</span>
        </div>
        <div class="cx-score-vs">vs</div>
        <div class="cx-score cx-score-b">
          <span class="cx-score-tag">AI</span>
          <span class="cx-score-val" id="cx-score-b">0 / 12</span>
        </div>
      </div>
    </header>

    <main class="crossing-layout">
      <aside class="crossing-sidebar">
        <div class="panel-title">Selected Unit</div>
        <div class="cx-unit-info" id="cx-unit-info">
          <div class="cx-no-selection">Click one of your units to see moves</div>
        </div>
        <div class="panel-title" style="margin-top:16px">Turn</div>
        <div class="cx-turn-count" id="cx-turn-count">Turn 1</div>
        <div class="panel-title" style="margin-top:16px">Legend</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch" style="background:#1a1f2a;border:1px solid var(--border)"></span> Land</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(40,80,140,0.6);border:1px solid var(--border)"></span> Water</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(79,209,165,0.35);border:1px solid rgba(79,209,165,0.7)"></span> Valid move</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(255,209,102,0.3);border:1px solid rgba(255,209,102,0.5)"></span> Goal line</div>
        </div>
      </aside>

      <section class="crossing-stage">
        <div class="crossing-canvas-frame">
          <div class="player-tag player-tag-b">\u{1F916} AI (top)</div>
          <canvas id="cx-game" width="600" height="600"></canvas>
          <div class="player-tag player-tag-a">\u{1F3AE} You (bottom)</div>
        </div>
      </section>

      <aside class="crossing-sidebar crossing-sidebar-right">
        <div class="panel-title">How to Play</div>
        <div class="cx-help">
          <p>Get all your units across the center line.</p>
          <p><strong>Click</strong> a unit to select it, then <strong>click</strong> a green tile to move.</p>
          <p>Each unit has a unique ability!</p>
        </div>
        <div class="panel-title" style="margin-top:16px">Unit Abilities</div>
        <div class="cx-ability-list" id="cx-ability-list"></div>
      </aside>
    </main>

    <footer class="footer">
      <span><kbd>Click</kbd> select unit</span>
      <span><kbd>Click</kbd> green tile to move</span>
      <span><kbd>Esc</kbd> deselect</span>
    </footer>
  </div>

  <div class="win-overlay" id="cx-win-overlay" hidden>
    <div class="win-card">
      <div class="win-eyebrow">Game Over</div>
      <div class="win-headline" id="cx-win-headline">You win!</div>
      <div class="win-recap">
        <div class="win-recap-side">
          <span class="win-recap-tag win-recap-tag-a">You</span>
          <span class="win-recap-val" id="cx-win-score-a">0/12</span>
        </div>
        <div class="win-recap-vs">vs</div>
        <div class="win-recap-side">
          <span class="win-recap-tag win-recap-tag-b">AI</span>
          <span class="win-recap-val" id="cx-win-score-b">0/12</span>
        </div>
      </div>
      <div class="cx-win-turns" id="cx-win-turns">Completed in 0 turns</div>
      <div class="win-actions">
        <button class="btn-primary" id="cx-win-rematch">▶ Play Again</button>
        <button class="btn-secondary" id="cx-win-home">← Back to Home</button>
      </div>
    </div>
  </div>
</div>
    `;

    const container = root.querySelector('#crossing-container') as HTMLElement;
    const canvas = container.querySelector('#cx-game') as HTMLCanvasElement;
    const rc = createCrossingRC(canvas);

    let state = createCrossingGame();
    let cancelAI: (() => void) | null = null;
    let rafId: number | null = null;

    // Build ability list
    buildAbilityList(container);

    // ── Render loop ──
    function render() {
      renderCrossingGame(rc, state);
      refreshHUD(container, state);
      checkWin(container, state);
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    // ── Click handling ──
    canvas.addEventListener('click', (e) => {
      if (state.phase !== 'playing') return;
      if (state.currentPlayer !== 'A') return; // Only human can click

      const tile = pixelToTile(rc, e.clientX, e.clientY);
      if (!tile) return;

      // If a unit is selected, try to move there
      if (state.selectedUnitId != null) {
        const unit = state.units.find(u => u.unitId === state.selectedUnitId);
        if (unit) {
          const valid = getValidMoves(state, unit);
          if (valid.some(m => m.x === tile.x && m.y === tile.y)) {
            performMove(state, state.selectedUnitId, tile);
            state.selectedUnitId = null;
            maybeAITurn();
            return;
          }
        }
        // Clicked somewhere else — deselect
        state.selectedUnitId = null;
      }

      // Try to select a unit at this tile
      for (const u of state.units) {
        if (u.scored || u.owner !== 'A') continue;
        const def = getUnitDef(u.defId);
        const fp = footprint(u.pos, def.size);
        if (fp.some(t => t.x === tile.x && t.y === tile.y)) {
          state.selectedUnitId = u.unitId;
          return;
        }
      }
    });

    // Escape to deselect
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.selectedUnitId != null) {
          state.selectedUnitId = null;
          e.stopImmediatePropagation();
        } else {
          navigate('home');
        }
      }
    };
    window.addEventListener('keydown', onKey);

    // ── AI turn ──
    function maybeAITurn() {
      if (state.phase !== 'playing') return;
      // Skip turns if needed
      skipTurnIfNeeded(state);
      if (state.currentPlayer !== 'B') return;

      cancelAI?.();
      cancelAI = scheduleAIMove(state, (unitId, to) => {
        // Brief selection flash
        state.selectedUnitId = unitId;
        setTimeout(() => {
          performMove(state, unitId, to);
          state.selectedUnitId = null;
          // Check if it's AI's turn again (skip if A has no moves)
          skipTurnIfNeeded(state);
          if (state.currentPlayer === 'B' && state.phase === 'playing') {
            maybeAITurn();
          }
        }, 300);
      });
    }

    // ── Reset / rematch ──
    function resetGame() {
      cancelAI?.();
      state = createCrossingGame();
      const winOverlay = container.querySelector('#cx-win-overlay') as HTMLElement;
      if (winOverlay) winOverlay.hidden = true;
    }

    container.querySelector('#cx-win-rematch')?.addEventListener('click', resetGame);
    container.querySelector('#cx-win-home')?.addEventListener('click', () => navigate('home'));

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Home';
    backBtn.addEventListener('click', () => navigate('home'));
    root.appendChild(backBtn);

    // Cleanup
    return () => {
      cancelAI?.();
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
    };
  },
};

function refreshHUD(container: HTMLElement, state: CGameState): void {
  const q = (id: string) => container.querySelector(`#${id}`) as HTMLElement | null;

  // Turn indicator
  const turnDot = q('cx-turn-dot');
  const turnText = q('cx-turn-text');
  if (turnDot && turnText) {
    if (state.phase === 'ended') {
      turnText.textContent = state.winner === 'A' ? 'You win!' : 'AI wins!';
      turnDot.className = 'cx-turn-dot ended';
    } else if (state.currentPlayer === 'A') {
      turnText.textContent = 'Your turn';
      turnDot.className = 'cx-turn-dot turn-a';
    } else {
      turnText.textContent = 'AI thinking...';
      turnDot.className = 'cx-turn-dot turn-b';
    }
  }

  // Scores
  const scoreA = q('cx-score-a');
  const scoreB = q('cx-score-b');
  if (scoreA) scoreA.textContent = `${state.scored.A} / ${state.totalUnits.A}`;
  if (scoreB) scoreB.textContent = `${state.scored.B} / ${state.totalUnits.B}`;

  // Turn count
  const turnCount = q('cx-turn-count');
  if (turnCount) turnCount.textContent = `Turn ${state.turn}`;

  // Selected unit info
  const infoEl = q('cx-unit-info');
  if (infoEl) {
    if (state.selectedUnitId != null) {
      const unit = state.units.find(u => u.unitId === state.selectedUnitId);
      if (unit && !unit.scored) {
        const def = getUnitDef(unit.defId);
        const moves = getValidMoves(state, unit);
        infoEl.innerHTML = `
          <div class="cx-selected-unit">
            <span class="cx-sel-emoji">${def.emoji}</span>
            <span class="cx-sel-name">${def.displayName}</span>
            <span class="cx-sel-owner">${unit.owner === 'A' ? 'You' : 'AI'}</span>
          </div>
          <div class="cx-sel-ability">${def.abilityDesc}</div>
          <div class="cx-sel-moves">${moves.length} valid move${moves.length !== 1 ? 's' : ''}</div>
        `;
      } else {
        infoEl.innerHTML = '<div class="cx-no-selection">Click one of your units to see moves</div>';
      }
    } else {
      infoEl.innerHTML = '<div class="cx-no-selection">Click one of your units to see moves</div>';
    }
  }
}

function checkWin(container: HTMLElement, state: CGameState): void {
  if (state.phase !== 'ended') return;
  const overlay = container.querySelector('#cx-win-overlay') as HTMLElement;
  if (!overlay || !overlay.hidden) return;

  overlay.hidden = false;
  const headline = container.querySelector('#cx-win-headline');
  if (headline) headline.textContent = state.winner === 'A' ? 'You win!' : 'AI wins!';

  const scoreA = container.querySelector('#cx-win-score-a');
  const scoreB = container.querySelector('#cx-win-score-b');
  if (scoreA) scoreA.textContent = `${state.scored.A}/${state.totalUnits.A}`;
  if (scoreB) scoreB.textContent = `${state.scored.B}/${state.totalUnits.B}`;

  const turns = container.querySelector('#cx-win-turns');
  if (turns) turns.textContent = `Completed in ${state.turn} turns`;
}

function buildAbilityList(container: HTMLElement): void {
  const list = container.querySelector('#cx-ability-list');
  if (!list) return;
  list.innerHTML = ALL_CROSSING_UNITS.map((def) => `
    <div class="cx-ability-item">
      <span class="cx-ability-emoji">${def.emoji}</span>
      <div>
        <div class="cx-ability-name">${def.displayName}</div>
        <div class="cx-ability-desc">${def.abilityDesc}</div>
      </div>
    </div>
  `).join('');
}
