import type { MatchState, Direction } from '../types/game';
import type { PetDefinition } from '../types/pet';
import { ALL_PETS } from '../sim/pets';
import { submitReady } from '../sim/match';
import { undeploy } from '../sim/deploy';
import { getPetDef } from '../sim/pet-defs';
import { WIN_PAINT_THRESHOLD, EXECUTION_PHASE_SECONDS } from '../config/balance';
import { BOARD_SIZE, TICKS_PER_SEC } from '../config/constants';
import { scoreFor } from '../sim/board';
import { getRecentEvents } from './event-log';

export interface SandboxUIState {
  selectedDefId: string | null;
  facing: Direction;
  inspectedPetId: number | null;
}

function speedLabel(speedTilesPerSec: number): string {
  if (speedTilesPerSec === 0) return 'Still';
  if (speedTilesPerSec < 1) return 'Slow';
  if (speedTilesPerSec < 2) return 'Normal';
  return 'Fast';
}

const FACING_NAME: Record<Direction, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
const FACING_ARROW: Record<Direction, string> = { N: '▲', E: '▶', S: '▼', W: '◀' };
const CW_NEXT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

export function createSandboxUIState(): SandboxUIState {
  const first = ALL_PETS[0];
  return { selectedDefId: first ? first.id : null, facing: 'N', inspectedPetId: null };
}

export interface SandboxUIBindings {
  onReset: () => void;
}

export function mountSandboxUI(
  state: MatchState,
  ui: SandboxUIState,
  bindings: SandboxUIBindings,
): void {
  buildPetRoster(ui);
  bindFacing(ui);
  bindActions(state, bindings);
  bindInspector(state, ui);
  refreshAll(state, ui);
}

function bindInspector(state: MatchState, ui: SandboxUIState): void {
  document.getElementById('inspect-close')?.addEventListener('click', () => {
    ui.inspectedPetId = null;
    refreshAll(state, ui);
  });
  document.getElementById('inspect-undeploy')?.addEventListener('click', () => {
    if (ui.inspectedPetId == null) return;
    undeploy(state, ui.inspectedPetId);
    ui.inspectedPetId = null;
    refreshAll(state, ui);
  });
}

function buildPetRoster(ui: SandboxUIState): void {
  const root = document.getElementById('pet-roster')!;
  root.innerHTML = '';
  ensurePopup();
  for (const def of ALL_PETS) {
    const card = renderPetCard(def);
    card.addEventListener('click', () => {
      ui.selectedDefId = def.id;
      refreshRoster(ui);
    });
    card.addEventListener('mouseenter', () => showPopup(card, def));
    card.addEventListener('mouseleave', () => hidePopup());
    card.addEventListener('focus', () => showPopup(card, def));
    card.addEventListener('blur', () => hidePopup());
    root.appendChild(card);
  }
}

function renderPetCard(def: PetDefinition): HTMLButtonElement {
  const spd = speedLabel(def.stats.speedTilesPerSec);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'pet-card';
  card.dataset.defId = def.id;
  card.innerHTML = `
    <div class="pet-emoji">${def.emoji}</div>
    <div class="pet-info">
      <div class="pet-name">${def.displayName}<span class="pet-hotkey">${def.ui.hotkey}</span></div>
      <div class="pet-short">${def.ui.short}</div>
      <div class="pet-quick-stats">
        <span class="quick-pill quick-pill-${spd.toLowerCase()}">${spd}</span>
        <span class="quick-stat"><span class="quick-key">HP</span> ${def.stats.maxHp}</span>
        <span class="quick-stat"><span class="quick-key">ATK</span> ${def.stats.atk}</span>
      </div>
    </div>
  `;
  return card;
}

function ensurePopup(): HTMLElement {
  let el = document.getElementById('pet-popup');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'pet-popup';
  el.className = 'pet-popup';
  document.body.appendChild(el);
  return el;
}

