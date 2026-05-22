import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import {
  HOME_A_MAX_X, HOME_A_MAX_Y,
  HOME_B_MAX_X, HOME_B_MAX_Y,
} from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

describe('tryDeploy', () => {
  let state: MatchState;
  beforeEach(() => { state = createInitialMatch(); });

  it('player A can deploy a 1x1 mouse in the bottom-left corner', () => {
    state.energy.A = MOUSE.cost;
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pet.owner).toBe('A');
      expect(r.pet.anchor).toEqual({ x: 3, y: 0 });
      expect(r.pet.hp).toBe(MOUSE.maxHp);
    }
  });

  it('player A can deploy a 2x2 elephant with anchor at corner', () => {
    state.energy.A = ELEPHANT.cost;
    // Elephant is 2×2; anchor at (0,0) → footprint covers (0,0),(1,0),(0,1),(1,1) — all in A's zone
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: 0, y: 0 }, 'N');
    expect(r.ok).toBe(true);
  });

  it('player A cannot deploy if footprint exits the home zone', () => {
    // Mouse at (HOME_A_MAX_X, HOME_A_MAX_Y) is still inside A zone — fine.
    // But Elephant (2×2) at (HOME_A_MAX_X, HOME_A_MAX_Y) exits the zone.
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: HOME_A_MAX_X, y: HOME_A_MAX_Y }, 'N');
    expect(r.ok).toBe(false);
  });

  it('player B home zone is the top-right corner', () => {
    state.energy.B = MOUSE.cost;
    const r = tryDeploy(state, 'B', MOUSE.id, { x: HOME_B_MAX_X, y: HOME_B_MAX_Y }, 'S');
    expect(r.ok).toBe(true);
  });

  it('B cannot deploy in A home zone', () => {
    const r = tryDeploy(state, 'B', MOUSE.id, { x: 0, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy where energy is insufficient', () => {
    state.energy.A = 0;
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy on a tile already occupied by another pet', () => {
    state.energy.A = MOUSE.cost * 2;
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('debits energy on successful deploy', () => {
    state.energy.A = MOUSE.cost + 2;
    const before = state.energy.A;
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(state.energy.A).toBe(before - MOUSE.cost);
  });
});
