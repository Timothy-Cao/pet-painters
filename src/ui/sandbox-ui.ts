import type { MatchState, PlayerId, Direction } from '../types/game';
import { MOUSE, ELEPHANT, getPetDef } from '../sim/pet-defs';
import { submitReady } from '../sim/match';
import { MOUSE_STATS, ELEPHANT_STATS, WIN_PAINT_THRESHOLD } from '../config/balance';
import { BOARD_SIZE } from '../config/constants';
import { scoreFor } from '../sim/board';
import { EXECUTION_PHASE_SECONDS } from '../config/balance';
import { TICKS_PER_SEC } from '../config/constants';

export interface SandboxUIState {
  selectedDefId: string | null;
  facing: Direction;
}

interface PetRosterEntry {
  defId: string;
  hotkey: string;
}

const ROSTER: PetRosterEntry[] = [
  { defId: MOUSE.id, hotkey: '1' },
  { defId: ELEPHANT.id, hotkey: '2' },
];

const STAT_LABELS = {
  [MOUSE.id]: MOUSE_STATS,
  [ELEPHANT.id]: ELEPHANT_STATS,
} as const;

export function createSandboxUIState(): SandboxUIState {
  return { selectedDefId: MOUSE.id, facing: 'N' };
}

export interface SandboxUIBindings {
  onReset: () => void;
}

export function mountSandboxUI(
  state: MatchState,
  ui: SandboxUIState,
  bindings: SandboxUIBindings,
): void {
  buildPetRoster(state, ui);
  bindPlayerToggle(state);
  bindFacing(ui);
  bindActions(state, bindings);
  refreshAll(state, ui);
}

function buildPetRoster(_state: MatchState, ui: SandboxUIState): void {
  const root = document.getElementById('pet-roster')!;
  root.innerHTML = '';
  for (const entry of ROSTER) {
    const def = getPetDef(entry.defId);
    const stats = STAT_LABELS[entry.defId as keyof typeof STAT_LABELS];

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pet-card';
    card.dataset.defId = def.id;
    card.innerHTML = `
      <div class="pet-emoji">${def.emoji}</div>
      <div class="pet-info">
        <div class="pet-name">${def.displayName}<span class="size-chip">${def.size.w}×${def.size.h}</span></div>
        <div class="pet-stats">
          <span><span class="stat-label">HP</span> ${stats.maxHp}</span>
          <span><span class="stat-label">ATK</span> ${stats.atk}</span>
          <span><span class="stat-label">SPD</span> ${stats.speedTilesPerSec}</span>
        </div>
      </div>
      <div class="pet-hotkey">${entry.hotkey}</div>
    `;
    card.addEventListener('click', () => {
      ui.selectedDefId = def.id;
      refreshRoster(ui);
    });
    root.appendChild(card);
  }
}

function bindPlayerToggle(state: MatchState): void {
  document.querySelectorAll<HTMLButtonElement>('.btn-player').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.player as PlayerId;
      state.activePlanningPlayer = p;
      refreshPlayerToggle(state);
    });
  });
}

function bindFacing(ui: SandboxUIState): void {
  document.querySelectorAll<HTMLButtonElement>('.btn-facing').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.facing = btn.dataset.facing as Direction;
      refreshFacing(ui);
    });
  });
}

function bindActions(state: MatchState, bindings: SandboxUIBindings): void {
  document.getElementById('btn-start')!.addEventListener('click', () => {
    if (state.phase !== 'planning') return;
    submitReady(state, 'A');
    submitReady(state, 'B');
  });
  document.getElementById('btn-reset')!.addEventListener('click', () => {
    bindings.onReset();
  });
}

export function refreshAll(state: MatchState, ui: SandboxUIState): void {
  refreshRoster(ui);
  refreshPlayerToggle(state);
  refreshFacing(ui);
  refreshScores(state);
  refreshEnergy(state);
  refreshPhase(state);
  refreshExecBar(state);
}

function refreshRoster(ui: SandboxUIState): void {
  document.querySelectorAll<HTMLElement>('.pet-card').forEach((el) => {
    el.classList.toggle('active', el.dataset.defId === ui.selectedDefId);
  });
}

function refreshPlayerToggle(state: MatchState): void {
  document.querySelectorAll<HTMLElement>('.btn-player').forEach((el) => {
    el.classList.toggle('active', el.dataset.player === state.activePlanningPlayer);
  });
}

function refreshFacing(ui: SandboxUIState): void {
  document.querySelectorAll<HTMLElement>('.btn-facing').forEach((el) => {
    el.classList.toggle('active', el.dataset.facing === ui.facing);
  });
}

function refreshScores(state: MatchState): void {
  const total = BOARD_SIZE * BOARD_SIZE;
  const a = scoreFor(state.board, 'A');
  const b = scoreFor(state.board, 'B');
  document.getElementById('score-a')!.textContent = String(a);
  document.getElementById('score-b')!.textContent = String(b);
  (document.getElementById('score-fill-a') as HTMLElement).style.width = `${(a / total) * 100}%`;
  (document.getElementById('score-fill-b') as HTMLElement).style.width = `${(b / total) * 100}%`;
  // Highlight near-win
  const winPct = (WIN_PAINT_THRESHOLD / total) * 100;
  void winPct;
}

function refreshEnergy(state: MatchState): void {
  const aEl = document.getElementById('energy-a')!;
  const bEl = document.getElementById('energy-b')!;
  if (state.sandbox) {
    aEl.textContent = '∞';
    bEl.textContent = '∞';
  } else {
    aEl.textContent = String(state.energy.A);
    bEl.textContent = String(state.energy.B);
  }
}

function refreshPhase(state: MatchState): void {
  const pill = document.getElementById('phase-pill')!;
  const text = document.getElementById('phase-text')!;
  pill.classList.remove('phase-planning', 'phase-execution', 'phase-ended');
  pill.classList.add(`phase-${state.phase}`);
  if (state.phase === 'planning') text.textContent = 'Planning';
  else if (state.phase === 'execution') text.textContent = 'Executing';
  else text.textContent = state.winner ? `Player ${state.winner} wins!` : 'Ended';

  document.querySelector('.layout')!.classList.toggle('exec', state.phase === 'execution');

  const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
  startBtn.disabled = state.phase !== 'planning';
}

function refreshExecBar(state: MatchState): void {
  const bar = document.getElementById('exec-bar')!;
  const fill = document.getElementById('exec-fill')!;
  const label = document.getElementById('exec-label')!;
  if (state.phase === 'execution') {
    bar.classList.add('active');
    const elapsedTicks = state.tick - state.execPhaseStartTick;
    const elapsedSec = elapsedTicks / TICKS_PER_SEC;
    const pct = Math.min(100, (elapsedSec / EXECUTION_PHASE_SECONDS) * 100);
    (fill as HTMLElement).style.width = `${pct}%`;
    label.textContent = `Execution ${elapsedSec.toFixed(1)}s / ${EXECUTION_PHASE_SECONDS.toFixed(1)}s`;
  } else {
    bar.classList.remove('active');
    (fill as HTMLElement).style.width = `0%`;
    label.textContent = state.phase === 'planning' ? 'Plan deployments, then Start Round' : 'Match ended';
  }
}

let bannerTimeout: number | null = null;
export function showBanner(msg: string): void {
  let el = document.querySelector<HTMLElement>('.banner');
  if (!el) {
    el = document.createElement('div');
    el.className = 'banner';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  if (bannerTimeout) window.clearTimeout(bannerTimeout);
  bannerTimeout = window.setTimeout(() => el!.classList.remove('show'), 1800);
}