function showPopup(anchor: HTMLElement, def: PetDefinition): void {
  const popup = ensurePopup();
  const stats = def.stats;
  const spd = speedLabel(stats.speedTilesPerSec);
  const speedText = stats.speedTilesPerSec === 0
    ? 'Still (does not walk)'
    : `${stats.speedTilesPerSec} tile/s — ${spd}`;
  popup.innerHTML = `
    <div class="popup-head">
      <span class="popup-emoji">${def.emoji}</span>
      <span class="popup-name">${def.displayName}</span>
      <span class="popup-size">${def.size.w}×${def.size.h}</span>
    </div>
    <div class="popup-stats">
      <div class="popup-row"><span>Health</span><span>${stats.maxHp}</span></div>
      <div class="popup-row"><span>Attack</span><span>${stats.atk}</span></div>
      <div class="popup-row"><span>Move speed</span><span>${speedText}</span></div>
      <div class="popup-row"><span>Attack speed</span><span>${stats.atkSpeedPerSec === 0 ? '—' : `${stats.atkSpeedPerSec}/s`}</span></div>
      <div class="popup-row"><span>Weight</span><span>${stats.weight}</span></div>
      <div class="popup-row" title="Lower goes first each tick — earlier acts wins movement conflicts; later acts wins paint conflicts on contested tiles."><span>Initiative</span><span>${stats.order}</span></div>
    </div>
    <div class="popup-ability">${def.ui.ability}</div>
  `;
  const rect = anchor.getBoundingClientRect();
  const popupWidth = 300;
  const margin = 12;
  let left = rect.right + margin;
  if (left + popupWidth > window.innerWidth - 8) {
    left = rect.left - popupWidth - margin;
  }
  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.max(8, rect.top)}px`;
  popup.classList.add('show');
}

function hidePopup(): void {
  const popup = document.getElementById('pet-popup');
  if (popup) popup.classList.remove('show');
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
  document.getElementById('rs-close')?.addEventListener('click', () => {
    state.lastRoundSummary = null;
  });
}

export function refreshAll(state: MatchState, ui: SandboxUIState): void {
  refreshRoster(ui);
  refreshFacing(ui);
  refreshScores(state);
  refreshEnergy(state);
  refreshPhase(state);
  refreshExecBar(state);
  refreshTactical(state);
  refreshInspector(state, ui);
  refreshRoundSummary(state);
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
  const n = total - a - b;
  const aPct = (a / total) * 100;
  const bPct = (b / total) * 100;
  const nPct = (n / total) * 100;
  document.getElementById('pct-a')!.textContent = `${aPct.toFixed(0)}%`;
  document.getElementById('pct-b')!.textContent = `${bPct.toFixed(0)}%`;
  (document.getElementById('fill-a') as HTMLElement).style.width = `${aPct}%`;
  (document.getElementById('fill-n') as HTMLElement).style.width = `${nPct}%`;
  (document.getElementById('fill-b') as HTMLElement).style.width = `${bPct}%`;
  void WIN_PAINT_THRESHOLD;
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

function refreshTactical(state: MatchState): void {
  // Tick counter (only meaningful during execution).
  const tickRow = document.getElementById('tac-tick-row');
  const tickEl = document.getElementById('tac-tick');
  const tickTotalEl = document.getElementById('tac-tick-total');
  if (tickRow && tickEl && tickTotalEl) {
    if (state.phase === 'execution') {
      tickRow.classList.add('active');
      const elapsed = state.tick - state.execPhaseStartTick;
      tickEl.textContent = String(elapsed);
      tickTotalEl.textContent = String(TICKS_PER_SEC * EXECUTION_PHASE_SECONDS);
    } else {
      tickRow.classList.remove('active');
      tickEl.textContent = '—';
    }
  }

  // Deployment counts per side.
  let aCount = 0, bCount = 0;
  for (const p of state.pets) {
    if (p.owner === 'A') aCount++;
    else bCount++;
  }
  setText('tac-deploy-a', String(aCount));
  setText('tac-deploy-b', String(bCount));

  // Recent events.
  const list = document.getElementById('tac-events');
  if (!list) return;
  const events = getRecentEvents();
  if (events.length === 0) {
    list.innerHTML = '<li class="tac-events-empty">No events yet</li>';
    return;
  }
  // Diff-friendly render: rebuild only if the set of event timestamps differs.
  const wantedKey = events.map((e) => e.at.toFixed(0)).join('|');
  if (list.dataset.key === wantedKey) return;
  list.dataset.key = wantedKey;
  list.innerHTML = '';
  for (const e of events) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="tac-event-emoji">${e.emoji}</span><span>${e.text}</span>`;
    list.appendChild(li);
  }
}

