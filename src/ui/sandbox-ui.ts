import type { MatchState, Direction } from '../types/game';
import { MOUSE, ELEPHANT, CAT, RABBIT, TURTLE, SKUNK, getPetDef } from '../sim/pet-defs';
import { submitReady } from '../sim/match';
import { MOUSE_STATS, ELEPHANT_STATS, CAT_STATS, RABBIT_STATS, TURTLE_STATS, SKUNK_STATS, WIN_PAINT_THRESHOLD } from '../config/balance';
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
  ability: string;
}

const ROSTER: PetRosterEntry[] = [
  {
    defId: MOUSE.id,
    hotkey: '1',
    ability: 'Scurry — sprints in a straight line, but turns randomly the moment anything blocks its path. Painter, not a fighter.',
  },
  {
    defId: ELEPHANT.id,
    hotkey: '2',
    ability: 'Unshakable — cannot be pushed by anything. Trudges in straight lines and only about-faces when it hits a wall, ramming through lighter pets along the way.',
  },
  {
    defId: CAT.id,
    hotkey: '3',
    ability: 'Stalker — wanders calmly until an enemy enters its line of sight. Then it triples its pace to close the gap and pounces.',
  },
  {
    defId: RABBIT.id,
    hotkey: '4',
    ability: 'Vault — when a pet blocks its path, leaps over it onto the tile beyond. Refuses to fight, just paints and hops.',
  },
  {
    defId: TURTLE.id,
    hotkey: '5',
    ability: 'Splash — once per second, paints all four neighboring tiles in its color. Slow walker, but its real damage is in coverage.',
  },
  {
    defId: SKUNK.id,
    hotkey: '6',
    ability: 'Spray — every adjacent enemy is forced to face directly away from the skunk, scattering enemy formations.',
  },
];

const STAT_LABELS = {
  [MOUSE.id]: MOUSE_STATS,
  [ELEPHANT.id]: ELEPHANT_STATS,
  [CAT.id]: CAT_STATS,
  [RABBIT.id]: RABBIT_STATS,
  [TURTLE.id]: TURTLE_STATS,
  [SKUNK.id]: SKUNK_STATS,
} as const;

const FACING_NAME: Record<Direction, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
const FACING_ARROW: Record<Direction, string> = { N: '▲', E: '▶', S: '▼', W: '◀' };
const CW_NEXT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

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
          <span><span class="stat-label">SPD</span> ${stats.speedTilesPerSec}/s</span>
        </div>
      </div>
      <div class="pet-hotkey">${entry.hotkey}</div>
      <div class="pet-tooltip">
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Health</span><span class="pet-tooltip-val">${stats.maxHp}</span></div>
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Attack</span><span class="pet-tooltip-val">${stats.atk}</span></div>
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Move speed</span><span class="pet-tooltip-val">${stats.speedTilesPerSec} tile/s</span></div>
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Attack speed</span><span class="pet-tooltip-val">${stats.atkSpeedPerSec}/s</span></div>
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Weight</span><span class="pet-tooltip-val">${stats.weight}</span></div>
        <div class="pet-tooltip-row"><span class="pet-tooltip-key">Footprint</span><span class="pet-tooltip-val">${def.size.w}×${def.size.h}</span></div>
        <div class="pet-tooltip-ability">${entry.ability}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      ui.selectedDefId = def.id;
      refreshRoster(ui);
    });
    root.appendChild(card);
  }
}

function bindFacing(ui: SandboxUIState): void {
  const rotateBtn = document.getElementById('btn-rotate');
  if (!rotateBtn) return;
  rotateBtn.addEventListener('click', () => {
    ui.facing = CW_NEXT[ui.facing];
    refreshFacing(ui);
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

function refreshFacing(ui: SandboxUIState): void {
  const arrow = document.getElementById('facing-arrow');
  const name = document.getElementById('facing-name');
  if (arrow) arrow.textContent = FACING_ARROW[ui.facing];
  if (name) name.textContent = FACING_NAME[ui.facing];
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
