import type { MatchState, PlayerId } from '../types/game';
import { scoreFor } from '../sim/board';
import { BOARD_SIZE } from '../config/constants';
import { playWin } from '../render/sfx';

let onRematch: (() => void) | null = null;
let confettiSpawned = false;
let _root: HTMLElement = document.documentElement;

export function setWinOverlayRoot(el: HTMLElement): void {
  _root = el;
}

function q(id: string): HTMLElement | null {
  return _root.querySelector<HTMLElement>(`#${id}`);
}

export function bindWinOverlay(rematch: () => void): void {
  onRematch = rematch;
  q('win-rematch')?.addEventListener('click', () => {
    onRematch?.();
  });
}

/** Re-renderable each frame; only mutates DOM when the phase actually flips. */
export function refreshWinOverlay(state: MatchState): void {
  const overlay = q('win-overlay');
  if (!overlay) return;

  if (state.phase !== 'ended' || !state.winner) {
    if (!overlay.hidden) {
      overlay.hidden = true;
      overlay.classList.remove('win-a', 'win-b');
      const confetti = q('win-confetti');
      if (confetti) confetti.innerHTML = '';
      confettiSpawned = false;
    }
    return;
  }

  if (!overlay.hidden) return; // already shown — don't re-trigger animations
  overlay.hidden = false;
  overlay.classList.add(state.winner === 'A' ? 'win-a' : 'win-b');

  const winnerEl = q('win-winner');
  if (winnerEl) winnerEl.textContent = state.winner;

  const total = BOARD_SIZE * BOARD_SIZE;
  const a = scoreFor(state.board, 'A');
  const b = scoreFor(state.board, 'B');
  setText('win-recap-a', `${Math.round((a / total) * 100)}%`);
  setText('win-recap-b', `${Math.round((b / total) * 100)}%`);

  if (!confettiSpawned) {
    spawnConfetti(state.winner);
    playWin();
    confettiSpawned = true;
  }
}

function setText(id: string, value: string): void {
  const el = q(id);
  if (el) el.textContent = value;
}

function spawnConfetti(winner: PlayerId): void {
  const root = q('win-confetti');
  if (!root) return;
  root.innerHTML = '';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Winner-themed palette: their team color + accents + white.
  const palette = winner === 'A'
    ? ['#5b8def', '#8db4ff', '#ffd166', '#ffffff']
    : ['#f25f5c', '#ff8b89', '#ffd166', '#ffffff'];
  const COUNT = 80;
  const vw = window.innerWidth;
  for (let i = 0; i < COUNT; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const startX = Math.random() * vw;
    const drift = (Math.random() - 0.5) * 280;       // horizontal drift -140..140
    const rot = (Math.random() * 1440 - 720).toFixed(0); // rotate -720..720 deg
    const delay = (Math.random() * 0.6).toFixed(2);
    const dur = (2.0 + Math.random() * 1.6).toFixed(2);
    const w = 6 + Math.random() * 6;
    const h = 10 + Math.random() * 8;
    piece.style.left = `${startX}px`;
    piece.style.width = `${w}px`;
    piece.style.height = `${h}px`;
    piece.style.background = palette[i % palette.length];
    piece.style.setProperty('--drift', `${drift}px`);
    piece.style.setProperty('--rot', `${rot}deg`);
    piece.style.setProperty('--delay', `${delay}s`);
    piece.style.setProperty('--dur', `${dur}s`);
    root.appendChild(piece);
  }
}