function refreshInspector(state: MatchState, ui: SandboxUIState): void {
  const card = document.getElementById('pet-inspect') as HTMLElement | null;
  if (!card) return;
  const id = ui.inspectedPetId;
  const pet = id == null ? null : state.pets.find((p) => p.petId === id) ?? null;
  // Pet died or de-selected → hide and clear the id.
  if (!pet || state.phase !== 'planning') {
    card.hidden = true;
    if (!pet && id != null) ui.inspectedPetId = null;
    return;
  }
  const def = getPetDef(pet.defId);
  card.hidden = false;
  setText('inspect-emoji', def.emoji);
  setText('inspect-name', def.displayName);
  const ownerPill = document.getElementById('inspect-owner');
  if (ownerPill) {
    ownerPill.textContent = pet.owner;
    ownerPill.classList.toggle('owner-a', pet.owner === 'A');
    ownerPill.classList.toggle('owner-b', pet.owner === 'B');
  }
  setText('inspect-hp', `${Math.max(0, pet.hp)} / ${def.maxHp}`);
  const hpFill = document.getElementById('inspect-hp-fill') as HTMLElement | null;
  if (hpFill) {
    const frac = Math.max(0, pet.hp / def.maxHp);
    hpFill.style.width = `${frac * 100}%`;
    hpFill.style.background = frac > 0.5 ? 'var(--good)' : frac > 0.25 ? 'var(--accent)' : 'var(--player-b)';
  }
  setText('inspect-facing', { N: 'North', E: 'East', S: 'South', W: 'West' }[pet.facing]);
  setText('inspect-pos', `(${pet.anchor.x}, ${pet.anchor.y})`);
  setText('inspect-blurb', def.ui.ability);
}

function refreshRoundSummary(state: MatchState): void {
  const card = document.getElementById('round-summary') as HTMLElement | null;
  if (!card) return;
  const summary = state.lastRoundSummary;
  const shouldShow = !!summary && state.phase === 'planning';
  if (!shouldShow) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  if (!summary) return;
  setText('rs-round', String(summary.round));
  setDelta('rs-a-delta', summary.aTilesDelta);
  setDelta('rs-b-delta', summary.bTilesDelta);
  setText('rs-a-total', String(summary.aTilesEnd));
  setText('rs-b-total', String(summary.bTilesEnd));
  setText('rs-a-lost', String(summary.aLost));
  setText('rs-b-lost', String(summary.bLost));

  const arrow = document.getElementById('rs-momentum-arrow') as HTMLElement | null;
  const label = document.getElementById('rs-momentum-label');
  if (arrow && label) {
    arrow.classList.remove('to-a', 'to-b', 'even');
    const swing = summary.aTilesDelta - summary.bTilesDelta;
    if (swing > 0) { arrow.classList.add('to-a'); label.textContent = 'Momentum A'; }
    else if (swing < 0) { arrow.classList.add('to-b'); label.textContent = 'Momentum B'; }
    else { arrow.classList.add('even'); label.textContent = 'Even'; }
  }
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDelta(id: string, value: number): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value > 0 ? `+${value}` : `${value}`;
  el.classList.toggle('positive', value > 0);
  el.classList.toggle('negative', value < 0);
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
