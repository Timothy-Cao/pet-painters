import type { MatchState } from '../types/game';
import { scoreFor } from '../sim/board';
import { WIN_PAINT_THRESHOLD } from '../config/balance';

export function renderHUD(state: MatchState): void {
  const ui = document.getElementById('ui')!;
  const aScore = scoreFor(state.board, 'A');
  const bScore = scoreFor(state.board, 'B');
  ui.textContent =
    `Phase: ${state.phase}  |  ` +
    `A: ${aScore}/${WIN_PAINT_THRESHOLD} (energy ${state.energy.A})  ` +
    `B: ${bScore}/${WIN_PAINT_THRESHOLD} (energy ${state.energy.B})` +
    (state.phase === 'planning' ? `  |  active: ${state.activePlanningPlayer}` : '') +
    (state.winner ? `  |  WINNER: ${state.winner}` : '');
}
