import type { MatchState } from '../types/game';
import { createInitialBoard } from './board';
import { STARTING_ENERGY } from '../config/balance';

export function createInitialMatch(): MatchState {
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
    pendingDeployments: [],
    moveIntents: [],
  };
}
