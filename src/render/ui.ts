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

  const help = document.getElementById('help');
  if (!help) {
    const div = document.createElement('div');
    div.id = 'help';
    div.style.textAlign = 'center';
    div.style.color = '#aaa';
    div.style.fontSize = '12px';
    div.style.margin = '6px';
    div.textContent =
      '1=Mouse  2=Elephant  |  WASD sets facing  |  Click to deploy  ' +
      '|  Tab switches player  |  Space readies current player';
    document.body.appendChild(div);
  }
}
