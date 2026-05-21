import type { MatchState, PlayerId, RoundSnapshot } from '../types/game';
import { createInitialBoard, scoreFor } from './board';
import {
  STARTING_ENERGY,
  ENERGY_CAP,
  ENERGY_PER_EXEC_SECOND,
  WIN_PAINT_THRESHOLD,
} from '../config/balance';
import { TICKS_PER_SEC } from '../config/constants';
import { advanceTick } from './tick';

export function createInitialMatch(opts: { sandbox?: boolean } = {}): MatchState {
  const sandbox = opts.sandbox ?? false;
  return {
    board: createInitialBoard(),
    pets: [],
    nextPetId: 1,
    energy: { A: STARTING_ENERGY, B: STARTING_ENERGY },
    phase: 'planning',
    tick: 0,
    execPhaseStartTick: 0,
    activePlanningPlayer: 'A',
    ready: { A: false, B: false },
    winner: null,
    moveIntents: [],
    sandbox,
    execStartSnapshot: null,
    lastRoundSummary: null,
    round: 0,
  };
}

function takeSnapshot(state: MatchState): RoundSnapshot {
  return {
    aTiles: scoreFor(state.board, 'A'),
    bTiles: scoreFor(state.board, 'B'),
    aPets: state.pets.filter((p) => p.owner === 'A').length,
    bPets: state.pets.filter((p) => p.owner === 'B').length,
  };
}

export function submitReady(state: MatchState, player: PlayerId): void {
  if (state.phase !== 'planning') return;
  state.ready[player] = true;
  if (state.ready.A && state.ready.B) {
    state.phase = 'execution';
    state.execPhaseStartTick = state.tick;
    state.ready = { A: false, B: false };
    state.activePlanningPlayer = 'A';
    state.execStartSnapshot = takeSnapshot(state);
    state.lastRoundSummary = null; // any stale summary is gone now that a new round started
    state.round += 1;
  }
}

function regenEnergy(state: MatchState): void {
  if (state.sandbox) return;
  const elapsed = state.tick - state.execPhaseStartTick;
  if (elapsed > 0 && elapsed % TICKS_PER_SEC === 0) {
    state.energy.A = Math.min(ENERGY_CAP, state.energy.A + ENERGY_PER_EXEC_SECOND);
    state.energy.B = Math.min(ENERGY_CAP, state.energy.B + ENERGY_PER_EXEC_SECOND);
  }
}

function checkWin(state: MatchState): void {
  const aScore = scoreFor(state.board, 'A');
  const bScore = scoreFor(state.board, 'B');
  if (aScore >= WIN_PAINT_THRESHOLD && bScore >= WIN_PAINT_THRESHOLD) {
    state.winner = aScore >= bScore ? 'A' : 'B';
    state.phase = 'ended';
    return;
  }
  if (aScore >= WIN_PAINT_THRESHOLD) {
    state.winner = 'A';
    state.phase = 'ended';
    return;
  }
  if (bScore >= WIN_PAINT_THRESHOLD) {
    state.winner = 'B';
    state.phase = 'ended';
    return;
  }
}

export function tickMatch(state: MatchState): void {
  if (state.phase !== 'execution') return;
  advanceTick(state);
  regenEnergy(state);
  checkWin(state);
}

export function endExecution(state: MatchState): void {
  if (state.phase !== 'execution') return;
  state.phase = 'planning';
  // Build a summary from the snapshot taken at exec start and the current state.
  const snap = state.execStartSnapshot;
  if (snap) {
    const aTilesEnd = scoreFor(state.board, 'A');
    const bTilesEnd = scoreFor(state.board, 'B');
    const aPetsEnd = state.pets.filter((p) => p.owner === 'A').length;
    const bPetsEnd = state.pets.filter((p) => p.owner === 'B').length;
    state.lastRoundSummary = {
      round: state.round,
      aTilesDelta: aTilesEnd - snap.aTiles,
      bTilesDelta: bTilesEnd - snap.bTiles,
      aTilesEnd,
      bTilesEnd,
      aLost: Math.max(0, snap.aPets - aPetsEnd),
      bLost: Math.max(0, snap.bPets - bPetsEnd),
    };
  }
  state.execStartSnapshot = null;
}

export function resetMatchInPlace(state: MatchState, opts: { sandbox?: boolean } = {}): void {
  const fresh = createInitialMatch({ sandbox: opts.sandbox ?? state.sandbox });
  state.board = fresh.board;
  state.pets = fresh.pets;
  state.nextPetId = fresh.nextPetId;
  state.energy = fresh.energy;
  state.phase = fresh.phase;
  state.tick = fresh.tick;
  state.execPhaseStartTick = fresh.execPhaseStartTick;
  state.activePlanningPlayer = fresh.activePlanningPlayer;
  state.ready = fresh.ready;
  state.winner = fresh.winner;
  state.moveIntents = fresh.moveIntents;
  state.sandbox = fresh.sandbox;
  state.execStartSnapshot = fresh.execStartSnapshot;
  state.lastRoundSummary = fresh.lastRoundSummary;
  state.round = fresh.round;
}
