import { describe, it, expect } from 'vitest';
import {
  createInitialMatch,
  submitReady,
  tickMatch,
  endExecution,
} from '../../src/sim/match';
import {
  STARTING_ENERGY,
  ENERGY_CAP,
  ENERGY_PER_EXEC_SECOND,
  WIN_PAINT_THRESHOLD,
} from '../../src/config/balance';
import { TICKS_PER_SEC, BOARD_SIZE } from '../../src/config/constants';

describe('match flow', () => {
  it('starts in planning phase with starting energy', () => {
    const s = createInitialMatch();
    expect(s.phase).toBe('planning');
    expect(s.energy.A).toBe(STARTING_ENERGY);
    expect(s.energy.B).toBe(STARTING_ENERGY);
  });

  it('both submitting ready transitions to execution', () => {
    const s = createInitialMatch();
    submitReady(s, 'A');
    expect(s.phase).toBe('planning');
    submitReady(s, 'B');
    expect(s.phase).toBe('execution');
    expect(s.ready.A).toBe(false);
    expect(s.ready.B).toBe(false);
  });

  it('regenerates +1 energy per second during execution', () => {
    const s = createInitialMatch();
    submitReady(s, 'A'); submitReady(s, 'B');
    const before = s.energy.A;
    for (let i = 0; i < TICKS_PER_SEC; i++) tickMatch(s);
    expect(s.energy.A).toBe(before + ENERGY_PER_EXEC_SECOND);
  });

  it('caps energy at ENERGY_CAP', () => {
    const s = createInitialMatch();
    s.energy.A = ENERGY_CAP;
    submitReady(s, 'A'); submitReady(s, 'B');
    for (let i = 0; i < TICKS_PER_SEC * 5; i++) tickMatch(s);
    expect(s.energy.A).toBe(ENERGY_CAP);
  });

  it('endExecution returns to planning phase', () => {
    const s = createInitialMatch();
    submitReady(s, 'A'); submitReady(s, 'B');
    endExecution(s);
    expect(s.phase).toBe('planning');
  });

  it('declares winner when paint threshold is reached', () => {
    const s = createInitialMatch();
    // Force A's score above threshold by marking tiles directly.
    // We need scoreFor(board, 'A') >= WIN_PAINT_THRESHOLD.
    // Start counting from a neutral region and fill until we have enough.
    let count = 0;
    for (let y = 0; y < BOARD_SIZE && count < WIN_PAINT_THRESHOLD; y++) {
      for (let x = 0; x < BOARD_SIZE && count < WIN_PAINT_THRESHOLD; x++) {
        s.board.tiles[y * BOARD_SIZE + x] = 'A';
        count++;
      }
    }
    submitReady(s, 'A'); submitReady(s, 'B');
    tickMatch(s);
    expect(s.phase).toBe('ended');
    expect(s.winner).toBe('A');
  });
});
