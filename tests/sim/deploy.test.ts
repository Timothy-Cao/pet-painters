import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { BOARD_SIZE } from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

describe('tryDeploy', () => {
  let state: MatchState;
  beforeEach(() => { state = createInitialMatch(); });

  it('player A can deploy a 1x1 mouse on row 0', () => {
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pet.owner).toBe('A');
      expect(r.pet.anchor).toEqual({ x: 3, y: 0 });
      expect(r.pet.hp).toBe(MOUSE.maxHp);
    }
  });

  it('player A can deploy a 2x2 elephant with anchor on row 0', () => {
    state.energy.A = ELEPHANT.cost;
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(true);
  });

  it('player A cannot deploy if footprint exits the home zone', () => {
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: 3, y: 1 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('player B home zone is the top rows', () => {
    const topRow = BOARD_SIZE - 1;
    const r = tryDeploy(state, 'B', MOUSE.id, { x: 5, y: topRow }, 'S');
    expect(r.ok).toBe(true);
  });

  it('B cannot deploy in A home zone', () => {
    const r = tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy where energy is insufficient', () => {
    state.energy.A = 0;
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy on a tile already occupied by another pet', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    state.energy.A = 5;
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('debits energy on successful deploy', () => {
    const before = state.energy.A;
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(state.energy.A).toBe(before - MOUSE.cost);
  });
});
