/**
 * screen.ts — Critter Crossing v2 game screen.
 *
 * 8×8 board, 5 units per side, score 3 to win, AI opponent.
 * Features: event log, difficulty selector, invalid-move feedback.
 */

import type { Screen } from '../app/router';
import { navigate } from '../app/router';
import type { CGameState, AIDifficulty } from './types';
import { createCrossingGame, performMove, skipTurnIfNeeded } from './game';
import { createCrossingRC, renderCrossingGame, pixelToTile } from './render';
import { getValidMoves } from './moves';
import { getUnitDef, ALL_CROSSING_UNITS } from './units';
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
          <span class="cx-score-val" id="cx-score-a">0 / 3</span>
          <div class="cx-progress"><div class="cx-progress-fill cx-progress-a" id="cx-prog-a" style="width:0%"></div></div>
        </div>
        <div class="cx-score-vs">vs</div>
        <div class="cx-score cx-score-b">
          <span class="cx-score-tag">AI</span>
          <span class="cx-score-val" id="cx-score-b">0 / 3</span>
          <div class="cx-progress"><div class="cx-progress-fill cx-progress-b" id="cx-prog-b" style="width:0%"></div></div>
        </div>
      </div>
    </header>

    <main class="crossing-layout">
      <aside class="crossing-sidebar">
        <div class="panel-title">Difficulty</div>
        <div class="cx-difficulty" id="cx-difficulty">
          <button class="cx-diff-btn" data-diff="easy">Easy</button>
          <button class="cx-diff-btn cx-diff-active" data-diff="normal">Normal</button>
          <button class="cx-diff-btn" data-diff="hard">Hard</button>
        </div>

        <div class="panel-title" style="margin-top:12px">Selected Unit</div>
        <div class="cx-unit-info" id="cx-unit-info">
          <div class="cx-no-selection">Click one of your units to see moves</div>
        </div>
        <div class="panel-title" style="margin-top:12px">Turn</div>
        <div class="cx-turn-count" id="cx-turn-count">Turn 1</div>
        <div class="panel-title" style="margin-top:12px">Legend</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch" style="background:rgba(79,209,165,0.35);border:1px solid rgba(79,209,165,0.7)"></span> Move</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(255,100,80,0.25);border:1px solid rgba(255,100,80,0.7)"></span> Capture</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(255,180,50,0.25);border:1px solid rgba(255,180,50,0.7)"></span> Push</div>
          <div class="legend-item"><span class="swatch" style="background:rgba(255,209,102,0.3);border:1px solid rgba(255,209,102,0.5)"></span> Goal row</div>
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
          <p>Score <strong>3 units</strong> on the enemy's back row to win!</p>
          <p><strong>Click</strong> a unit, then <strong>click</strong> a highlighted tile.</p>
          <p>Captured units respawn on their home row.</p>
        </div>
        <div class="panel-title" style="margin-top:12px">Event Log</div>
        <div class="cx-event-log" id="cx-event-log">
          <div class="cx-event-empty">Moves will appear here...</div>
        </div>
        <div class="panel-title" style="margin-top:12px">Units</div>
        <div class="cx-ability-list" id="cx-ability-list"></div>
      </aside>
    </main>

    <footer class="footer">
      <span><kbd>Click</kbd> select unit</span>
      <span><kbd>Click</kbd> highlighted tile to move</span>
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
          <span class="win-recap-val" id="cx-win-score-a">0/3</span>
        </div>
        <div class="win-recap-vs">vs</div>
        <div class="win-recap-side">
          <span class="win-recap-tag win-recap-tag-b">AI</span>
          <span class="win-recap-val" id="cx-win-score-b">0/3</span>
        </div>
      </div>
      <div class="cx-win-turns" id="cx-win-turns">Completed in 0 turns</div>
      <div class="win-actions">
        <button class="btn-primary" id="cx-win-rematch">\u{25B6} Play Again</button>
        <button class="btn-secondary" id="cx-win-home">\u{2190} Back to Home</button>
      </div>
    </div>
  </div>
</div>
    `;

    const container = root.querySelector('#crossing-container') as HTMLElement;
    const canvas = container.querySelector('#cx-game') as HTMLCanvasElement;
    const rc = createCrossingRC(canvas);

    let currentDifficulty: AIDifficulty = 'normal';
    let state = createCrossingGame(currentDifficulty);
    let cancelAI: (() => void) | null = null;
    let rafId: number | null = null;
    let lastEventCount = 0;

    // Build ability list
    buildAbilityList(container);

    // ── Difficulty selector ──
    container.querySelectorAll('.cx-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const diff = (btn as HTMLElement).dataset.diff as AIDifficulty;
        currentDifficulty = diff;
        // Update active button
        container.querySelectorAll('.cx-diff-btn').forEach(b => b.classList.remove('cx-diff-active'));
        btn.classList.add('cx-diff-active');
        // Reset game with new difficulty
        resetGame();
      });
    });

    // ── Hover tracking ──
    canvas.addEventListener('mousemove', (e) => {
      const tile = pixelToTile(rc, e.clientX, e.clientY);
      state.hoverTile = tile;

      if (!tile || state.phase !== 'playing' || state.currentPlayer !== 'A') {
        canvas.style.cursor = 'default';
        return;
      }

      if (state.selectedUnitId != null) {
        const unit = state.units.find(u => u.unitId === state.selectedUnitId);
        if (unit) {
          const moves = getValidMoves(state, unit);
          if (moves.some(m => m.to.x === tile.x && m.to.y === tile.y)) {
            canvas.style.cursor = 'pointer';
            return;
          }
        }
      }

      for (const u of state.units) {
        if (u.owner !== 'A') continue;
        if (u.pos.x === tile.x && u.pos.y === tile.y) {
          canvas.style.cursor = 'pointer';
          return;
        }
      }
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', () => {
      state.hoverTile = null;
      canvas.style.cursor = 'default';
    });

    // ── Render loop ──
    function render() {
      renderCrossingGame(rc, state);
      refreshHUD(container, state);
      refreshEventLog(container, state);
      checkWin(container, state);
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    // ── Click handling ──
    canvas.addEventListener('click', (e) => {
      if (state.phase !== 'playing') return;
      if (state.currentPlayer !== 'A') return;

      const tile = pixelToTile(rc, e.clientX, e.clientY);
      if (!tile) return;

      // If a unit is selected, try to move there
      if (state.selectedUnitId != null) {
        const unit = state.units.find(u => u.unitId === state.selectedUnitId);
        if (unit) {
          const valid = getValidMoves(state, unit);
          if (valid.some(m => m.to.x === tile.x && m.to.y === tile.y)) {
            performMove(state, state.selectedUnitId, tile);
            state.selectedUnitId = null;
            maybeAITurn();
            return;
          }
        }

        // Check if clicking another friendly unit to reselect
        const clickedUnit = state.units.find(u =>
          u.owner === 'A' && u.pos.x === tile.x && u.pos.y === tile.y
        );
        if (clickedUnit) {
          state.selectedUnitId = clickedUnit.unitId;
          return;
        }

        // Invalid click with unit selected — show feedback
        showInvalidMoveFeedback(tile);
        state.selectedUnitId = null;
        return;
      }

      // Try to select a unit at this tile
      for (const u of state.units) {
        if (u.owner !== 'A') continue;
        if (u.pos.x === tile.x && u.pos.y === tile.y) {
          state.selectedUnitId = u.unitId;
          return;
        }
      }
    });

    // Invalid move: brief red flash VFX
    function showInvalidMoveFeedback(tile: { x: number; y: number }) {
      const now = performance.now();
      state.vfx.push({
        type: 'capture', // reuse capture VFX (red flash) for invalid move
        pos: { ...tile },
        size: 1,
        owner: 'A',
        startTime: now,
        duration: 300,
      });
    }

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
      skipTurnIfNeeded(state);
      if (state.currentPlayer !== 'B') return;

      cancelAI?.();
      cancelAI = scheduleAIMove(state, (unitId, to) => {
        state.selectedUnitId = unitId;
        setTimeout(() => {
          performMove(state, unitId, to);
          state.selectedUnitId = null;
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
      state = createCrossingGame(currentDifficulty);
      lastEventCount = 0;
      const winOverlay = container.querySelector('#cx-win-overlay') as HTMLElement;
      if (winOverlay) winOverlay.hidden = true;
    }

    container.querySelector('#cx-win-rematch')?.addEventListener('click', resetGame);
    container.querySelector('#cx-win-home')?.addEventListener('click', () => navigate('home'));

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '\u{2190} Home';
    backBtn.addEventListener('click', () => navigate('home'));
    root.appendChild(backBtn);

    // Event log refresh helper (only update DOM when events change)
    function refreshEventLog(cont: HTMLElement, st: CGameState) {
      if (st.events.length === lastEventCount) return;
      lastEventCount = st.events.length;

      const logEl = cont.querySelector('#cx-event-log');
      if (!logEl) return;

      if (st.events.length === 0) {
        logEl.innerHTML = '<div class="cx-event-empty">Moves will appear here...</div>';
        return;
      }

      logEl.innerHTML = st.events
        .slice()
        .reverse()
        .map(ev => {
          const ownerClass = ev.owner === 'A' ? 'cx-event-you' : 'cx-event-ai';
          return `<div class="cx-event ${ownerClass}">
            <span class="cx-event-icon">${ev.icon}</span>
            <span class="cx-event-text">${ev.text}</span>
          </div>`;
        })
        .join('');

      // Scroll to top (newest)
      logEl.scrollTop = 0;
    }

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

  const scoreA = q('cx-score-a');
  const scoreB = q('cx-score-b');
  if (scoreA) scoreA.textContent = `${state.scored.A} / ${state.scoreToWin}`;
  if (scoreB) scoreB.textContent = `${state.scored.B} / ${state.scoreToWin}`;
  const progA = q('cx-prog-a') as HTMLElement | null;
  const progB = q('cx-prog-b') as HTMLElement | null;
  if (progA) progA.style.width = `${(state.scored.A / state.scoreToWin) * 100}%`;
  if (progB) progB.style.width = `${(state.scored.B / state.scoreToWin) * 100}%`;

  const turnCount = q('cx-turn-count');
  if (turnCount) turnCount.textContent = `Turn ${state.turn}`;

  const infoEl = q('cx-unit-info');
  if (infoEl) {
    if (state.selectedUnitId != null) {
      const unit = state.units.find(u => u.unitId === state.selectedUnitId);
      if (unit) {
        const def = getUnitDef(unit.defId);
        const moves = getValidMoves(state, unit);
        infoEl.innerHTML = `
          <div class="cx-selected-unit">
            <span class="cx-sel-emoji">${def.emoji}</span>
            <span class="cx-sel-name">${def.displayName}</span>
            <span class="cx-sel-owner">${unit.owner === 'A' ? 'You' : 'AI'}</span>
          </div>
          <div class="cx-sel-move">${def.moveDesc}</div>
          <div class="cx-sel-ability">${def.abilityDesc}</div>
          <div class="cx-sel-moves">${moves.length} valid move${moves.length !== 1 ? 's' : ''}${unit.scored ? ' \u{2714} Scored' : ''}</div>
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
  if (scoreA) scoreA.textContent = `${state.scored.A}/${state.scoreToWin}`;
  if (scoreB) scoreB.textContent = `${state.scored.B}/${state.scoreToWin}`;

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
        <div class="cx-ability-move">${def.moveDesc}</div>
        <div class="cx-ability-desc">${def.abilityDesc}</div>
      </div>
    </div>
  `).join('');
}
